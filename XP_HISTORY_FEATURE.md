# XP History Feature

## Overview
A complete XP (Experience Points) history tracking system that shows users their learning activity, XP earnings, and progress over time.

## What Was Built

### 1. Backend (ischkul-azure/backend1)

#### XpLog Model (`models/XpLog.js`)
- Tracks all XP transactions for users
- Fields:
  - `userId`: Reference to User
  - `xpEarned`: Amount of XP awarded
  - `activityType`: Type of activity (QUIZ_COMPLETE, FLASHCARD_COMPLETE, etc.)
  - `metadata`: Additional details (quiz score, description, etc.)
  - `timestamp`: When the XP was earned
- Indexed for efficient queries

#### XP History Routes (`routes/xpHistory.js`)
- `GET /api/xp-history` - Get paginated XP history for authenticated user
  - Query params: `limit`, `skip`, `activityType`
  - Returns: logs array, pagination info, user stats
  
- `GET /api/xp-history/stats` - Get XP statistics and breakdown
  - Query params: `timeRange` (7d, 30d, 90d, all)
  - Returns: total XP, activity breakdown, daily chart data
  
- `awardXp()` helper function - Award XP programmatically
  - Can be called from other routes
  - Automatically updates user total XP and level

#### Server Integration (`server.js`)
- Added route: `app.use('/api/xp-history', require('./routes/xpHistory'));`

### 2. Frontend (ischkul-azure/frontend)

#### XP History Page (`src/pages/XpHistoryPage.tsx`)
Features:
- **User Stats Cards**: Display total XP, current level, and recent activity count
- **Time Range Filter**: View data for 7d, 30d, 90d, or all time
- **Activity Breakdown**: Visual cards showing XP earned by activity type
- **Activity Log**: Chronological list of all XP-earning activities
- **Smart Date Formatting**: "2h ago", "3d ago", etc.
- **Activity Icons**: Different colored icons for each activity type

Activity Types Supported:
- QUIZ_COMPLETE (blue)
- FLASHCARD_COMPLETE (purple)
- NOTE_SUMMARY (green)
- DAILY_LOGIN (amber)
- STREAK_BONUS (yellow)
- COMMUNITY_PARTICIPATION (pink)
- DOCUMENT_UPLOAD (teal)
- AI_TUTOR_USAGE (indigo)

#### Navigation (`src/components/Navbar.tsx`)
- Added "XP History" link in main navigation
- Added Trophy icon button (yellow) in header icons
- Accessible to all authenticated users (not admin-only)

#### Routing (`src/App.tsx`)
- Added protected route: `/xp-history`

### 3. Test Data Seeder

#### Seed Script (`backend1/seed-xp-history.js`)
- Creates 9 sample XP logs for testing
- Covers all activity types
- Spreads logs across past 7 days
- Updates user's total XP and level

**To run:**
```bash
cd backend1
node seed-xp-history.js
```

## How It Works

1. **Earning XP**: When users complete activities (quizzes, flashcards, etc.), the system:
   - Creates an XpLog entry
   - Updates User's total XP
   - Recalculates user level (level = floor(sqrt(xp/100)) + 1)

2. **Viewing History**: Users navigate to XP History page to see:
   - All-time total XP and current level
   - Recent activity count
   - Breakdown by activity type
   - Chronological activity feed

3. **Time Filtering**: Users can filter stats by time range:
   - Last 7 days
   - Last 30 days
   - Last 90 days
   - All time

## Integration Points

### To Award XP from Other Routes:
```javascript
const { awardXp } = require('./routes/xpHistory');

// In your route handler
await awardXp(
  userId,              // User's ID
  'QUIZ_COMPLETE',     // Activity type
  50,                  // XP amount
  {                    // Optional metadata
    quizScore: 85,
    description: 'Math Quiz'
  }
);
```

### Activity Type Enum:
- `QUIZ_COMPLETE`
- `FLASHCARD_COMPLETE`
- `NOTE_SUMMARY`
- `DAILY_LOGIN`
- `STREAK_BONUS`
- `COMMUNITY_PARTICIPATION`
- `DOCUMENT_UPLOAD`
- `AI_TUTOR_USAGE`

## API Endpoints

### Get XP History
```
GET /api/xp-history
Authorization: Bearer <token>
Query Params:
  - limit: number (default 50)
  - skip: number (default 0)
  - activityType: string (optional filter)

Response:
{
  "success": true,
  "data": {
    "logs": [...],
    "pagination": {...},
    "userStats": {
      "totalXp": 325,
      "level": 3
    }
  }
}
```

### Get XP Statistics
```
GET /api/xp-history/stats
Authorization: Bearer <token>
Query Params:
  - timeRange: "7d" | "30d" | "90d" | "all"

Response:
{
  "success": true,
  "data": {
    "timeRange": "30d",
    "totalXp": 225,
    "totalActivities": 8,
    "byActivityType": [...],
    "dailyBreakdown": [...]
  }
}
```

## Testing

1. **Start Backend**:
   ```bash
   cd backend1
   node server.js
   ```
   Backend runs on: http://localhost:5000

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on: http://localhost:5175

3. **Seed Test Data**:
   ```bash
   cd backend1
   node seed-xp-history.js
   ```

4. **View Page**:
   - Login to the app
   - Click Trophy icon in navbar
   - Or navigate to: http://localhost:5175/xp-history

## Future Enhancements

Potential improvements:
- Daily/weekly XP charts using recharts or Chart.js
- Achievements/badges for XP milestones
- Leaderboard comparison
- XP goal setting
- Export history to CSV
- Filter by multiple activity types
- Search functionality
- Infinite scroll pagination

## Files Modified/Created

### Backend
- ✅ `models/XpLog.js` (already existed)
- ✅ `routes/xpHistory.js` (created)
- ✅ `server.js` (added route)
- ✅ `seed-xp-history.js` (created)

### Frontend
- ✅ `pages/XpHistoryPage.tsx` (created)
- ✅ `App.tsx` (added route)
- ✅ `components/Navbar.tsx` (added links)

## References

Based on `student-web-app` implementation:
- `student-web-app-backend/models/XpLog.js`
- `student-web-app-backend/routes/gamificationRoutes.js`
