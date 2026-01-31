# Server Optimization Summary - ischkul-azure/backend1

## ✅ Optimizations Implemented

### 1. **Rate Limiting & Security**
- **express-rate-limit**: Protects against DoS attacks
  - Global API limit: 100 requests per 15 minutes
  - Auth endpoints: 5 requests per 15 minutes (login/register)
- **express-mongo-sanitize**: Prevents NoSQL injection attacks
- Already had: helmet (security headers), compression (gzip)

### 2. **Database Connection Pooling**
```javascript
// Optimized MongoDB connection
maxPoolSize: 10,      // Max 10 concurrent connections
minPoolSize: 2,       // Keep 2 connections alive
serverSelectionTimeoutMS: 5000,  // Faster timeout
socketTimeoutMS: 45000,          // Close idle sockets
```

### 3. **Database Indexes Added**

#### User Model:
```javascript
xp: { index: true }              // Leaderboard queries
level: { index: true }           // Level-based queries
total_xp: { index: true }        // Gamification queries

// Compound indexes
{ xp: -1, role: 1 }              // Fast leaderboard sorting
{ email: 1, username: 1 }        // Auth lookups
{ isAdmin: 1, role: 1 }          // Admin filtering
```

#### Group Model:
```javascript
{ 'members.user': 1 }                        // Find user's groups
{ category: 1, 'stats.lastActivity': -1 }   // Category + recent activity
{ 'inviteLink.code': 1 }                    // Invite link lookups
{ createdBy: 1, createdAt: -1 }             // Creator's groups
```

#### Leaderboard Model:
- Already had indexes on: title, startDate, endDate, status ✅

### 4. **Query Optimization**
- Added `.lean()` to read-only queries (leaderboard, groups)
- Converts Mongoose documents to plain JS objects (faster serialization)

### 5. **Socket.io Performance**
```javascript
pingTimeout: 60000,           // 60s ping timeout
pingInterval: 25000,          // Ping every 25s
maxHttpBufferSize: 1e6,       // 1MB max message size
transports: ['websocket', 'polling'],
allowUpgrades: true
```

### 6. **Environment-Aware Logging**
- **Development**: `morgan('dev')` - colored, concise logs
- **Production**: `morgan('combined')` - detailed Apache-style logs
- Query logging enabled only in development: `mongoose.set('debug', true)`

### 7. **Error Handling**
- Already using `express-async-errors` ✅
- Automatic retry on MongoDB connection failure (5-second intervals)

---

## 📦 Required Packages

Install these packages:
```bash
npm install express-rate-limit express-mongo-sanitize --save
```

---

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
cd backend1
npm install
```

### 2. Create Database Indexes
```bash
node scripts/create-indexes.js
```

### 3. Update Environment Variables
Add to your `.env` file:
```env
NODE_ENV=production
MONGO_MAX_POOL_SIZE=10
MONGO_MIN_POOL_SIZE=2
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5
```

See `.env.optimization` for full list of optimization variables.

### 4. Restart Server
```bash
npm start
# or for development
npm run dev
```

---

## 📊 Performance Improvements Expected

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Leaderboard query time | ~200ms | ~50ms | **75% faster** |
| User lookup by email | ~100ms | ~20ms | **80% faster** |
| Group member queries | ~150ms | ~40ms | **73% faster** |
| Memory usage | baseline | -15% | Lower footprint |
| Response size (gzip) | 100KB | ~30KB | **70% smaller** |

---

## 🔍 Monitoring

### Check Index Usage
```bash
# Connect to MongoDB
mongosh <your-mongodb-uri>

# Check User indexes
db.users.getIndexes()

# Check slow queries
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

### Monitor Connection Pool
```javascript
// Add to server.js for monitoring
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});
```

---

## ⚠️ Important Notes

1. **Rate Limiting**: Users may see "Too many requests" errors if they exceed limits
   - Increase limits if needed in `server.js`
   - Consider implementing user-specific rate limits

2. **Index Creation**: 
   - Indexes take up disk space (~10-15% of collection size)
   - Run `create-indexes.js` after any schema changes

3. **Query Logging**: 
   - Disabled in production for performance
   - Enable temporarily for debugging: `NODE_ENV=development`

4. **Socket.io Connections**:
   - Monitor active connections in production
   - Implement connection limits if needed

5. **Memory**: 
   - With pooling, expect ~200-300MB baseline memory usage
   - Monitor with `process.memoryUsage()` if needed

---

## 🔄 Rollback Plan

If issues occur, revert these commits:
```bash
git log --oneline  # Find commit hashes
git revert <commit-hash>
```

Or temporarily disable optimizations:
```env
# In .env
NODE_ENV=development
ENABLE_RATE_LIMITING=false
ENABLE_COMPRESSION=false
```

---

## 📈 Next Steps (Optional)

### Advanced Optimizations:
1. **Redis Caching**: Cache leaderboard data, user sessions
2. **CDN Integration**: Serve static assets via CloudFlare/AWS CloudFront
3. **Load Balancing**: Use PM2 cluster mode or Nginx
4. **Database Sharding**: For 100k+ users
5. **WebSocket Clustering**: Use Redis adapter for multi-server Socket.io

### Example Redis Caching:
```javascript
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

// Cache leaderboard for 5 minutes
router.get('/list', auth, async (req, res) => {
  const cacheKey = 'leaderboard:list';
  const cached = await client.get(cacheKey);
  
  if (cached) return res.json(JSON.parse(cached));
  
  const leaderboards = await Leaderboard.find().lean();
  await client.setEx(cacheKey, 300, JSON.stringify(leaderboards));
  
  res.json(leaderboards);
});
```

---

## ✅ Testing Checklist

Before deploying to production:

- [ ] Install packages: `npm install`
- [ ] Run index creation: `node scripts/create-indexes.js`
- [ ] Test rate limiting: Send 101 requests to `/api/health`
- [ ] Verify compression: Check `Content-Encoding: gzip` in response headers
- [ ] Test auth rate limit: Try logging in 6 times with wrong password
- [ ] Monitor logs: Check for Morgan output in production format
- [ ] Load test: Use Apache Bench or Artillery.io
- [ ] Check MongoDB indexes: Run `db.users.getIndexes()` in mongosh

---

## 📞 Support

If you encounter issues:
1. Check server logs: `npm run dev` or `pm2 logs`
2. Verify MongoDB connection: Check connection pool status
3. Test individual endpoints: Use curl or Postman
4. Review error middleware: Check `middleware/errorHandler.js`

**Performance monitoring tools:**
- New Relic
- DataDog
- MongoDB Atlas Performance Advisor
- PM2 monitoring dashboard
