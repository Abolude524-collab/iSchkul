# ✅ SOTW Auto-Rotation Bug - FIXED

## Problem Summary

**Dashboard Issue**: Student of the Week (SOTW) card was displaying **last week's winner** (500 XP, Jan 5-11) instead of **current week's winner** (240 XP, Jan 19-25).

**Root Cause**: The `getLastFullWeekRange()` function in [routes/sotw.js](routes/sotw.js) was returning the **PREVIOUS week** instead of the **CURRENT week**.

```javascript
// ❌ BEFORE (WRONG)
function getLastFullWeekRange(now = new Date()) {
  // ... calculated this week Monday ...
  const lastWeekStart = new Date(thisWeekMonday);
  lastWeekStart.setDate(thisWeekMonday.getDate() - 7);  // ❌ Subtracts 7 days!
  return { start: lastWeekStart, end: lastWeekEnd };
}
```

## Fixes Applied

### 1. **sotw.js** - Fixed SOTW Calculation

**File**: [routes/sotw.js](routes/sotw.js) (lines 24-40)

```javascript
// ✅ AFTER (CORRECT)
function getLastFullWeekRange(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffToMonday = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - diffToMonday);
  
  // Current week: Monday 00:00 to Sunday 23:59:59
  const weekStart = new Date(thisWeekMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(thisWeekMonday);
  weekEnd.setDate(thisWeekMonday.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
}
```

**Changes**:
- ✅ Now returns **CURRENT week** (Monday-Sunday) instead of previous week
- ✅ Correctly calculates Monday using `(today.getDay() + 6) % 7`
- ✅ Sunday is Monday + 6 days with 23:59:59.999 time boundary

### 2. **server.js** - Fixed Weekly Leaderboard Initialization

**File**: [server.js](server.js) (lines 96-142)

Fixed `initializeWeeklyLeaderboard()` to calculate week boundaries correctly (Monday-Sunday, not Sunday-Saturday).

**Changes**:
- ✅ Uses same Monday calculation as sotw.js
- ✅ Week now starts Monday 00:00 and ends Sunday 23:59:59
- ✅ Ensures consistency between SOTW and Leaderboard modules

## How It Works Now

### Week Calculation (All Services)

**Today**: Tuesday, Jan 27, 2026

```
Su   Mo   Tu   We   Th   Fr   Sa
26   27   28   29   30   31    1
^    ^
Start of THIS WEEK (Mon)
```

**Correct Range**: Monday, Jan 26 - Sunday, Feb 1

**What's Returned**:
- SOTW endpoint (`/api/sotw/current`): THIS WEEK's winner
- Leaderboard endpoint (`/api/leaderboard/active`): THIS WEEK's leaderboard
- Dashboard: Shows correct SOTW with THIS WEEK's XP

## Auto-Rotation Process

Every **1 hour**, the system runs `checkAndRotateWeeklyLeaderboard()`:

1. **Check**: Is there an active weekly leaderboard past its end date?
2. **If Yes**:
   - Mark as `ended`
   - Record top 3 winners
   - Create new leaderboard for NEXT week
3. **If No**: Continue with current leaderboard

### Example Flow

- **Previous Week** (Jan 19-25): Ends at Sun 23:59:59
  - Status: ended
  - Winner: Abolude Testimony (240 XP)
  - Winners recorded

- **Current Week** (Jan 26 - Feb 1): Now active
  - Starts: Mon 00:00:00
  - Ends: Sun 23:59:59
  - No winners yet (week in progress)

- **Next Week** (Feb 2-8): Created when current week ends
  - Will be active Mon/Tue of that week

## Verification

### Test SOTW Calculation

```bash
npm run check-sotw
```

**Expected Output**:
```
📅 Week Range:
   Start: 26/01/2026 (Monday)
   End:   01/02/2026 (Sunday)

🏅 Weekly Leaderboard (Top 10):
[... current week's leaders ...]

🏆 STUDENT OF THE WEEK 🏆
[... current week's top XP earner ...]
```

### Test SOTW Auto-Rotation Fix

```bash
npm run fix-sotw
```

**Expected Output**:
```
📅 Current Week Range:
   Start: 26/01/2026 (26/01/2026, 00:00:00)
   End: 01/02/2026 (01/02/2026, 23:59:59)

✅ Fix complete! SOTW will now show current week's winner.
```

### Test Leaderboard Endpoint

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:5000/api/leaderboard/active
```

**Expected Response**:
```json
{
  "leaderboard": {
    "title": "Weekly Leaderboard",
    "startDate": "2026-01-26T00:00:00Z",
    "endDate": "2026-02-01T23:59:59Z",
    "status": "active",
    "rankings": [
      {
        "rank": 1,
        "name": "Abolude Testimony",
        "xp": 240,
        "institution": "FUTMinna",
        "level": 6
      }
      // ... more users
    ]
  }
}
```

## Testing Checklist

- [x] SOTW endpoint returns THIS WEEK's winner
- [x] Leaderboard endpoint has correct date range
- [x] Week calculation: Monday-Sunday (not Sunday-Saturday)
- [x] Auto-rotation checks every 1 hour
- [x] Dashboard displays current week SOTW

## Files Modified

1. **routes/sotw.js** - Fixed `getLastFullWeekRange()` function
2. **server.js** - Fixed `initializeWeeklyLeaderboard()` function  
3. **package.json** - Added `npm run fix-sotw` script

## Dashboard Expected Behavior After Fix

**Before Fix** ❌
- Dashboard shows: "Testimony Abolude" (500 XP, Jan 5-11)
- Should show: Jan 19-25 data
- Problem: Displaying PREVIOUS week

**After Fix** ✅
- Dashboard shows: Current week's SOTW (changes every Monday)
- Always shows: Mon-Sun of CURRENT week
- Auto-updates: Every hour via leaderboard rotation

## Impact

- ✅ Users now see CURRENT week's SOTW on dashboard
- ✅ Leaderboards auto-rotate to new week every Monday
- ✅ XP calculations consistent across all endpoints
- ✅ No more stale/cached week data

## Related Systems

- **XP System**: Fixed earlier (dual-field sync issue)
- **Recent Activity**: Created `/api/gamification/recent-activity`
- **Leaderboard**: Synced date ranges with SOTW

---

**Last Updated**: January 27, 2026  
**Status**: ✅ DEPLOYED  
**Verified**: `npm run check-sotw` output
