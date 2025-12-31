# Security: ischkul-azure

## Overview

ischkul-azure implements **defense-in-depth** security across all layers: authentication, data protection, AI governance, and audit logging.

---
# 
## Authentication & Authorization

### JWT-Based Authentication

**Login Flow**:
```
POST /auth/login { email, password }
  ↓
Lookup user in Cosmos DB
  ↓
Verify password (bcryptjs.compare)
  ↓
Issue JWT: jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" })
  ↓
Client stores token (localStorage or sessionStorage)
  ↓
Subsequent requests: Authorization: Bearer <token>
```

**Token Payload** (keep minimal):
```json
{
  "userId": "ObjectId",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234654290
}
```

**JWT Secret**:
- Generated during provisioning: `openssl rand -hex 32`
- Stored in `backend/.env` (never committed)
- Rotated on security incidents

### Middleware Token Verification

```javascript
// Future: Create middleware/auth.js
async function verifyToken(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error("Unauthorized");
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded; // { userId, email }
}
```

---

## Password Security

### Hashing Strategy

- **Algorithm**: bcryptjs (not plain bcrypt due to Windows compatibility)
- **Cost Factor**: 10 (balance between security & performance)
- **Salt**: Auto-generated per password

**Implementation**:
```javascript
const bcrypt = require("bcryptjs");

// On registration/password change:
const hashedPassword = await bcrypt.hash(password, 10);
await db.users.insertOne({ email, password: hashedPassword, ... });

// On login:
const isMatch = await bcrypt.compare(inputPassword, storedHash);
```

---

## Data Protection

### Encryption at Rest

| Data | Method | Managed By |
|------|--------|-----------|
| Passwords | bcryptjs | Application |
| Cosmos DB | TDE (Transparent Data Encryption) | Azure |
| Blob Storage | Server-side encryption (AES-256) | Azure |
| Transit | TLS 1.2+ | Azure Functions + Static Web Apps |

### Encryption in Transit

- **HTTPS Only**: Enforced by Azure Static Web Apps
- **TLS 1.2+**: All Azure services (Functions, Cosmos, Blob, Search)
- **Certificate Management**: Auto-renewed by Azure (*.azurewebsites.net)

---

## File Storage Security

### Blob Storage Access Control

**Container Policy**:
```
PUT /uploads → Private (no anonymous access)
```

**Secure Access Pattern**:
1. User requests file via API
2. Backend generates **SAS token** (Shared Access Signature)
3. Token includes:
   - Expiration: 15 minutes (configurable)
   - Permissions: Read-only
   - Resource: Specific blob
4. Client receives signed URL: `https://{account}.blob.core.windows.net/{path}?sig=...&se=2025-12-29T11:00:00Z`
5. URL can be safely shared; expires after time limit

**Implementation**:
```javascript
const { BlobSasPermissions, generateBlobSasUrl } = require("@azure/storage-blob");

async function getSecureDownloadUrl(containerName, blobName) {
  const sasUrl = await generateBlobSasUrl(
    containerName,
    blobName,
    {
      permissions: BlobSasPermissions.parse("r"),
      expiresOn: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    },
    accountName,
    accountKey
  );
  return sasUrl;
}
```

---

## Database Security

### Cosmos DB (MongoDB API)

**Network Security**:
- IP firewall: Restrict to Azure Functions subnet (future)
- Virtual networks: Not exposed to internet

**Authentication**:
- Connection string in `local.settings.json`
- Never logged or exposed in error messages
- Rotated via Azure Key Vault (future enhancement)

**Query Injection Prevention**:
- MongoDB driver escapes all parameters
- Use parameterized queries (not string concatenation)

```javascript
// ❌ WRONG
const user = await db.collection("users").findOne({
  email: userInput // Risk of injection
});

// ✅ CORRECT
const user = await db.collection("users").findOne({
  email: sanitizeEmail(userInput) // Or: use schema validation
});
```

### Indexes & Performance

Indexes reduce query time and minimize compute:
```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.groups.createIndex({ adminUserId: 1 });
db.messages.createIndex({ groupId: 1, createdAt: -1 });
```

---

## API Security

### Rate Limiting (Future)

```javascript
// Recommended: express-rate-limit
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  keyGenerator: (req) => req.user.userId, // Per user
});

app.use("/api/", limiter);
```

### Input Validation

```javascript
// Example: Quiz generation endpoint
const { text, numQuestions = 10, createdBy } = req.body;

// Validation
if (!text || text.length > 50000) {
  return res.status(400).json({ error: "text must be 1-50000 chars" });
}
if (!createdBy) {
  return res.status(400).json({ error: "createdBy required" });
}
if (typeof numQuestions !== "number" || numQuestions < 1 || numQuestions > 50) {
  return res.status(400).json({ error: "numQuestions must be 1-50" });
}
```

### CORS Configuration

```javascript
// Enable only trusted origins
const cors = require("cors");

app.use(cors({
  origin: [
    "https://ischkul.azurewebsites.net",
    "https://ischkul-dev.azurewebsites.net",
    // Dev: "http://localhost:5173"
  ],
  credentials: true,
}));
```

---

## AI Safety & Responsible AI

### System Prompts with Constraints

**Quiz Generator**:
```
"You are an educational assistant from a Nigerian University.

STRICT CONSTRAINTS:
1. Generate questions ONLY from the provided text
2. Forbid discriminatory, hateful, or non-educational content
3. Ensure cultural sensitivity and inclusivity
4. Never create trick questions
5. Return ONLY valid JSON

If you cannot generate a question, skip it and note in metadata."
```

