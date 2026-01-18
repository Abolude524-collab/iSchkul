# 401 Error - Understanding & Resolution

## 🎯 What's Happening

Your frontend tried to fetch document metadata:
```
GET http://localhost:5000/api/documents/696ce26f3576633b05af40ec
Status: 401 Unauthorized
```

The backend **auth middleware rejected the request** because:
- ❌ Token is missing from the request
- ❌ Token is malformed (corrupted)
- ❌ Token expired
- ❌ JWT signature doesn't match
- ❌ User not found in database

---

## 📡 Console Logging Added

### Frontend Logging
**File**: `frontend/src/pages/CoReaderPage.tsx`

Now shows detailed information like:
```
📄 Loading document: 696ce26f3576633b05af40ec
🔑 Token exists: true
🔑 Token length: 185
🔑 Token preview: eyJhbGciOiJIUzI1NiIsIn...
🔑 Token starts with "eyJ": true
📡 Response status: 200
✅ Document metadata received: {...}
```

**How to view**: Open browser **Developer Tools (F12)** → **Console** tab

### Backend Logging
**File**: `backend1/middleware/auth.js`

Now shows detailed auth checks:
```
🔐 Auth middleware - Authorization header: ✓ Present
🔑 Token extracted - Length: 185 Valid JWT format: true
✅ JWT verified successfully - User ID: 64abcd1234567890abcdef12
✅ User authenticated: admin@ischkul.com
```

**How to view**: Check your `npm run dev` terminal output

---

## 🔧 Immediate Action Plan

### Step 1: Restart Backend with Fresh Logs
```bash
cd backend1
npm run dev
```

Watch for the logging output when you trigger the error.

### Step 2: Check Browser Console Logs
1. Open **Developer Tools (F12)**
2. Go to **Console** tab
3. Trigger the document fetch (navigate to CoReader page)
4. Look for the `📄 Loading document` logs
5. **Take a screenshot** of what you see

### Step 3: Check Backend Logs
When the error triggers:
1. Look at your `npm run dev` terminal
2. You should see the `🔐 Auth middleware` logs
3. Note if you see `✅` (success) or `❌` (failure)

### Step 4: Run Diagnostic Script
```bash
cd backend1
node diagnose-auth.js
```

This will tell you:
- ✓ Is JWT_SECRET configured?
- ✓ Does token generation work?
- ✓ Does token verification work?
- ✓ Is MongoDB running?

### Step 5: Run Complete Flow Test
```bash
cd backend1
node test-document-flow.js
```

This will:
1. Login with admin credentials
2. Fetch your token
3. Test document listing
4. Test document metadata retrieval
5. Test document proxy service

---

## 📋 Troubleshooting Checklist

When you run into the 401 error, check these in order:

- [ ] **Backend is running**
  ```bash
  # Check: npm run dev is active in a terminal
  # If not: cd backend1 && npm run dev
  ```

- [ ] **MongoDB is running**
  ```bash
  # Test connection
  mongosh mongodb://localhost:27017/ischkul
  # If fails: Start MongoDB service or use Docker
  ```

- [ ] **Token exists in localStorage**
  ```javascript
  // Run in browser console (F12)
  localStorage.getItem('token')
  // Should show: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  // If shows null: You're not logged in. Login at /login
  ```

- [ ] **Token is valid JWT format**
  ```javascript
  // Run in browser console (F12)
  localStorage.getItem('token')?.startsWith('eyJ')
  // Should show: true
  // If shows false: Token is corrupted
  ```

- [ ] **JWT_SECRET is configured**
  ```bash
  # Check .env file in backend1 folder
  cat .env | grep JWT_SECRET
  # Should show: JWT_SECRET=your-secret-here
  ```

- [ ] **Auth middleware logs appear**
  ```bash
  # When you trigger the error, backend terminal should show:
  🔐 Auth middleware - Authorization header: ✓ Present
  # If no logs appear: Request not reaching backend
  ```

---

## 🆘 If Still Getting 401

### Option 1: Clear and Re-login
```javascript
// In browser console (F12)
localStorage.clear();
window.location.reload();
// Then login with: admin@ischkul.com / admin123
```

### Option 2: Check Error Details
Look at the backend logging output. The error message will say one of:
- `"No token provided"` → Token missing from header
- `"JWT verification failed"` → Token corrupted
- `"User not found"` → Token valid but user deleted
- `"Invalid signature"` → JWT_SECRET mismatch

### Option 3: Run Diagnostic
```bash
cd backend1
node diagnose-auth.js
```

This will test each component independently.

---

## 📊 What Each Log Means

### Frontend Logs

| Log | Meaning |
|-----|---------|
| `📄 Loading document: ID` | Started fetch |
| `🔑 Token exists: true` | Token in localStorage |
| `🔑 Token length: 185` | Token has reasonable size |
| `🔑 Token starts with "eyJ": true` | Valid JWT format |
| `📡 Response status: 200` | Server accepted request ✅ |
| `✅ Document metadata received` | Auth passed, document found ✅ |
| `❌ Document not found or no access` | Got 404 or 403 |
| `🔴 Failed to load document` | Network error or server error |

### Backend Logs

| Log | Meaning |
|-----|---------|
| `🔐 Authorization header: ✓ Present` | Frontend sent auth header ✅ |
| `🔐 Authorization header: ✗ Missing` | Frontend forgot auth header ❌ |
| `🔑 Token extracted - Length: 185` | Token parsing worked |
| `🔑 Valid JWT format: true` | Token looks like JWT |
| `✅ JWT verified successfully` | Token signature valid ✅ |
| `❌ JWT verification failed` | Token corrupted or wrong secret ❌ |
| `✅ User authenticated` | User found in DB ✅ |
| `❌ User not found in database` | Token valid but user deleted ❌ |

---

## 🧪 Quick Test Commands

### Test 1: Is Backend Running?
```bash
curl http://localhost:5000/api/health
# Should return 200
```

### Test 2: Is Auth Working?
```bash
# Get token first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ischkul.com","password":"admin123"}'

# Then use token
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Should return user info
```

### Test 3: Document Endpoint
```bash
curl -X GET http://localhost:5000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Should return list of documents
```

---

## 📚 Related Files

- **Frontend logs**: `frontend/src/pages/CoReaderPage.tsx` (lines 48-92)
- **Backend auth**: `backend1/middleware/auth.js`
- **Full guide**: `401-TROUBLESHOOTING.md`
- **Diagnostics script**: `backend1/diagnose-auth.js`
- **Flow test script**: `backend1/test-document-flow.js`

---

## 🎯 Expected Outcome

After fixing the auth issue:
1. ✅ Browser console shows `📡 Response status: 200`
2. ✅ Backend logs show `✅ User authenticated: admin@ischkul.com`
3. ✅ Document metadata loads successfully
4. ✅ PDF displays in CoReaderPage without CORS errors
5. ✅ You can ask AI questions about the PDF

---

## 🚀 Next Steps

1. **Run the diagnostic**: `node diagnose-auth.js`
2. **Check the logs**: Look for what's failing
3. **Use the troubleshooting guide**: `401-TROUBLESHOOTING.md`
4. **Test the flow**: `node test-document-flow.js`
5. **Monitor logs**: Watch `npm run dev` when making requests

Good luck! 🎉
