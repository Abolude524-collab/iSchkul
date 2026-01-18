# Optional Dependencies Installation Guide

**iSchkul Platform - OCR & PPTX Support**

---

## 📦 Overview

The enhanced file upload system uses optional dependencies for advanced features:
- **OCR (Optical Character Recognition)** - tesseract.js
- **PPTX Extraction** - extract-files-from-pptx
- **PDF to Image Conversion** - pdf2pic
- **Image Processing** - sharp

These are **optional** and marked as `optionalDependencies` in package.json. The system will gracefully fall back if they're not installed.

---

## ✅ Installation Options

### Option 1: Minimal Setup (Recommended for Development)
**Supports**: PDF (native), TXT, and basic PPTX

```bash
# Only install core dependencies - no optional packages
cd backend1
npm install
```

**Features Available**:
- ✅ PDF text extraction (text-based PDFs)
- ✅ Plain text files
- ✅ Error messages if OCR or PPTX extraction needed

---

### Option 2: Full Setup (Production Ready)
**Supports**: Everything including OCR and scanned documents

#### Windows
```bash
cd backend1

# Install optional dependencies one by one
npm install tesseract.js --save-optional
npm install extract-files-from-pptx --save-optional
npm install sharp --save-optional

# Verify installation
npm ls tesseract.js extract-files-from-pptx sharp
```

#### macOS / Linux
```bash
cd backend1

# System dependencies may be needed
# macOS:
brew install poppler

# Linux (Ubuntu/Debian):
sudo apt-get install poppler-utils

# Install npm packages
npm install tesseract.js@latest --save-optional
npm install extract-files-from-pptx --save-optional
npm install sharp --save-optional
```

---

## 🔧 Setup Troubleshooting

### Issue: "tesseract.js not installed"

**Solution 1**: Install it
```bash
npm install tesseract.js
```

**Solution 2**: Keep using without OCR (fallback to PDF parser)
```
The system will automatically skip OCR and use pdf-parse for scanned PDFs
```

### Issue: "PPTX support not installed"

**Solution**: Install the PPTX parser
```bash
npm install extract-files-from-pptx
```

### Issue: Build fails with optional dependencies

**Solution**: Skip optional dependencies
```bash
npm ci --no-optional
# or
npm install --omit=optional
```

---

## 📋 Installation Commands by Platform

### Windows - Full Installation
```powershell
cd C:\Users\23481\Pictures\ischkul-azure\backend1

# Install all optional dependencies
npm install tesseract.js extract-files-from-pptx sharp --save-optional

# Verify
npm list tesseract.js extract-files-from-pptx sharp
```

### macOS - Full Installation
```bash
# Install system dependencies
brew install poppler

# Install npm packages
cd ~/path/to/ischkul-azure/backend1
npm install tesseract.js extract-files-from-pptx sharp --save-optional
```

### Linux (Ubuntu/Debian) - Full Installation
```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install poppler-utils

# Install npm packages
cd /path/to/ischkul-azure/backend1
npm install tesseract.js extract-files-from-pptx sharp --save-optional
```

### Docker Setup
```dockerfile
FROM node:22-alpine

# Install system dependencies for OCR
RUN apk add --no-cache \
    poppler-utils \
    python3 \
    build-essential

WORKDIR /app
COPY package*.json ./

# Install dependencies including optional
RUN npm ci

COPY . .

CMD ["node", "server.js"]
```

---

## ✨ Feature Matrix

### Without Optional Dependencies
```
PDF (Text-based)          ✅ Supported
PPTX                      ❌ Not available
Images (PNG/JPG)          ❌ Not available
Scanned PDFs              ❌ Not available
TXT Files                 ✅ Supported
```

### With All Optional Dependencies
```
PDF (Text-based)          ✅ Supported
PPTX                      ✅ Full support
Images (PNG/JPG)          ✅ Full OCR
Scanned PDFs              ✅ OCR fallback
TXT Files                 ✅ Supported
Handwritten text          ⚠️  Limited (55-85% accuracy)
```

---

## 🚀 Recommended Production Setup

1. **Development**: Skip optional dependencies
   ```bash
   npm install
   ```

