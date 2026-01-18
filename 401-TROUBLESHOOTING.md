# 401 Unauthorized Error - Troubleshooting Guide

## Error Details
```
Failed to load resource: the server responded with a status of 401 (Unauthorized)
GET http://localhost:5000/api/documents/696ce26f3576633b05af40ec
```

## What This Means
The frontend is trying to fetch document metadata (`GET /api/documents/:id`), but the authentication check failed on the backend. The auth middleware rejected the request.

---

## 🔍 Diagnosis Steps

### Step 1: Check Token in Browser Console
Open your browser **Developer Tools (F12)** → **Console** tab and run:

```javascript
// Check if token exists
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token value:', token);
console.log('Token length:', token?.length);
console.log('Starts with "eyJ":', token?.startsWith('eyJ'));
```

**Expected output** if token is valid:
```
Token exists: true
Token value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0YWJj...
Token length: 200+ characters
Starts with "eyJ": true
```

**If you see:**
- `Token exists: false` → **Issue #1: Token not stored**
- `Starts with "eyJ": false` → **Issue #2: Token is malformed**

---

### Step 2: Check Backend Logs

When you navigate to the CoReaderPage, check your backend terminal (`npm run dev`). You should see detailed logs like:

```
🔐 Auth middleware - Authorization header: ✓ Present
🔑 Token extracted - Length: 185 Valid JWT format: true
✅ JWT verified successfully - User ID: 64abcd1234567890abcdef12
✅ User authenticated: admin@ischkul.com
📡 Response status: 200
✅ Document metadata received: { _id: '696ce26f3576633b05af40ec', ... }
📍 Setting proxy URL: http://localhost:5000/api/documents/696ce26f3576633b05af40ec/content
```

**If you see errors**, note the exact error message - it will help identify the issue.

---

## 🛠️ Common Issues & Fixes

### Issue #1: Token Not Stored in localStorage

**Symptoms:**
- `localStorage.getItem('token')` returns `null`
- Login page doesn't redirect to dashboard

**Fix:**
```javascript
// 1. Clear localStorage completely
localStorage.clear();

// 2. Reload page
window.location.reload();

// 3. Login again with credentials:
//    Email: admin@ischkul.com
//    Password: admin123

// 4. Verify token was stored
console.log('Token after login:', localStorage.getItem('token')?.substring(0, 30));
```

---

### Issue #2: Token is Malformed

**Symptoms:**
- `token.startsWith('eyJ')` returns `false`
- Token has spaces, newlines, or weird characters
- Backend error: `JsonWebTokenError: jwt malformed`

**Check for issues:**
```javascript
const token = localStorage.getItem('token');
console.log('Raw token:', JSON.stringify(token)); // shows hidden chars
console.log('Has spaces:', token?.includes(' '));
console.log('Has newlines:', token?.includes('\n'));
console.log('Has tabs:', token?.includes('\t'));
```

**Fix:**
```javascript
// Clear and re-login
localStorage.removeItem('token');
window.location.href = '/login';
```

---

### Issue #3: JWT_SECRET Mismatch

**Symptoms:**
- Backend logs show: `JsonWebTokenError: invalid signature`
- Token verifies correctly but says "signature invalid"

**Fix:**
1. Check `.env` file in backend has `JWT_SECRET` set
2. Make sure it matches across login and verification
3. Restart backend: `npm run dev`

---

### Issue #4: MongoDB Not Running

**Symptoms:**
- Backend logs show: `User not found in database`
- Even valid token fails auth

**Fix:**
```bash
# Check if MongoDB is running
mongosh mongodb://localhost:27017

# If connection refused, start MongoDB:
# On Windows:
net start MongoDB

# Or run MongoDB from Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or use MongoDB Atlas (cloud):
# Set MONGODB_URI in .env to your Atlas connection string
```

---

## 📝 What Frontend Logging Will Show

After the changes, when you navigate to CoReaderPage, check the browser console (F12):

```
📄 Loading document: 696ce26f3576633b05af40ec
🔑 Token exists: true
🔑 Token length: 185
🔑 Token preview: eyJhbGciOiJIUzI1NiIsIn...
🔑 Token starts with "eyJ": true
📡 Response status: 200
✅ Document metadata received: {_id: '696ce26f3576633b05af40ec', ...}
📍 Setting proxy URL: http://localhost:5000/api/documents/696ce26f3576633b05af40ec/content
```

If you see a different status (like 401), the backend logs will show why.

---

## 🧪 Testing Steps

### Test 1: Verify Backend Health
```bash
cd backend1
npm run dev

# In another terminal, test auth endpoint:
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test 2: Run Diagnostic Script
```bash
cd backend1
node diagnose-auth.js
```

This will check:
- ✅ JWT_SECRET is configured
- ✅ Token generation works
- ✅ Token verification works
- ✅ MongoDB connection works

### Test 3: Verify Token Format
```javascript
// In browser console
const parts = localStorage.getItem('token')?.split('.');
console.log('Header:', JSON.parse(atob(parts[0]))); // Should show alg, typ
console.log('Payload:', JSON.parse(atob(parts[1]))); // Should show id, email
```

Should output:
```javascript
Header: {alg: 'HS256', typ: 'JWT'}
Payload: {id: '64abc...', email: 'admin@ischkul.com', iat: 1705598400, exp: 1706203200}
```

---

## 🚀 Complete Reset Procedure

If everything is messed up, do a complete reset:

**Frontend:**
```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
window.location.href = '/login';
```

**Backend:**
```bash
cd backend1
# Stop the server (Ctrl+C)

# Clear any stale processes
pkill -f "node server"

# Remove any lock files
rm -f .env.local

# Restart
npm run dev
```

**MongoDB:**
```bash
# Verify it's running
mongosh mongodb://localhost:27017/ischkul

# Create fresh super admin
node create-superadmin.js

# Should output a new JWT token you can use for testing
```

---

## 📊 Debugging Checklist

- [ ] Token exists in localStorage (check with `localStorage.getItem('token')`)
- [ ] Token starts with `"eyJ"` (valid JWT format)
- [ ] Token is not empty, not null, not corrupted
- [ ] MongoDB is running and accessible
- [ ] JWT_SECRET is set in `.env` file
- [ ] Backend server is running (`npm run dev`)
- [ ] Browser console shows detailed logs (check F12)
- [ ] Backend terminal shows auth middleware logs
- [ ] Try visiting `http://localhost:5000/api/documents/696ce26f3576633b05af40ec` directly (will show 401 but with error details)

---

## 🆘 Still Having Issues?

**Collect this information:**
1. Browser console output (F12)
2. Backend terminal output (when request is made)
3. Token value (first 50 chars): `localStorage.getItem('token')?.substring(0, 50)`
4. MongoDB status: `mongosh mongodb://localhost:27017/ischkul`
5. .env file contents (JWT_SECRET and MONGODB_URI values - mask sensitive info)

Then:
1. Run `node diagnose-auth.js` in backend folder
2. Share the complete output from all 5 sources

This will provide enough information to pinpoint the exact issue.
