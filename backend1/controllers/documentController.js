const Document = require('../models/Document');
const storageService = require('../services/storageService');
const pdfProcessor = require('../services/pdfProcessor');
const openaiService = require('../services/openai');
const vectorDB = require('../services/vectorDB');
const { v4: uuidv4 } = require('uuid');
// Get a single document by ID (metadata only)
exports.getDocumentById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const doc = await Document.findById(id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        if (!doc.uploadedBy || doc.uploadedBy.toString() !== String(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({
            _id: doc._id,
            title: doc.title,
            filename: doc.filename,
            pages: doc.pages,
            chunkCount: doc.chunkCount,
            indexStatus: doc.indexStatus,
            fileUrl: doc.fileUrl,
            metadata: doc.metadata
        });
    } catch (error) {
        console.error('Get document error:', error.message);
        res.status(500).json({ error: 'Failed to fetch document', details: error.message });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, courseId } = req.body;
        const userId = req.user.id; // Assumes auth middleware populates this

        // 1. Create initial Document record
        const mongoose = require('mongoose');
        const document = new Document({
            title: title || req.file.originalname,
            filename: req.file.originalname,
            uploadedBy: new mongoose.Types.ObjectId(userId),
            courseId,
            fileUrl: 'pending', // Placeholder
            metadata: {
                fileSize: req.file.size,
                contentType: req.file.mimetype,
            },
            vectorIndexId: `doc_${uuidv4()}`, // Unique namespace for this document
            indexStatus: 'processing'
        });

        await document.save();

        // 2. Upload to S3
        const fileUrl = await storageService.uploadFile(req.file);
        document.fileUrl = fileUrl;
        await document.save();

        // 3. Process Document (Extract Text & Pages) - supports PDF and DOCX
        const pages = await pdfProcessor.extractTextWithPages(req.file.buffer, req.file.mimetype);
        document.pages = pages.length;
        await document.save();

        // 4. Award XP for upload
        if (req.app && req.app.locals && typeof req.app.locals.awardXp === 'function') {
            try {
                await req.app.locals.awardXp(userId, 'file_upload', 15, {
                    filename: req.file.originalname,
                    title: title || req.file.originalname,
                    documentId: document._id
                });
            } catch (xpError) {
                console.error('Failed to award XP for upload:', xpError);
            }
        }

        // 5. Chunking & Embedding
        let totalChunks = 0;
        const vectors = [];

        // Process each page
        for (const page of pages) {
            // Chunk the page text
            const pageChunks = pdfProcessor.chunkText(page.text, { chunkSize: 1000, overlap: 200 });

            for (const [chunkIndex, chunkObj] of pageChunks.entries()) {
                // Generate Embedding (OpenAI primary, Gemini fallback)
                const embedding = await openaiService.generateEmbedding(chunkObj.text);

                // Skip if embedding failed (quota exceeded, etc.) - document still uploaded
                if (!embedding) {
                    console.warn(`[documentController] ⚠️  Skipping embedding for chunk ${chunkIndex}`);
                    continue;
                }

                // Prepare Vector
                vectors.push({
                    id: `${document.vectorIndexId}_p${page.pageNumber}_c${chunkIndex}`,
                    values: embedding,
                    metadata: {
                        text: chunkObj.text,
                        pageNumber: page.pageNumber,
                        documentId: document._id.toString(),
                        title: document.title,
                        courseId: document.courseId
                    }
                });

                totalChunks++;
            }
        }

        // 5. Upsert to Pinecone (graceful if Pinecone not configured)
        if (vectors.length > 0) {
            const BATCH_SIZE = 50;
            let upsertedCount = 0;
            for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
                const batch = vectors.slice(i, i + BATCH_SIZE);
                const ok = await vectorDB.upsertVectors(batch, document.vectorIndexId);
                if (ok) {
                    upsertedCount += batch.length;
                }
            }
            if (upsertedCount > 0) {
                console.log(`[documentController] ✅ Upserted ${upsertedCount} vectors to Pinecone`);
            } else {
                console.warn('[documentController] ⚠️  Skipped vector upsert (Pinecone not configured or upsert failed). Document will still be available without vector search.');
            }
        } else {
            console.warn('[documentController] No vectors generated for this document');
        }

        // 6. Finalize Document
        document.chunkCount = totalChunks;
        document.indexStatus = 'completed';
        await document.save();

        const response = {
            success: true,
            message: `Document uploaded successfully with ${totalChunks} chunks processed`,
            document
        };

        // Add warning if embeddings were skipped
        if (vectors.length === 0 && totalChunks > 0) {
            response.warning = '⚠️  Document uploaded but embeddings failed. Vector search will not work until embeddings are generated. This is usually due to API quota limits.';
            console.warn('[documentController] ⚠️  No vectors were generated - embeddings unavailable');
        } else if (vectors.length < totalChunks) {
            response.warning = `⚠️  Only ${vectors.length}/${totalChunks} chunks were embedded. Some vector search functionality may be limited.`;
        }

        res.status(201).json(response);

    } catch (error) {
        console.error('Document upload error:', error);
        res.status(500).json({ error: 'Failed to process document', details: error.message });
    }
};

