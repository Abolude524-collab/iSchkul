# JWT & Auth Flow Visualization

## 🔄 Complete Authentication Flow

```
User Browser                          Backend Server                    Database
────────────                          ──────────────                    ────────

     │                                     │                               │
     ├─ 1. Enter credentials              │                               │
     │  (email + password)                 │                               │
     │                                     │                               │
     └─────────────────────────────────────> POST /api/auth/login         │
                                          │                               │
                                          ├─ Hash password & compare      │
                                          │                               │
                                          ├─ Generate JWT token           │
                                          │  jwt.sign({id, email}, secret)│
                                          │                               │
     <─────────────────────────────────────── Return token               │
     │ (stored in localStorage)           │                               │
     │                                     │                               │
     ├─ 2. Fetch with token              │                               │
     │  Authorization: Bearer TOKEN       │                               │
     │                                     │                               │
     └─────────────────────────────────────> GET /api/documents/:id       │
                                          │                               │
                                          ├─ Extract token from header    │
                                          ├─ Verify JWT signature        │
                                          │ (using JWT_SECRET)            │
                                          │                               │
                                          │ ✅ Signature valid           │
                                          │ (Secret matches = request OK) │
                                          │                               │
                                          ├─ Extract user ID from token  │
                                          │                               │
                                          ├─ Query database              │
                                          └───────────────────────────────> SELECT * FROM users
                                          │   WHERE _id = decoded.id      │
                                          │                      <────────┤
                                          │     User found: admin@...     │
     <─────────────────────────────────────── Return document metadata    │
     │                                     │                               │
     ✅ Request successful!               │                               │
```

---

## 🔐 Where 401 Errors Happen

```
Authentication Decision Tree
──────────────────────────

Request arrives at backend
        │
        ├─ 1. Authorization Header Present?
        │   NO  ──────> ❌ 401 "No token provided"
        │   YES │
        │       ├─ 2. Token Format Valid? (starts with "eyJ")
        │       │   NO  ──────> ❌ 401 "jwt malformed"
        │       │   YES │
        │       │       ├─ 3. JWT Signature Valid? (secret matches)
        │       │       │   NO  ──────> ❌ 401 "invalid signature"
        │       │       │   YES │
        │       │       │       ├─ 4. Token Expired?
        │       │       │       │   YES ──────> ❌ 401 "token expired"
        │       │       │       │   NO  │
        │       │       │       │       ├─ 5. User in Database?
        │       │       │       │       │   NO  ──────> ❌ 401 "user not found"
        │       │       │       │       │   YES │
        │       │       │       │       │       ├─ ✅ 200 OK
        │       │       │       │       │       ├─ Request passes!
```

---

## 🧩 JWT Token Structure

A JWT token has 3 parts separated by dots:

```
Header.Payload.Signature
├─────┬─────┬───────┘
│     │     └─ HMAC signature (ensures token wasn't tampered)
│     │        Created with: HMAC-SHA256(header+payload, JWT_SECRET)
│     │        Only server knows JWT_SECRET
│     │
│     └─ Payload (the data)
│        Base64 encoded: {"id": "user123", "email": "admin@..."}
│        Can be decoded but NOT encrypted
│        Expiry time is also here
│
└─ Header (metadata)
   Base64 encoded: {"alg": "HS256", "typ": "JWT"}
   Just tells you it's using HMAC-SHA256
```

### Example Token Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0YWJjZDEyMzQ1NjciLCJlbWFpbCI6ImFkbWluQGlzY2hrdWwuY29tIiwiaWF0IjoxNzA1NjAwMDAwLCJleHAiOjE3MDYyMDUwMDB9.5f1qL2xN3pK9_X8vY6jZ_A
└─ Header                                          └─ Payload                                                                           └─ Signature
 
Decoded Header:
{
  "alg": "HS256",      ← Algorithm
  "typ": "JWT"         ← Type
}

Decoded Payload:
{
  "id": "64abcd123456",         ← User ID
  "email": "admin@ischkul.com", ← Email
  "iat": 1705600000,            ← Issued At (when created)
  "exp": 1706205000             ← Expiration (7 days later)
}

Signature:
- Created by: HMAC-SHA256(header+payload, JWT_SECRET)
- Verified by: HMAC-SHA256(header+payload, JWT_SECRET) == received_signature
- If mismatch: Someone tampered with the token OR wrong JWT_SECRET
```

---

## 🚨 Common 401 Scenarios & Fixes

### Scenario 1: Token Missing
```
Browser Console:
  localStorage.getItem('token') → null

Backend Console:
  🔐 Auth middleware - Authorization header: ✗ Missing
  ❌ Access denied. No token provided.

Fix:
  1. User not logged in
  2. Login at /login
  3. Token should be saved to localStorage
