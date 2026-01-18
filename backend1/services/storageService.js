const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize S3 client if credentials are provided
let s3Client = null;
const useLocalStorage = !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY;

if (!useLocalStorage) {
    s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
    console.log('[storageService] ✅ Using AWS S3 for file storage');
} else {
    console.log('[storageService] ⚠️  AWS credentials not configured. Using local storage fallback.');
    // Ensure local storage directory exists
    const localStoragePath = path.join(__dirname, '..', 'uploads', 'documents');
    if (!fs.existsSync(localStoragePath)) {
        fs.mkdirSync(localStoragePath, { recursive: true });
    }
}

exports.uploadFile = async (file) => {
    const fileExtension = file.originalname.split('.').pop();
    const filename = `${uuidv4()}.${fileExtension}`;

    if (useLocalStorage) {
        // Store locally
        const localStoragePath = path.join(__dirname, '..', 'uploads', 'documents');
        const filePath = path.join(localStoragePath, filename);

        fs.writeFileSync(filePath, file.buffer);
        console.log(`[storageService] 📁 File stored locally: ${filePath}`);

        // Return local URL
        return `/api/files/local/${filename}`;
    } else {
        // Store in S3
        const key = `documents/${filename}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
        });

        await s3Client.send(command);
        console.log(`[storageService] ☁️  File stored in S3: s3://${process.env.S3_BUCKET_NAME}/${key}`);

        // Return a proxy URL so the frontend doesn't need direct S3 access
        // This solves issues with private buckets or CORS
        return `/api/files/content/${filename}`;
    }
};

/**
 * Get a file from S3 by key
 * @param {string} key - S3 object key
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
exports.getFileByKey = async (key) => {
    if (!s3Client) {
        throw new Error('AWS S3 credentials not configured');
    }

    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    });

    try {
        const response = await s3Client.send(command);

        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        return {
            buffer,
            contentType: response.ContentType || 'application/octet-stream'
        };
    } catch (error) {
        console.error(`[storageService] Error fetching key ${key}:`, error);
        throw error;
    }
};

/**
 * Get a file from S3 or local storage
 * @param {string} fileUrl - The file URL (S3 URL or local path reference)
 * @returns {Promise<Buffer>} - The file content as a buffer
 */
exports.getFile = async (fileUrl) => {
    try {
        // Handle local storage references
        if (fileUrl.startsWith('/api/files/local/') || fileUrl.startsWith('/api/files/content/')) {
            const filename = fileUrl.split('/').pop();

            // Try local first
            const localStoragePath = path.join(__dirname, '..', 'uploads', 'documents', filename);
            if (fs.existsSync(localStoragePath)) {
                console.log(`[storageService] 📁 Fetching from local storage: ${localStoragePath}`);
                return fs.readFileSync(localStoragePath);
            }

            // If not local, try S3 if client exists
            if (s3Client) {
                const result = await exports.getFileByKey(`documents/${filename}`);
                return result.buffer;
            }

            throw new Error(`File not found locally or S3 not configured: ${filename}`);
        }

        // Handle direct S3 URLs (legacy)
        if (!s3Client) {
            throw new Error('AWS S3 credentials not configured. Cannot fetch S3 file.');
        }

        const url = new URL(fileUrl);
        const bucket = url.hostname.split('.')[0];
        const key = url.pathname.substring(1);

        const result = await exports.getFileByKey(key);
        return result.buffer;

    } catch (error) {
        console.error('[storageService] Error fetching file:', {
            fileUrl: fileUrl,
            error: error.message
        });
        throw error;
    }
};
