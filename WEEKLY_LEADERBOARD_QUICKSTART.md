# Quick Start: Weekly Leaderboard System

## TL;DR - What You Get

✅ **Autonomous Weekly Leaderboard** - Runs every 7 days automatically  
✅ **Database Backed** - Persistent across restarts  
✅ **Admin Managed** - Create custom leaderboards  
✅ **User Participation** - Students can join and compete  
✅ **Winner Tracking** - Top 3 recorded and rewarded  

## Starting the System

### 1. Ensure MongoDB is Running
```bash
# Windows
net start MongoDB

# macOS (via Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### 2. Start Backend Server
```bash
cd backend1
npm install  # If needed
npm run dev  # or: node server.js
```

**Expected Output**:
```
✅ Weekly leaderboard created for week of 2/4/2024
✅ Active weekly leaderboard already exists
⏰ Checking weekly leaderboard rotation every 60 minutes...
```

### 3. Start Frontend
```bash
cd frontend
npm run dev
```

### 4. Login as Admin
- Email: `admin@ischkul.com`
- Password: `admin123`

(If account doesn't exist, run: `cd backend1 && node create-superadmin.js`)

## How It Works

### For Students 🎓
1. Login to the app
2. Go to Leaderboards section
3. View the **Weekly Leaderboard** (always active)
4. Join the leaderboard
5. Complete quizzes to earn XP
6. See yourself climb the rankings

### For Admins 👨‍💼
1. Login as admin
2. Go to Admin Dashboard
3. See all leaderboards (weekly + any custom ones)
4. Create new leaderboards for special competitions
5. View rankings and winners
6. End leaderboards manually if needed

## Key Features

### Weekly Leaderboard (Automatic)
- **Created**: Every Sunday at 00:00 UTC
- **Ends**: Saturday at 23:59:59 UTC
- **Winners**: Top 3 users by XP recorded
- **Prizes**: 🥇 500 XP, 🥈 300 XP, 🥉 100 XP
- **Resets**: New board created automatically next week

### Manual Leaderboards (Admin Created)
- **Custom Dates**: Set your own start/end dates
- **Custom Prizes**: Define prizes for winners
- **Restricted**: Optionally limit to specific users
- **Manual End**: Can end early if needed

## API Examples

### Get Active Weekly Leaderboard
```bash
curl -X GET http://localhost:5000/api/leaderboard/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "leaderboard": {
    "_id": "abc123...",
    "title": "Weekly Leaderboard",
    "status": "active",
    "startDate": "2024-02-04T00:00:00.000Z",
    "endDate": "2024-02-10T23:59:59.999Z",
    "rankings": [
      {
        "rank": 1,
        "name": "Alice Johnson",
        "xp": 850,
        "level": 8,
        "avatar": "https://..."
      },
      {
        "rank": 2,
        "name": "Bob Smith",
        "xp": 720,
        "level": 7
      }
    ]
  }
}
```

### Join a Leaderboard
```bash
curl -X POST http://localhost:5000/api/leaderboard/join \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leaderboardId": "abc123..."}'
```

### Admin Create Leaderboard
```bash
curl -X POST http://localhost:5000/api/leaderboard/create \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Challenge Week",
    "description": "Special competition for AI topics",
    "startDate": "2024-02-15T00:00:00Z",
    "endDate": "2024-02-22T23:59:59Z",
    "prizes": [
      {"rank": 1, "description": "🏆 Laptop Stand"},
      {"rank": 2, "description": "🥈 Headphones"},
      {"rank": 3, "description": "🥉 USB Hub"}
    ]
  }'
```

## Testing

### Run Full Test Suite
```bash
cd backend1
node test_weekly_leaderboard.js
```

**Expected Results**:
```
✅ Admin created and promoted
✅ User 1 created
✅ User 2 created
✅ Active weekly leaderboard found
✅ Manual leaderboard created
✅ User 1 joined manual leaderboard
✅ Leaderboard rankings retrieved
✅ Admin can see 2 leaderboards total
✅ Non-admin user correctly blocked from creating leaderboard
✅ Manual leaderboard has 1 participant
✅ User 1 left the leaderboard

