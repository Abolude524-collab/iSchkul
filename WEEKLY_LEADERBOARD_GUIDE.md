# Weekly Leaderboard System - Complete Implementation Guide

## Overview

The weekly leaderboard system is a **fully autonomous** gamification feature that:
- ✅ Creates a new leaderboard every Sunday at 00:00
- ✅ Runs until Saturday at 23:59
- ✅ Automatically ends and records winners after 7 days
- ✅ Creates a new weekly leaderboard for the following week
- ✅ Persists all data to MongoDB (no in-memory storage)
- ✅ Provides platform admin dashboards to manage and view leaderboards
- ✅ Allows manual leaderboard creation by admins (alongside autonomous weekly boards)

## Architecture

### Database Model: `Leaderboard`

```javascript
{
  _id: ObjectId,
  title: String,                    // e.g., "Weekly Leaderboard"
  description: String,              // Display description
  startDate: Date,                  // Week start (Sunday 00:00:00)
  endDate: Date,                    // Week end (Saturday 23:59:59)
  status: 'active' | 'ended' | 'upcoming',
  isRestricted: Boolean,            // If true, only allowedUsers can participate
  allowedUsers: [ObjectId],         // Restricted user list
  participants: [ObjectId],         // Users who joined/participated
  prizes: [{rank, description}],    // Prize descriptions
  winners: [{rank, userId, xp, prizeDescription}],  // Winners recorded at end
  createdBy: ObjectId | null,       // null for system-created weekly, userId for admin-created
  createdAt: Date,
  updatedAt: Date,
  endedAt: Date                     // When the leaderboard ended
}
```

### Autonomous Rotation Logic

**File**: `backend1/server.js` (lines 35-140)

```javascript
// On server startup
initializeWeeklyLeaderboard()

// Every hour, check if weekly leaderboard has expired
setInterval(checkAndRotateWeeklyLeaderboard, 60 * 60 * 1000)
```

**Process**:
1. Server starts → checks for active weekly leaderboard
2. If none exists → creates new one for current week (Sunday-Saturday)
3. Every hour → checks if active weekly leaderboard's endDate has passed
4. If expired:
   - Records top 3 users as winners
   - Sets status to 'ended'
   - Automatically creates new weekly leaderboard for next week

## API Endpoints

### 1. Get Active Leaderboard (Weekly)
**Endpoint**: `GET /api/leaderboard/active`  
**Auth**: Required (any authenticated user)  
**Response**:
```json
{
  "leaderboard": {
    "_id": "...",
    "title": "Weekly Leaderboard",
    "status": "active",
    "startDate": "2024-01-28T00:00:00.000Z",
    "endDate": "2024-02-03T23:59:59.999Z",
    "rankings": [
      {"rank": 1, "name": "User1", "xp": 500, "level": 5},
      {"rank": 2, "name": "User2", "xp": 400, "level": 4}
    ]
  }
}
```

### 2. Create Manual Leaderboard (Admin Only)
**Endpoint**: `POST /api/leaderboard/create`  
**Auth**: Required + Admin role  
**Body**:
```json
{
  "title": "Math Competition",
  "description": "Weekly math quiz leaderboard",
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-02-08T23:59:59Z",
  "isRestricted": false,
  "prizes": [
    {"rank": 1, "description": "🥇 100 XP Bonus"},
    {"rank": 2, "description": "🥈 50 XP Bonus"}
  ]
}
```

### 3. Join a Leaderboard
**Endpoint**: `POST /api/leaderboard/join`  
**Auth**: Required (non-admin users only)  
**Body**:
```json
{
  "leaderboardId": "..."
}
```

### 4. Get Leaderboard Rankings
**Endpoint**: `GET /api/leaderboard/:id`  
**Auth**: Required  
**Response**: Sorted rankings with user XP/level

### 5. Get Leaderboard Details
**Endpoint**: `GET /api/leaderboard/details/:id`  
**Auth**: Optional (admin can see more details)  
**Response**: Full leaderboard info including winners (if ended)

