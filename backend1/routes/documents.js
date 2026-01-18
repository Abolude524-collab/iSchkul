const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentController = require('../controllers/documentController');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// Configure multer for memory storage (process buffer directly)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimetypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        if (allowedMimetypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and DOCX files are allowed!'), false);
        }
    }
});

router.post('/upload', auth, upload.single('file'), documentController.uploadDocument);
router.get('/', auth, documentController.getDocuments);

// Import PDF from external URL (e.g., ArXiv)
router.post('/import-url', auth, documentController.importFromUrl);

// Get document metadata by id
router.get('/:id', auth, documentController.getDocumentById);

// Serve document from S3 (CORS proxy) - handles both PDF and DOCX
router.get('/:id/content', auth, documentController.serveDocument);

// Serve DOCX as HTML (for viewing in browser)
router.get('/:id/preview', auth, documentController.previewDocAsHTML);

module.exports = router;