**Co-Reader**:
```
"You are a tutor helping students understand course material.

CONSTRAINTS:
1. Answer based ONLY on provided document chunks
2. If information is not in the document, state: 
   'This information is not in the provided material.'
3. Provide citations: 'Source: chunk_id_X'
4. Be encouraging and inclusive
5. Report any unsafe requests to the logging system"
```

### Content Filtering & Flagging

**Flagging Logic**:
```javascript
function shouldFlagResponse(response, model = "gpt-4o") {
  const redFlags = [
    /discriminat|racist|sexist|hate/i,
    /violence|harm|attack/i,
    /explicit|nsfw|pornograph/i,
  ];
  
  return redFlags.some(flag => flag.test(response));
}

// In function handler:
if (shouldFlagResponse(quizData)) {
  // Insert into activities for human review
  await activitiesCollection.insertOne({
    type: "ai.flagged-output",
    quizId,
    model,
    flaggedContent: quizData.substring(0, 500),
    timestamp: new Date(),
    status: "pending-review",
  });
  
  return res.status(202).json({
    message: "Quiz generated but flagged for review. Check back later.",
  });
}
```

### Audit Logging for AI Outputs

```javascript
// Log all AI-generated content for audit
await activitiesCollection.insertOne({
  userId: createdBy,
  type: "ai.content-generated",
  model: "gpt-4o",
  meta: {
    quizId,
    numQuestions: 10,
    inputLength: text.length,
    outputTokens: response.usage.completion_tokens,
    flagged: false,
  },
  createdAt: new Date(),
});
```

---

## Environment & Secrets Management

### Sensitive Values (Never Committed)

```bash
# ❌ NEVER COMMIT TO GIT
AZURE_OPENAI_API_KEY=sk-...
JWT_SECRET=...
COSMOS_MONGO_CONN=mongodb+srv://user:pass@...
BLOB_STORAGE_CONN=DefaultEndpointsProtocol=https;...
```

### Best Practices

1. **Local Development**:
   - Use `backend/local.settings.json` (git-ignored)
   - Use `.env` file (git-ignored; template: `.env.example`)

2. **Production**:
   - Use **Azure Key Vault**:
     ```bash
     az keyvault create --name ischkul-vault --resource-group ischkul-rg
     az keyvault secret set --name JwtSecret --value <value> --vault-name ischkul-vault
     ```
   - Reference in Functions app via managed identity

3. **Rotation**:
   - Rotate JWT_SECRET annually or on breach
   - Rotate storage keys quarterly
   - Cosmos DB keys: As needed

---

## Error Handling & Information Disclosure

### Generic Error Messages

**To User**:
```javascript
// ✅ Generic, safe
res.status(500).json({ error: "Internal server error" });

// ❌ Information leakage
res.status(500).json({ error: `Cosmos DB connection failed: ${error.message}` });
```

**Internal Logging**:
```javascript
// Log details server-side (to Application Insights / activities)
context.log("ERROR", {
  type: "db.connection-failed",
  service: "cosmos",
  error: error.message,
  stack: error.stack,
  userId: req.user?.id,
  timestamp: new Date(),
});
```

---

## Logging & Audit Trail

### Event Logging

All significant events logged to `activities` collection:

```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "type": "quiz.submitted|message.sent|file.uploaded|ai.flagged-output",
  "meta": {
    "quizId": ObjectId,
    "score": 85,
    "groupId": ObjectId,
    "error": null
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "createdAt": ISODate,
  "status": "success|flagged|error"
}
```

### Retention Policy

```javascript
// Auto-delete activities after 365 days (for privacy)
db.activities.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 31536000 } // 365 days
);

// Except: flagged content (retained for compliance)
// filtered by: { type: { $ne: "ai.flagged-output" } }
```

---

## Compliance & Standards

### GDPR Readiness

- [x] **Right to Access**: User can export their data (future API: `/user/export`)
- [x] **Right to Delete**: Implement soft delete with cascade (future)
- [x] **Data Minimization**: Only collect necessary fields
- [x] **Audit Trail**: All changes logged in activities collection

### Nigerian Data Protection Laws

- [x] Consent mechanism (future: privacy settings)
- [x] Local data residency option (Europe: westeurope, Asia: southeastasia)
- [x] Breach notification plan (document in incident response playbook)

---

## Incident Response Plan

### Data Breach

1. **Immediate** (0-1 hour):
   - Isolate affected resources (disable API access)
   - Notify security team

2. **Short-term** (1-24 hours):
   - Investigate scope (affected users, data types)
   - Preserve logs (activities collection)
   - Notify affected users (required by law)

3. **Recovery**:
   - Rotate all secrets (JWT_SECRET, storage keys, API keys)
   - Patch vulnerability
   - Restore from backup if necessary

### DDoS / Rate Limiting Attack

- Azure DDoS Protection: Standard tier (automatic)
- Enforce rate limiting: 100 req/user/15min
- Throttle heavy operations (quiz generation: 1/min)

---

## Security Checklist (Pre-Deployment)

- [ ] All environment variables set (no defaults in code)
- [ ] JWT_SECRET generated and randomized
- [ ] HTTPS enforced (Azure Static Web Apps automatic)
- [ ] Blob Storage containers set to private
- [ ] Cosmos DB firewall configured (IP whitelist)
- [ ] CORS origins restricted to trusted domains
- [ ] Input validation on all endpoints
- [ ] Error messages are generic (no stack traces exposed)
- [ ] Logging includes user context and timestamps
- [ ] AI outputs logged for audit
- [ ] Content flagging mechanism tested
- [ ] Rate limiting deployed
- [ ] Secrets rotated
- [ ] Backups configured and tested

---

## References

- [OWASP Top 10](https://owasp.org/Top10/)
- [Azure Security Best Practices](https://learn.microsoft.com/azure/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Responsible AI (Microsoft)](https://www.microsoft.com/responsible-ai)