📊 Summary:
   - Weekly leaderboard system: ✅ ACTIVE
   - Manual leaderboard creation: ✅ WORKING
   - Admin access controls: ✅ ENFORCED
   - User participation: ✅ TRACKED
```

## Check Status

### View in Database
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/ischkul

# Check active leaderboards
db.leaderboards.find({status: 'active'}).pretty()

# Check winners from ended leaderboards
db.leaderboards.find({status: 'ended'}).pretty()

# Count total leaderboards
db.leaderboards.countDocuments()
```

### Verify in Logs
```bash
# Check server output for rotation messages
# Should see every 60 minutes:
# ⏰ Checking weekly leaderboard rotation...

# When expired, should see:
# ⏰ Ending expired weekly leaderboard...
# ✅ Weekly leaderboard ended. Winners recorded: 3
```

## Troubleshooting

### "No active leaderboard" Error
**Solution**: Wait for server startup to complete, should see initialization message

### Admin Can't Create Leaderboard
**Check**:
1. Verify user is admin: 
   ```bash
   db.users.findOne({email: 'admin@ischkul.com'})
   # Should show: "role": "admin" or "isAdmin": true
   ```
2. Make admin if needed:
   ```bash
   node make-admin.js
   ```

### Leaderboard Not Updating After Users Earn XP
**Check**:
1. Users have completed quizzes
2. XP was awarded (check User.xp in database)
3. Rankings endpoint: `/api/leaderboard/{id}`
4. May need to refresh frontend

### Weekly Leaderboard Stuck as "Active"
**Debug**:
```bash
# Check endDate
db.leaderboards.findOne({title: 'Weekly Leaderboard', status: 'active'})

# If endDate is in past, rotation should run next hour
# Force check in code or restart server
```

## Configuration

### Change Rotation Frequency
**File**: `backend1/server.js` (line 140)
```javascript
// Default: every 60 minutes
setInterval(checkAndRotateWeeklyLeaderboard, 60 * 60 * 1000);

// Change to every 10 minutes for testing:
setInterval(checkAndRotateWeeklyLeaderboard, 10 * 60 * 1000);
```

### Change Weekly Prizes
**File**: `backend1/server.js` (line 65)
```javascript
prizes: [
  { rank: 1, description: '🥇 Custom Prize 1' },
  { rank: 2, description: '🥈 Custom Prize 2' },
  { rank: 3, description: '🥉 Custom Prize 3' }
]
```

### Change Week Duration
**File**: `backend1/server.js` (line 52-53)
```javascript
// Default: Sunday-Saturday
// Modify startOfWeek and endOfWeek logic to change
```

## Documentation

For detailed information, see:
- `WEEKLY_LEADERBOARD_GUIDE.md` - Complete technical guide
- `LEADERBOARD_STATUS.md` - Implementation status & checklist
- `backend1/routes/leaderboard.js` - API endpoint code
- `backend1/server.js` - Weekly leaderboard logic

## Need Help?

1. Check server logs: `npm run dev` output
2. Review test results: `node test_weekly_leaderboard.js`
3. Check database: `mongosh mongodb://localhost:27017/ischkul`
4. Read implementation guide: `WEEKLY_LEADERBOARD_GUIDE.md`

## Success Indicators ✅

You'll know it's working when:
- ✅ Server shows "Weekly leaderboard created for week of..."
- ✅ Admin dashboard shows "Weekly Leaderboard" in list
- ✅ Users can join and see rankings
- ✅ Leaderboards persist after server restart
- ✅ Weekly leaderboard auto-ends and creates new one

---

**Status**: 🟢 Ready for Production  
**Last Verified**: February 2024  
**Maintenance**: Check logs weekly for rotation success
