# PDF Proxy System - Quick Reference

## 🚀 Quick Start (3 Steps)

### Step 1: Start Backend
```bash
cd ischkul-azure/backend1
node server.js
```
✅ Expected: `Server running on port 5000`

### Step 2: Get JWT Token
```bash
node get-token.js
# Output: Your JWT token
```
Copy the token (use in next step)

### Step 3: Test Import
```bash
node test-pdf-import.js "your-jwt-token-here"
```
✅ Expected: `✅ Import successful!` with document ID

---

## 📋 What Just Happened

```
ArXiv PDF
    ↓ (via proxy)
Backend (no CORS)
    ↓
S3 Upload
    ↓
MongoDB Save
    ↓
Proxy URL
    ↓
Frontend PDF Viewer
```

**CORS Issues Solved**: Backend acts as middleman

---

## 🔧 Common Commands

### Get Token (required for testing)
```bash
cd backend1
node get-token.js admin@ischkul.com admin123
```

### Test PDF Import
```bash
cd backend1
node test-pdf-import.js "JWT_TOKEN_HERE"
```

### Check MongoDB
```bash
mongosh mongodb://localhost:27017/ischkul
db.documents.findOne()
```

### Check S3
```bash
aws s3 ls s3://ischkul-files/documents/ --region eu-north-1
```

### Start Frontend (separate terminal)
```bash
cd frontend
npm run dev
```

### View Logs
```bash
# Backend: Ctrl+C to stop, then scroll up in terminal
# Frontend: Check browser Console (F12)
# MongoDB: mongosh show logs
```

---

## ✅ Verification Checklist

- [ ] Backend running (`Server running on port 5000`)
- [ ] MongoDB running (`mongosh` connects)
- [ ] JWT token obtained (`node get-token.js`)
- [ ] Import test passed (`node test-pdf-import.js`)
- [ ] Document ID returned from import
- [ ] Frontend running (`http://localhost:5173`)
- [ ] PDF displays in Co-Reader without CORS errors

---

## 🆘 Troubleshooting

### Backend won't start
```bash
# Check if port 5000 in use
lsof -i :5000
kill -9 <PID>  # Kill process
node server.js  # Restart
```

### MongoDB connection error
```bash
# Start MongoDB
mongosh mongodb://localhost:27017/ischkul
# If fails, start mongo service or docker container
```

### JWT token invalid
```bash
# Get fresh token
node get-token.js admin@ischkul.com admin123
# Or login to frontend and copy from DevTools
```

### "CORS blocked" error
```bash
# This shouldn't happen with proxy!
# Check in browser DevTools:
# - Network tab → Check /api/documents/:id/content request
# - Response headers should have Access-Control-Allow-Origin: *
```

### PDF doesn't display
```bash
# Check:
# 1. Document imported successfully (has ID)
# 2. File exists in S3: aws s3 ls s3://ischkul-files/documents/
# 3. Network request returns status 200
# 4. Content-Type is application/pdf
```

---

## 📊 Test Workflow

```
1. Start Backend
   └─→ 2. Get Token
       └─→ 3. Import PDF from ArXiv
           └─→ 4. Verify MongoDB entry
               └─→ 5. Verify S3 file
                   └─→ 6. Start Frontend
                       └─→ 7. Navigate to Co-Reader
                           └─→ 8. PDF displays ✅
```

---

## 🔑 Test Credentials

**Admin User**:
- Email: `admin@ischkul.com`
- Password: `admin123`

**Endpoints Tested**:
- Import: `POST /api/documents/import-url`
- Serve: `GET /api/documents/:id/content`

**Test URL**:
- `https://arxiv.org/pdf/1706.03762.pdf` (Transformer paper, 15 pages)

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend1/server.js` | Backend entry point |
| `backend1/controllers/documentController.js` | Import & proxy logic |
| `backend1/routes/documents.js` | API routes |
| `backend1/get-token.js` | Get JWT token for testing |
| `backend1/test-pdf-import.js` | Full import test |
| `frontend/src/pages/CoReaderPage.tsx` | Frontend page |
| `PDF_PROXY_TESTING.md` | Detailed testing guide |
| `IMPLEMENTATION_STATUS.md` | Implementation details |

---

## 🎯 Success Indicators

✅ **All tests pass**:
```
1️⃣  Importing PDF from ArXiv... ✅ Import successful!
2️⃣  Testing document proxy... ✅ Proxy working!
3️⃣  Frontend Integration... http://localhost:5173/co-reader/{id}
```

✅ **No CORS errors** in browser console

✅ **PDF displays** in Co-Reader page

✅ **Page navigation** works

✅ **ChatInterface** can see document content

---

## 🚨 If Everything Fails

**Nuclear option** (start fresh):

```bash
# 1. Kill all Node processes
pkill node
# or on Windows: taskkill /IM node.exe /F

# 2. Stop MongoDB
# (depends on your setup)

# 3. Clear temp files
rm -rf backend1/uploads
rm -rf frontend/dist
rm -rf node_modules

# 4. Reinstall dependencies
cd backend1 && npm install
cd ../frontend && npm install

# 5. Restart from Step 1
node backend1/server.js
```

---

## 💡 Pro Tips

1. **Copy token easily**:
   ```bash
   TOKEN=$(node -e "console.log(require('child_process').execSync('node get-token.js').toString().split('Token:\\n')[1].split('\\n')[0])")
   echo $TOKEN  # Use this token
   ```

2. **Test multiple PDFs**:
   - Transformer paper: `https://arxiv.org/pdf/1706.03762.pdf`
   - BERT paper: `https://arxiv.org/pdf/1810.04805.pdf`
   - GPT paper: `https://arxiv.org/pdf/1810.04805.pdf`

3. **Monitor S3 uploads**:
   ```bash
   watch -n 2 'aws s3 ls s3://ischkul-files/documents/ --region eu-north-1 --recursive | tail -10'
   ```

4. **Quick MongoDB check**:
   ```bash
   mongosh mongodb://localhost:27017/ischkul --eval "db.documents.countDocuments()"
   ```

---

## ⏱️ Estimated Time to Full Test

| Step | Time | Task |
|------|------|------|
| 1 | 2min | Start backend |
| 2 | 1min | Get JWT token |
| 3 | 2min | Import PDF |
| 4 | 1min | Verify MongoDB |
| 5 | 1min | Check S3 |
| 6 | 2min | Start frontend |
| 7 | 1min | Navigate to page |
| 8 | 2min | PDF loads & test |
| **Total** | **~12 minutes** | **Full validation** |

---

## 📞 Support

If tests fail:
1. Read error message carefully
2. Check "Troubleshooting" section above
3. Read [PDF_PROXY_TESTING.md](PDF_PROXY_TESTING.md) for detailed guide
4. Check server logs: `node backend1/server.js` output
5. Check browser console: F12 → Console tab

---

**Ready? Start with: `cd backend1 && node server.js`** 🚀
