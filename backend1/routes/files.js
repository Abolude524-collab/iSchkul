const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const auth = require('../middleware/auth');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
    }
  }
});

// Upload file
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileData = {
      _id: Date.now().toString(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      uploadedBy: req.user._id,
      uploadedAt: new Date().toISOString()
    };

    // Extract text content
    let extractedText = '';
    try {
      if (req.file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(req.file.path);
        const data = await pdfParse(dataBuffer);
        extractedText = data.text;
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ path: req.file.path });
        extractedText = result.value;
      } else if (req.file.mimetype === 'text/plain') {
        extractedText = fs.readFileSync(req.file.path, 'utf8');
      }
    } catch (extractError) {
      console.log('Text extraction failed:', extractError);
    }

    fileData.extractedText = extractedText;

    res.status(201).json({
      file: fileData,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's files
router.get('/', auth, (req, res) => {
  try {
    // Mock file list - in production, query database
    const mockFiles = [
      {
        _id: '1',
        filename: 'sample.pdf',
        originalName: 'Sample Document.pdf',
        mimetype: 'application/pdf',
        size: 1024000,
        uploadedAt: new Date().toISOString(),
        extractedText: 'Sample text content...'
      }
    ];

    res.json({ files: mockFiles });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve local file (for development without AWS S3)
router.get('/local/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'documents', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`[files] File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.txt') contentType = 'text/plain';
    else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) contentType = `image/${ext.replace('.', '')}`;
    else if (ext === '.svg') contentType = 'image/svg+xml';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Stream the file
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('[files] Error serving local file:', error);
    res.status(500).json({ error: 'Error serving file' });
  }
});

// Serve content from S3 or local (proxy)
router.get('/content/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const storageService = require('../services/storageService');
    const key = `documents/${filename}`;

    try {
      const { buffer, contentType } = await storageService.getFileByKey(key);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      console.log(`[files] File not found in S3/Local: ${key}`);
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('[files] Error serving content:', error);
    res.status(500).json({ error: 'Error serving file' });
  }
});

module.exports = router;