2. **Staging**: Install OCR only
   ```bash
   npm install tesseract.js@latest
   ```

3. **Production**: Full installation
   ```bash
   npm install tesseract.js extract-files-from-pptx sharp --save-optional
   ```

---

## 📊 Dependency Size Impact

| Package | Size | Required? |
|---------|------|-----------|
| tesseract.js | ~10MB | Optional (OCR) |
| extract-files-from-pptx | ~0.5MB | Optional (PPTX) |
| sharp | ~20MB | Optional (Images) |
| **Total Optional** | **~30MB** | No |
| **Core Only** | **~500MB** | Yes |

> **Note**: Large files are mainly due to Tesseract language models being bundled.

---

## 🧪 Test Installation

### Verify Core Features (Always Works)
```bash
# Test PDF extraction
curl -X POST http://localhost:5000/api/generate/quiz \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file": {
      "data": "base64_encoded_pdf",
      "mimetype": "application/pdf",
      "filename": "test.pdf"
    }
  }'
```

### Test Optional Features

#### Test PPTX Support
```bash
# If installed, this will work
curl -X POST http://localhost:5000/api/generate/quiz \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file": {
      "data": "base64_encoded_pptx",
      "mimetype": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "filename": "slides.pptx"
    }
  }'

# If not installed, you'll get:
# {"error": "PPTX support not installed. Install with: npm install extract-files-from-pptx"}
```

#### Test OCR Support
```bash
# If installed, this will work
curl -X POST http://localhost:5000/api/generate/quiz \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "file": {
      "data": "base64_encoded_image",
      "mimetype": "image/png",
      "filename": "scanned_notes.png"
    }
  }'

# If not installed, you'll get:
# {"error": "OCR support not installed. Install with: npm install tesseract.js"}
```

---

## 🔄 Updating Optional Dependencies

```bash
# Check for updates
npm outdated

# Update specific packages
npm update tesseract.js
npm update extract-files-from-pptx
npm update sharp

# Update all
npm update
```

---

## 💾 Environment Variables (Optional)

```env
# OCR Configuration
OCR_LANGUAGES=eng,fra,deu,spa
OCR_TEMP_DIR=./temp_uploads
OCR_TIMEOUT=60000

# PPTX Configuration
PPTX_TEMP_DIR=./temp_uploads

# Image Processing
SHARP_IGNORE_GLOBAL_LIBVIPS=1
```

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot find module 'tesseract.js'"
```bash
# Solution 1: Install it
npm install tesseract.js

# Solution 2: Use system without OCR
# The app will work, just skip image/scanned PDFs
```

### Issue: Installation hangs on tesseract.js
```bash
# Increase timeout
npm install tesseract.js --timeout=60000

# Or use a specific version
npm install tesseract.js@5.0.0
```

### Issue: "sharp ERR_DLOPEN_FAILED on Windows"
```bash
# Reinstall with build tools
npm install sharp --build-from-source

# Or use pre-built binary
npm install sharp@latest
```

### Issue: Memory issues during OCR processing
```bash
# Increase Node memory limit
node --max-old-space-size=4096 server.js

# Or in package.json:
"scripts": {
  "start": "node --max-old-space-size=4096 server.js",
  "dev": "nodemon --max-old-space-size=4096 server.js"
}
```

---

## 📝 Quick Reference

### Install Minimal (PDF + TXT only)
```bash
npm install
```

### Install Standard (Add PPTX)
```bash
npm install extract-files-from-pptx --save-optional
```

### Install Full (Add OCR)
```bash
npm install tesseract.js extract-files-from-pptx sharp --save-optional
```

### Verify Installation
```bash
npm ls --depth=0
```

### Remove Optional Dependencies
```bash
npm prune --production
```

---

## 🎯 Next Steps

1. ✅ **Core installation** complete
2. 📦 **Optional dependencies** - install as needed
3. 🧪 **Test the endpoints** with different file types
4. 📖 **Read FILE_UPLOAD_OCR_GUIDE.md** for API usage
5. 🚀 **Deploy** with appropriate optional dependencies

---

**Document Version**: 1.0  
**Created**: January 17, 2026  
**Status**: Ready ✅