```

### Scenario 2: Token Malformed
```
Browser Console:
  localStorage.getItem('token') → "Bearer sometext" (wrong format!)
  token.startsWith('eyJ') → false

Backend Console:
  🔑 Token extracted - Length: 0
  ❌ JsonWebTokenError: jwt malformed

Possible Causes:
  - Double "Bearer" prefix: "Bearer Bearer eyJ..."
  - Extra spaces or newlines
  - Token got truncated
  - Corrupted data in localStorage

Fix:
  1. localStorage.clear()
  2. window.location.reload()
  3. Login again at /login
```

### Scenario 3: Token Expired
```
Backend Console:
  ✅ JWT verified successfully (passes decode check)
  ❌ JsonWebTokenError: token expired

Backend shows: exp: 1706205000 (past timestamp)

Fix:
  1. Token automatically invalid after 7 days
  2. User must login again
  3. New token issued with new expiry
```

### Scenario 4: Wrong JWT_SECRET
```
Backend Console:
  ✅ JWT format valid
  ❌ JsonWebTokenError: invalid signature

Why:
  - Token created with SECRET_A
  - Backend trying to verify with SECRET_B
  - Signature doesn't match

Fix:
  1. Check .env file: JWT_SECRET=???
  2. Must be SAME in all places
  3. Restart backend after changing
  4. Re-login to get new token
```

### Scenario 5: User Deleted
```
Backend Console:
  ✅ JWT signature valid
  ✅ User ID extracted correctly
  ❌ User not found in database

Why:
  - User was deleted from MongoDB
  - Token still valid but user gone
  - Can't set req.user

Fix:
  1. Recreate user: node create-superadmin.js
  2. Or create new user via signup
  3. Login with new credentials
```

---

## 🔍 Debugging Flowchart

```
Getting 401 error?

    ↓
Does browser console show:
    📄 Loading document: ...?
    
    NO  ──> Page not loading CoReaderPage
           Check: Is user logged in? 
           Go to /login and try again
    
    YES ↓
    
    Does it show:
    🔑 Token exists: true?
    
    NO  ──> Token not in localStorage
           SOLUTION: Login again
           localStorage.clear(); window.location.reload();
    
    YES ↓
    
    Does it show:
    🔑 Token starts with "eyJ": true?
    
    NO  ──> Token is corrupted/malformed
           SOLUTION: Same as above
    
    YES ↓
    
    Does it show:
    📡 Response status: 200?
    
    NO  ──> Got error status (401/403/500)
    YES ──> Check the error message!
    
    Check backend console for:
    🔐 Auth middleware - Authorization header: ✓ Present?
    
    NO  ──> Auth header not sent from frontend
           Check: fetch includes Authorization header?
    
    YES ↓
    
    🔑 Valid JWT format: true?
    
    NO  ──> Token format wrong (not real JWT)
    YES ↓
    
    ✅ JWT verified successfully?
    
    NO  ──> JWT signature invalid or expired
           Check: JWT_SECRET matches in .env?
    
    YES ↓
    
    ✅ User authenticated?
    
    NO  ──> User not found in MongoDB
           Check: Is MongoDB running?
           Check: Was user created?
    
    YES ↓
    
    ✅ Everything working!
       If you're still seeing 401,
       run: node diagnose-auth.js
```

---

## 📝 Quick Reference

| Error | Cause | Fix |
|-------|-------|-----|
| 🔴 No token provided | Token not sent | Add `Authorization` header |
| 🔴 jwt malformed | Token format wrong | Clear localStorage, re-login |
| 🔴 invalid signature | JWT_SECRET mismatch | Check .env, restart backend |
| 🔴 token expired | Token > 7 days old | User must login again |
| 🔴 User not found | User deleted from DB | Create user, login again |
| 🔴 Cannot connect | Backend not running | `npm run dev` in backend1 folder |
| 🔴 MongoDB timeout | DB not running | Start MongoDB service |

---

## 🧪 Test Checklist

Use these commands to isolate the issue:

```bash
# 1. Backend running?
curl http://localhost:5000/api/health
# Expect: 200 OK

# 2. Login works?
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ischkul.com","password":"admin123"}'
# Expect: 200 + token in response

# 3. Token verification works?
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Expect: 200 + user data

# 4. Document endpoint works?
curl -X GET http://localhost:5000/api/documents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
# Expect: 200 + documents list
```

---

## 🎯 Summary

The **401 Unauthorized** error means authentication failed. Use:

1. **Browser console logs** (F12 → Console) to see frontend status
2. **Backend logs** (`npm run dev` terminal) to see backend status
3. **Diagnostic script** (`node diagnose-auth.js`) to test components
4. **Flow test** (`node test-document-flow.js`) to test complete flow

Most common fix: **Clear localStorage and re-login**
```javascript
localStorage.clear(); window.location.reload();
```