### 6. List All Leaderboards (Admin)
**Endpoint**: `GET /api/leaderboard/list`  
**Auth**: Required + Admin role  
**Response**: All leaderboards (weekly + manual)

### 7. End Leaderboard (Admin)
**Endpoint**: `POST /api/leaderboard/end/:id`  
**Auth**: Required + Admin role  
**Effect**: 
- Records top 3 users as winners
- Sets status to 'ended'
- Returns winners data

### 8. Leave a Leaderboard
**Endpoint**: `POST /api/leaderboard/leave`  
**Auth**: Required (non-admin only)  
**Body**:
```json
{
  "leaderboardId": "..."
}
```

### 9. Get Participants
**Endpoint**: `GET /api/leaderboard/participants?leaderboardId=...`  
**Auth**: Required  
**Response**: List of participants with rankings

## Admin Dashboard Integration

**File**: `frontend/src/pages/AdminPage.tsx`

### Features:
1. **Create Leaderboard**: Form to create new admin-managed leaderboards
2. **View Leaderboards**: Table showing all leaderboards (manual + weekly)
3. **View Leaderboard Details**: Click "View" to see rankings and winners
4. **End Leaderboard**: Option to manually end a leaderboard

### Key Functions:
```typescript
const viewLeaderboard = (id: string) => {
  navigate(`/leaderboard/${id}`);
}

const endLeaderboard = async (id: string) => {
  await leaderboardAPI.endLeaderboard(id);
}

const createLeaderboard = async (data) => {
  await leaderboardAPI.createLeaderboard(data);
}
```

## Role-Based Access Control

### User Roles
- **`user`**: Regular student
  - Can join leaderboards (except restricted ones they're not invited to)
  - Can leave leaderboards
  - Can view rankings
  - **Cannot** create/end leaderboards
  - **Cannot** see admin-specific features

- **`admin`**: Platform administrator
  - Can create/end any leaderboard
  - Can view all leaderboards
  - Can see participant lists
  - Can view winners after leaderboard ends
  - **Cannot** participate in leaderboards as players

- **`superadmin`**: System administrator
  - Full access to all features

### Access Control Logic
```javascript
// Creating leaderboard - admin only
if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
  return res.status(403).json({ error: 'Admin access required' });
}

// Joining leaderboard - users only (not admins)
if (req.user.isAdmin || req.user.role === 'admin' || req.user.role === 'superadmin') {
  return res.status(403).json({ error: 'Admins cannot join leaderboards' });
}

// Viewing leaderboard - open to all authenticated users
// Rankings exclude admin users automatically
```

## How It Works - Example Timeline

### Saturday, Feb 3 - Week 1 Leaderboard Active
```
✅ Weekly Leaderboard (active)
   - Title: "Weekly Leaderboard"
   - Period: Jan 28 - Feb 3
   - Participants: 50 users
   - XP Leaders: User1 (500 XP), User2 (400 XP), User3 (300 XP)

✅ Manual Leaderboard: "Math Quiz Challenge" (active)
   - Created by admin
   - Period: Feb 1 - Feb 8
   - Participants: 20 users
```

### Sunday, Feb 4 - 00:00 (Rotation Trigger)
```
1. checkAndRotateWeeklyLeaderboard() runs every hour
2. Finds active weekly leaderboard with endDate < now
3. Records winners:
   - 1st: User1 (500 XP) → 🥇 Prize
   - 2nd: User2 (400 XP) → 🥈 Prize
   - 3rd: User3 (300 XP) → 🥉 Prize
4. Sets status to 'ended'
5. Creates new weekly leaderboard for Feb 4-10
```

### Sunday, Feb 4 - Moment After Rotation
```
❌ OLD Weekly Leaderboard (ended)
   - Period: Jan 28 - Feb 3
   - Winners: User1, User2, User3
   - Status: ended

✅ NEW Weekly Leaderboard (active)
   - Title: "Weekly Leaderboard"
   - Period: Feb 4 - Feb 10
   - Status: active
   - Participants: 0 (fresh start each week)

✅ Manual Leaderboard: "Math Quiz Challenge" (still active)
   - Period: Feb 1 - Feb 8
   - Status: continues running
```

## Testing the System

### Run the Comprehensive Test
```bash
cd backend1
node test_weekly_leaderboard.js
```

**What it tests**:
- ✅ Admin user creation and promotion
- ✅ Regular user registration
- ✅ Active weekly leaderboard discovery
- ✅ Manual leaderboard creation by admin
- ✅ User joining leaderboards
- ✅ Admin listing all leaderboards
- ✅ Role-based access control
- ✅ Leaderboard participation tracking
- ✅ User leaving leaderboards

### Manual Testing via API

**1. Get active weekly leaderboard**:
```bash
curl -X GET http://localhost:5000/api/leaderboard/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**2. Create admin leaderboard**:
```bash
curl -X POST http://localhost:5000/api/leaderboard/create \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Competition",
    "startDate": "2024-02-01T00:00:00Z",
    "endDate": "2024-02-08T23:59:59Z",
    "prizes": [{"rank": 1, "description": "🥇 Winner"}]
  }'
