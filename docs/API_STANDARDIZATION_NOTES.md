# API Endpoint Construction - Best Practices & Standardization

## Current Status

### ✅ Correct Patterns (Already Fixed)
- `ChatPage.tsx` - Using `getAPIEndpoint()` function
- `AppEntryAward.tsx` - Using `getAPIEndpoint()` function  
- Most fetch calls in quiz/group/chat features

### 🟡 Works but Not Standardized
- `ForgotPasswordPage.tsx` - Using `${import.meta.env.VITE_API_URL}/api/...` directly
- `ProfilePage.tsx` - Using local `API_BASE` variable + `/api/...`
- `CoReaderPage.tsx` - Using hardcoded `localhost` (development only)

### 📋 Why Standardization Matters

**Problem with Direct Env Var Usage**:
```tsx
// ❌ NOT recommended - fails if VITE_API_URL is undefined
fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {...})

// ✅ Recommended - has fallback to localhost for development
fetch(getAPIEndpoint('/auth/forgot-password'), {...})
```

**Benefit of `getAPIEndpoint()`**:
1. Single source of truth for URL construction
2. Automatic fallback to `http://localhost:5000/api`
3. Consistent path normalization (adds `/` prefix if missing)
4. Easier to maintain if backend URL changes
5. Works both in dev and production

---

## Recommendation

Convert all direct env var fetch calls to use `getAPIEndpoint()`:

### Pages to Update:
- `ForgotPasswordPage.tsx` (Lines 26, 64)
- `ProfilePage.tsx` (Lines 44, 47, 97, 107, 140)
- `CoReaderPage.tsx` (Line 65 - should use env var, not hardcoded localhost)

### Before/After Example:

```tsx
// Before
const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/forgot-password`, {...})

// After
import { getAPIEndpoint } from '../services/api'
const response = await fetch(getAPIEndpoint('/auth/forgot-password'), {...})
```

---

## Implementation Notes

1. `getAPIEndpoint()` is already exported from [services/api.ts](frontend/src/services/api.ts)
2. It handles:
   - Removing trailing slashes from VITE_API_URL
   - Normalizing paths (adds `/` prefix if needed)
   - Falling back to `http://localhost:5000/api` for dev
3. Works with both direct API calls and axios clients

---

## Next Priority Tasks (Optional)

If you want to fully standardize the codebase:
1. Update ForgotPasswordPage to use `getAPIEndpoint()`
2. Update ProfilePage to use `getAPIEndpoint()`
3. Update CoReaderPage to use proper env var instead of hardcoded localhost
4. Run tests to verify all endpoints still work

---

## Current Session Summary

✅ **Critical Fixes Applied**:
- Fixed 2 malformed backtick fetch calls causing 404 errors
- Enhanced Socket.io CORS configuration for production
- Added missing import in AppEntryAward

🟡 **Optional Cleanup**:
- Standardize remaining fetch calls to use `getAPIEndpoint()`
- Benefits: consistency, maintainability, better dev experience

The critical production issues are now resolved. The optional cleanup would just improve code consistency.
