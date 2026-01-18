const pdf = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from either PDF or DOCX based on mimetype
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimetype - File MIME type (e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 * @returns {Promise<Object>} - Extracted text, page count, and metadata
 */
exports.extractText = async (fileBuffer, mimetype = 'application/pdf') => {
    try {
        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // DOCX processing
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return {
                text: result.value,
                numpages: 1, // DOCX doesn't have clear page boundaries, treat as 1 "page"
                info: {
                    format: 'docx',
                    title: result.value.split('\n')[0].substring(0, 50) // First line as title
                }
            };
        } else {
            // PDF processing (default)
            const data = await pdf(fileBuffer);
            return {
                text: data.text,
                numpages: data.numpages,
                info: data.info,
            };
        }
    } catch (error) {
        console.error('Document extraction error:', error.message);
        throw error;
    }
};

exports.chunkText = (text, options = {}) => {
    const { chunkSize = 1000, overlap = 200 } = options;
    const chunks = [];

    // Simple chunking by characters for now. 
    // For better results, use a recursive character text splitter from LangChain.
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunk = text.slice(start, end);

        // In a real implementation, you'd track page numbers here too if pdf-parse gave them per line/page.
        // pdf-parse gives all text. To get page numbers, we might need a more advanced parser or heuristics
        // For this MVP, we will assume generic chunking.
        // NOTE: To get per-page chunks, we'd need to use `pdf-parse` render callback or `pdfjs-dist` directly.
        // For MVP simplicity, we will assume the text is continuous.
        // IMPROVEMENT: Split by double newlines to try and preserve paragraphs.

        chunks.push({
            text: chunk,
            // Metadata placeholders
        });

        start += chunkSize - overlap;
    }

    return chunks;
};

/**
 * Extract text with page numbers from PDF or DOCX
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimetype - File MIME type
 * @returns {Promise<Array>} - Array of pages with pageNumber and text
 */
exports.extractTextWithPages = async (fileBuffer, mimetype = 'application/pdf') => {
    try {
        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // DOCX: Extract as single "page"
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            const text = result.value;
            
            // Split into logical sections for better RAG
            const sections = text.split('\n\n').filter(s => s.trim().length > 0);
            
            // Group sections into page-like chunks (roughly 3000 chars per "page")
            const pages = [];
            let currentPageText = '';
            
            for (const section of sections) {
                if ((currentPageText + '\n' + section).length > 3000 && currentPageText.length > 0) {
                    pages.push({
                        pageNumber: pages.length + 1,
                        text: currentPageText.trim()
                    });
                    currentPageText = section;
                } else {
                    currentPageText += '\n' + section;
                }
            }
            
            // Add final page
            if (currentPageText.trim().length > 0) {
                pages.push({
                    pageNumber: pages.length + 1,
                    text: currentPageText.trim()
                });
            }
            
            console.log(`[pdfProcessor] 📄 DOCX extracted: ${pages.length} logical pages`);
            return pages.length > 0 ? pages : [{
                pageNumber: 1,
                text: text.trim()
            }];
        } else {
            // PDF: Use existing PDF extraction logic
            return await pdf(fileBuffer, {
                pagerender: function (pageData) {
                    let render_options = {
                        normalizeWhitespace: false,
                        disableCombineTextItems: false
                    }
                    return pageData.getTextContent(render_options)
                        .then(function (textContent) {
                            let lastY, text = '';
                            for (let item of textContent.items) {
                                if (lastY == item.transform[5] || !lastY) {
                                    text += item.str;
                                }
                                else {
                                    text += '\n' + item.str;
                                }
                                lastY = item.transform[5];
                            }
                            return `${text}-----PAGE_BREAK-----`;
                        });
                }
            }).then(data => {
                const rawPages = data.text.split('-----PAGE_BREAK-----');
                if (rawPages[rawPages.length - 1].trim() === '') rawPages.pop();

                return rawPages.map((pageText, index) => ({
                    pageNumber: index + 1,
                    text: pageText.trim()
                }));
            });
        }
    } catch (error) {
        console.error('[pdfProcessor] Error extracting pages:', error.message);
        throw error;
    }
};