```

**3. Join a leaderboard**:
```bash
curl -X POST http://localhost:5000/api/leaderboard/join \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"leaderboardId": "..."}'
```

**4. View all leaderboards (admin)**:
```bash
curl -X GET http://localhost:5000/api/leaderboard/list \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Files Modified/Created

| File | Changes |
|------|---------|
| `backend1/server.js` | ✅ Added `initializeWeeklyLeaderboard()` and `checkAndRotateWeeklyLeaderboard()` |
| `backend1/models/Leaderboard.js` | ✅ Created MongoDB schema with all fields |
| `backend1/routes/leaderboard.js` | ✅ Converted all endpoints from global.leaderboards to database queries |
| `backend1/routes/leaderboard.js` | ✅ Fixed `/active`, `/join`, `/leave`, `/participants` endpoints |
| `frontend/src/pages/AdminPage.tsx` | ✅ Added `viewLeaderboard()` function and View button handler |
| `backend1/test_weekly_leaderboard.js` | ✅ Created comprehensive test suite |

## Key Differences from Previous Implementation

### Before (In-Memory):
- ❌ Leaderboards stored in `global.leaderboards` (lost on restart)
- ❌ No persistence to database
- ❌ Manual leaderboard management difficult
- ❌ No clear separation of weekly vs. manual leaderboards

### After (Database-Backed):
- ✅ All leaderboards persisted to MongoDB
- ✅ Weekly leaderboard autonomous (always exists)
- ✅ Manual admin leaderboards alongside weekly
- ✅ Clear data model with status tracking
- ✅ Winners recorded permanently
- ✅ Admin dashboard fully functional

## Troubleshooting

### Weekly Leaderboard Not Creating?
```bash
# Check server logs for initialization message:
✅ Weekly leaderboard created for week of...
```

### Can't See Leaderboard in Frontend?
- Verify `status: 'active'` in database
- Check `/active` endpoint returns data
- Ensure user is authenticated

### Admin Can't Create Leaderboard?
```bash
# Verify admin role:
curl -X GET http://localhost:5000/api/users/me \
  -H "Authorization: Bearer ADMIN_TOKEN"
# Should show "role": "admin" or "isAdmin": true
```

### XP Not Appearing in Rankings?
- Ensure users have completed quizzes or earned XP
- XP stored in `User.xp` field
- Leaderboard filters out admin users automatically

## Next Steps

1. **Automated XP Rewards**: When weekly leaderboard ends, automatically award XP bonuses to winners
2. **Notifications**: Notify users when they rank up or are about to lose their position
3. **XP Achievements**: Add badges for "5-time weekly winner", etc.
4. **Export Leaderboards**: Allow admins to export rankings as CSV
5. **Custom Scoring**: Allow admins to configure XP point values per quiz

## Support

For issues or questions, check:
- `backend1/server.js` - Autonomous logic
- `backend1/models/Leaderboard.js` - Data schema
- `backend1/routes/leaderboard.js` - API endpoints
- This documentation file
