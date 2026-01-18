# XP Leaderboard Sync - Complete Fix Guide

## Problem Summary

Users' XP in the database was not syncing to the leaderboard display. For example, a user had 210 XP in the database but the leaderboard showed outdated values.

## Root Causes Identified

### Issue 1: XP Award Function Not Called Properly in Quiz Submission
**Location**: `backend1/routes/quizzes.js` - `/submit` endpoint  
**Problem**: The `awardXp` function was called via `req.app.locals.awardXp()` but:
- Function wasn't being passed the `xpAmount` parameter
- No fallback if app.locals wasn't available
- XP logs weren't being created, so SOTW calculation had no data

**Fixed**: 
- Added both `app.locals.awardXp()` call AND fallback direct XP update
- Now creates XpLog entry AND updates User.xp directly
- Handles both success and fallback paths with detailed logging

### Issue 2: SOTW Award Based on XP Logs, Not User.xp
**Location**: `backend1/routes/sotw.js` - `/current` endpoint  
**Problem**: SOTW winner calculation uses XP logs aggregation:
```javascript
{ $match: { timestamp: { $gte: start, $lte: end } } },
{ $group: { _id: '$user_id', weekly_score: { $sum: '$xp_earned' } } }
```
If XP logs aren't created during quiz submission, SOTW won't include that user.

**Fixed**: 
- Quiz submission now creates XpLog entries as fallback
- SOTW calculation will now find all users who earned XP

### Issue 3: Leaderboard Data Should Be Current (Not a Real Issue)
**Analysis**: The leaderboard endpoint in `backend1/routes/leaderboard.js` correctly:
- Fetches users from database with `User.find()`
- Sorts by current `user.xp` value
- Should show real-time data

**Conclusion**: If XP wasn't showing, it's because User.xp wasn't being updated (Issue #1)

## Solutions Implemented

### 1. Enhanced Quiz XP Award Logic
**File**: `backend1/routes/quizzes.js`

Added dual-path XP awarding:
```javascript
// Method 1: Try using app.locals.awardXp if available
if (req.app && req.app.locals && typeof req.app.locals.awardXp === 'function') {
  const xpResult = await req.app.locals.awardXp(String(req.user._id), 'QUIZ_COMPLETE', xpAmount);
} else {
  // Method 2: Fallback - direct update + XP log creation
  await XpLog.create({ userId, xpEarned: xpAmount, ... });
  await User.findByIdAndUpdate(userId, { $inc: { xp: xpAmount } });
}
```

**Benefits**:
- Ensures XP is always awarded even if app.locals not set up
- Creates XpLog entries for SOTW calculation
- Updates User.xp immediately for leaderboard display
- Comprehensive error logging for debugging

### 2. Admin Tools for XP Sync
**File**: `backend1/routes/admin.js`

Added four new admin endpoints:

#### `POST /api/admin/sync-xp`
Sync a single user's XP with their XP logs:
```bash
curl -X POST http://localhost:5000/api/admin/sync-xp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID_HERE"}'
```

#### `POST /api/admin/sync-all-xp`
Sync ALL users' XP with their XP logs:
```bash
curl -X POST http://localhost:5000/api/admin/sync-all-xp \
  -H "Authorization: Bearer <token>"
```

Returns list of users who were synced with their XP changes.

#### `POST /api/admin/recalculate-sotw`
Force recalculate Student of the Week:
```bash
curl -X POST http://localhost:5000/api/admin/recalculate-sotw \
  -H "Authorization: Bearer <token>"
```

Finds top XP earner from XP logs and updates WeeklyWinner record.

#### `GET /api/admin/xp-debug/:userId`
Debug XP sync for specific user:
```bash
curl -X GET http://localhost:5000/api/admin/xp-debug/USER_ID_HERE \
  -H "Authorization: Bearer <token>"
```

Returns:
- User's current XP and level
- XP log count and total
- Discrepancy between User.xp and XP logs total
- `needsSync: true/false` indicator

### 3. Diagnostic Scripts

#### `backend1/diagnose_xp_sync.js`
Run to check XP sync for a specific user:
```bash
cd backend1
node diagnose_xp_sync.js 507f1f77bcf86cd799439011
```

Outputs:
- User's current XP and level
- XP logs (last 20)
- Quiz results (last 10)
- Expected vs actual XP
- Leaderboard position
- Issues detected

#### `backend1/check_sotw_winner.js`
Check Student of the Week calculation:
```bash
cd backend1
node check_sotw_winner.js
```

Outputs:
- Top 10 users by XP (this week)
- Top 5 users by XP (last week)
- Weekly winner records
- Comparison between calculated winner and stored records