exports.getDocuments = async (req, res) => {
    try {
        const userId = req.user.id;
        const documents = await Document.find({ uploadedBy: userId })
            .sort({ createdAt: -1 })
            .select('title filename createdAt pages indexStatus chunkCount');

        res.json(documents);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
};

/**
 * Import PDF from external URL (e.g., ArXiv) and process it
 */
exports.importFromUrl = async (req, res) => {
    try {
        const { url, title } = req.body;
        const userId = req.user.id;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`[documentController] Importing document from URL: ${url}`);

        // Fetch the PDF from the URL
        const axios = require('axios');
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const buffer = Buffer.from(response.data);
        const filename = new URL(url).pathname.split('/').pop() || 'document.pdf';

        console.log(`[documentController] Downloaded ${buffer.length} bytes from ${url}`);

        // 1. Create initial Document record
        const mongoose = require('mongoose');
        const document = new Document({
            title: title || filename,
            filename: filename,
            uploadedBy: new mongoose.Types.ObjectId(userId),
            fileUrl: url, // Store original URL
            sourceUrl: url, // Track source for attribution
            metadata: {
                fileSize: buffer.length,
                contentType: response.headers['content-type'] || 'application/pdf',
            },
            vectorIndexId: `doc_${require('uuid').v4()}`,
            indexStatus: 'processing'
        });
        await document.save();

        console.log(`[documentController] Created document record: ${document._id}`);

        // 2. Upload to S3
        const key = `documents/${document._id}/${filename}`;
        const s3Url = await storageService.uploadFile(buffer, key);
        document.fileUrl = s3Url;
        await document.save();

        console.log(`[documentController] Uploaded to S3: ${s3Url}`);

        // 3. Process document (extract text, generate embeddings, etc.)
        const pages = await pdfProcessor.extractTextWithPages(buffer);
        document.pages = pages.length;
        await document.save();

        // 4. Chunking & Embedding
        let totalChunks = 0;
        const vectors = [];

        for (const page of pages) {
            const pageChunks = pdfProcessor.chunkText(page.text, { chunkSize: 1000, overlap: 200 });

            for (const [chunkIndex, chunkObj] of pageChunks.entries()) {
                const embedding = await openaiService.generateEmbedding(chunkObj.text);

                if (!embedding) {
                    console.warn(`[documentController] Skipping embedding for chunk ${chunkIndex}`);
                    continue;
                }

                vectors.push({
                    id: `${document.vectorIndexId}_p${page.pageNumber}_c${chunkIndex}`,
                    values: embedding,
                    metadata: {
                        text: chunkObj.text,
                        pageNumber: page.pageNumber,
                        documentId: document._id.toString(),
                        title: document.title,
                        sourceUrl: url
                    }
                });

                totalChunks++;
            }
        }

        // 5. Upsert to Pinecone
        if (vectors.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
                const batch = vectors.slice(i, i + BATCH_SIZE);
                await vectorDB.upsertVectors(batch, document.vectorIndexId);
            }
            console.log(`[documentController] ✅ Upserted ${vectors.length} vectors to Pinecone`);
        }

        // 6. Finalize Document
        document.chunkCount = totalChunks;
        document.indexStatus = 'completed';
        await document.save();

        const result = {
            success: true,
            message: `Document imported successfully from ${url}`,
            document
        };

        if (vectors.length === 0 && totalChunks > 0) {
            result.warning = '⚠️  Document imported but embeddings failed. Vector search will not work.';
        }

        res.status(201).json(result);

    } catch (error) {
        console.error('Document import error:', error.message);
        res.status(500).json({ 
            error: 'Failed to import document', 
            details: error.message 
        });
    }
};

