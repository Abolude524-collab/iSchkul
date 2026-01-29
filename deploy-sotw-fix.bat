@echo off
REM Deploy Production Fixes - SOTW Auto-Rotation
REM This script applies all production fixes in the correct order

echo.
echo ========================================
echo SOTW Auto-Rotation Bug - Production Fix
echo ========================================
echo.

cd backend1

echo [1/4] Verifying environment...
timeout /t 2 /nobreak > nul

echo [2/4] Running XP verification and repair...
call npm run verify-xp
if errorlevel 1 (
    echo ❌ XP verification failed
    goto error
)

echo.
echo [3/4] Checking SOTW calculation...
call npm run check-sotw
if errorlevel 1 (
    echo ❌ SOTW check failed
    goto error
)

echo.
echo [4/4] Applying SOTW auto-rotation fix...
call npm run fix-sotw
if errorlevel 1 (
    echo ❌ SOTW fix failed
    goto error
)

echo.
echo ========================================
echo ✅ ALL FIXES DEPLOYED SUCCESSFULLY
echo ========================================
echo.
echo Next Steps:
echo 1. Restart the backend: npm run dev
echo 2. Clear browser cache
echo 3. Verify dashboard shows correct SOTW
echo 4. Check console for auto-rotation messages
echo.
echo Dashboard should now show:
echo - Week: Jan 19-25 (or current week Mon-Sun)
echo - Winner: Abolude Testimony (240 XP)
echo - Auto-updates: Every Monday
echo.

pause
goto end

:error
echo.
echo ❌ DEPLOYMENT FAILED
echo Please check the error message above
echo.
pause

:end
cd ..