## Quick Fix Steps for User with 210 XP

### Option 1: Use Admin Endpoint (Recommended)
```bash
# Get user ID from database or logs
# Then sync their XP:
curl -X POST http://localhost:5000/api/admin/sync-xp \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID"}'

# Or sync all users:
curl -X POST http://localhost:5000/api/admin/sync-all-xp \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Option 2: Manual Database Check
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/ischkul

# Check user XP
db.users.findOne({name: "User Name"})
# Look for: xp: 210, xp_count: 0 (stale) vs xp: 0, xp_logs: 210 (out of sync)

# Check XP logs for this user
db.xpLogs.find({userId: ObjectId("USER_ID")})

# Manually update if needed:
db.users.updateOne(
  {_id: ObjectId("USER_ID")},
  {$set: {xp: 210}}
)
```

## Testing the Fix

### 1. Test Quiz Submission XP Award
1. User submits a quiz with score ≥ 60%
2. Check backend logs for: `[submitQuiz] XP awarded via ...`
3. Check database:
   - `db.xpLogs.findOne({...})` should have new entry
   - `db.users.findOne({})` should show increased xp
4. Frontend leaderboard should update within 10 seconds

### 2. Test Leaderboard Sync
1. User gets awarded XP
2. Visit leaderboard page: `/leaderboard`
3. User's rank and XP should be current
4. If stale, use `POST /api/admin/sync-xp` to refresh

### 3. Test SOTW Calculation
1. Multiple users take quizzes during the same week
2. Call `POST /api/admin/recalculate-sotw`
3. Check response for correct winner
4. Verify `weeklyWinners` collection has entry

## Architecture Notes

### XP Flow (Fixed)
```
Quiz Submission (/submit endpoint)
├─ Calculate score
├─ Save QuizResult
└─ Award XP
   ├─ Create XpLog entry (with activityType: 'QUIZ_COMPLETE')
   └─ Update User.xp with $inc: { xp: amount }
     └─ User immediately appears on leaderboard

Leaderboard (/active endpoint)
├─ Fetch active leaderboard record
├─ Find all non-admin users
├─ Sort by User.xp descending
└─ Return top 50 with rankings

SOTW (/current endpoint)  
├─ Find XP logs for last week
├─ Group by userId and sum xpEarned
├─ Find user with highest total
├─ Create WeeklyWinner record
└─ Increment user.sotwWinCount
```

### Data Consistency Strategy
- **Source of truth for current XP**: `users.xp` field
- **Audit trail**: `xpLogs` collection (for SOTW, history, debugging)
- **Admin sync tool**: Can reconcile User.xp with XpLog totals if discrepancy occurs

## Prevention for Future

1. **Always log XP activities**: Every XP award creates an XpLog entry
2. **Validate on save**: Backend validates User.xp > 0 when saving results
3. **Weekly audit**: Run `node check_leaderboard.js` (if exists) or use `/api/admin/xp-debug` endpoint
4. **Monitor logs**: Watch backend console for `[submitQuiz] XP award error:` messages

## Files Modified

1. **backend1/routes/quizzes.js**
   - Enhanced XP award logic with dual-path approach
   - Added XpLog import
   - Added comprehensive logging

2. **backend1/routes/admin.js**
   - Added XpLog and WeeklyWinner imports
   - Added 4 new admin endpoints for XP sync/debug

3. **New diagnostic scripts**
   - `backend1/diagnose_xp_sync.js` - User XP diagnostic
   - `backend1/check_sotw_winner.js` - SOTW verification

## Support Commands

### For Users Experiencing XP Not Showing
```bash
# 1. Check if their XP is in database
curl -X GET http://localhost:5000/api/admin/xp-debug/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 2. If discrepancy detected, sync their XP
curl -X POST http://localhost:5000/api/admin/sync-xp \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID"}'

# 3. User refreshes leaderboard page - should show updated XP
```

### For SOTW Not Awarding Correctly
```bash
# 1. Check current week's top users
node backend1/check_sotw_winner.js

# 2. Recalculate if needed
curl -X POST http://localhost:5000/api/admin/recalculate-sotw \
  -H "Authorization: Bearer ADMIN_TOKEN"

# 3. Verify result matches expected winner
```

## Next Steps

1. **Test the fixes**: Have users submit quizzes and verify XP updates
2. **Monitor logs**: Watch for any errors in XP award process
3. **Run diagnostics**: Use admin endpoints to verify data consistency
4. **Schedule weekly audit**: Consider adding a cron job to check leaderboard integrity
5. **Set up alerts**: Monitor for XP award errors and data discrepancies