/**
 * Serve document from S3 (acts as a CORS proxy)
 */
exports.serveDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        console.log(`[serveDocument] Request for document: ${id} by user: ${userId}`);

        const document = await Document.findById(id);
        if (!document) {
            console.log(`[serveDocument] Document not found: ${id}`);
            return res.status(404).json({ error: 'Document not found' });
        }

        console.log(`[serveDocument] Document found:`, {
            id: document._id,
            filename: document.filename,
            uploadedBy: document.uploadedBy,
            fileUrl: document.fileUrl,
            hasFileUrl: !!document.fileUrl
        });

        // Check authorization (normalize types to strings)
        if (!document.uploadedBy || document.uploadedBy.toString() !== String(userId)) {
            console.log(`[serveDocument] Access denied - uploadedBy: ${document.uploadedBy}, userId: ${userId}`);
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!document.fileUrl) {
            console.error(`[serveDocument] Document has no fileUrl: ${id}`);
            return res.status(500).json({ error: 'Document file not available' });
        }

        console.log(`[serveDocument] Serving document: ${document.filename} from ${document.fileUrl}`);

        // Check if it's an S3 URL or external URL
        const isS3Url = document.fileUrl.includes('s3.amazonaws.com') || document.fileUrl.includes('.s3.');
        let fileBuffer;

        if (isS3Url) {
            // Use AWS SDK to fetch from S3 with credentials
            const storageService = require('../services/storageService');
            fileBuffer = await storageService.getFile(document.fileUrl);
            console.log(`[serveDocument] Fetched ${fileBuffer.length} bytes from S3`);
        } else {
            // For external URLs, use axios
            const axios = require('axios');
            const fileResponse = await axios.get(document.fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            fileBuffer = Buffer.from(fileResponse.data);
            console.log(`[serveDocument] Fetched ${fileBuffer.length} bytes from external URL`);
        }

        // Set headers to allow CORS and proper content type
        res.set({
            'Content-Type': (document.metadata && document.metadata.contentType) || 'application/pdf',
            'Content-Length': fileBuffer.length,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });

        res.send(fileBuffer);

    } catch (error) {
        console.error('[serveDocument] Error:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
            status: error.response?.status
        });
        res.status(500).json({ 
            error: 'Failed to serve document', 
            details: error.message 
        });
    }
};

/**
 * Preview DOCX as HTML for browser viewing
 * Converts DOCX to HTML using mammoth
 */
exports.previewDocAsHTML = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check authorization
        if (!document.uploadedBy || document.uploadedBy.toString() !== String(userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Only serve DOCX files as HTML
        if (document.metadata?.contentType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return res.status(400).json({ error: 'This endpoint only supports DOCX files. Use /content for PDFs.' });
        }

        if (!document.fileUrl) {
            return res.status(500).json({ error: 'Document file not available' });
        }

        console.log(`[previewDocAsHTML] Converting DOCX to HTML: ${document.filename}`);

        // Fetch file from storage
        const isS3Url = document.fileUrl.includes('s3.amazonaws.com') || document.fileUrl.includes('.s3.');
        let fileBuffer;

        if (isS3Url) {
            fileBuffer = await storageService.getFile(document.fileUrl);
        } else {
            const axios = require('axios');
            const fileResponse = await axios.get(document.fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            fileBuffer = Buffer.from(fileResponse.data);
        }

        // Convert DOCX to HTML
        const mammoth = require('mammoth');
        const result = await mammoth.convertToHtml({ buffer: fileBuffer });

        // Wrap in HTML document with styling
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.filename}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
            background-color: #f5f5f5;
        }
        .doc-content {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1, h2, h3, h4, h5, h6 {
            color: #1a1a1a;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        p {
            margin-bottom: 12px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        td, th {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        img {
            max-width: 100%;
            height: auto;
        }
        blockquote {
            border-left: 4px solid #007bff;
            padding-left: 16px;
            margin: 16px 0;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="doc-content">
        ${result.value}
    </div>
</body>
</html>`;

        res.set({
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*'
        });

        res.send(htmlContent);

    } catch (error) {
        console.error('[previewDocAsHTML] Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to preview document', 
            details: error.message 
        });
    }
};
