@echo off
REM Production Emergency Fix - XP Sync & Recent Activity
REM This script deploys the critical fixes in 2 minutes

echo.
echo ========================================
echo PRODUCTION FIX: XP Sync & Recent Activity
echo ========================================
echo.

setlocal enabledelayedexpansion

REM Step 1: Pull latest code
echo [1/4] Pulling latest code...
git pull origin main
if errorlevel 1 (
    echo ERROR: Failed to pull code
    exit /b 1
)
echo ✓ Code updated

REM Step 2: Repair XP mismatches
echo.
echo [2/4] Repairing XP mismatches across all users...
call npm run repair-xp
if errorlevel 1 (
    echo ERROR: XP repair failed
    exit /b 1
)
echo ✓ XP synced

REM Step 3: Create database indexes
echo.
echo [3/4] Verifying database indexes...
call npm run create-indexes
if errorlevel 1 (
    echo ERROR: Index creation failed
    exit /b 1
)
echo ✓ Indexes created

REM Step 4: Summary
echo.
echo ========================================
echo ✅ PRODUCTION FIX COMPLETE
echo ========================================
echo.
echo Changes Applied:
echo • Fixed XP sync between dashboard and xp-history
echo • Added recent activity endpoint
echo • Auto-correction for future mismatches
echo.
echo Next: Restart your server
echo npm run start:prod
echo.
echo Verify:
echo 1. Check dashboard XP matches xp-history page
echo 2. Recent activity shows on dashboard
echo 3. No console errors
echo.
pause
