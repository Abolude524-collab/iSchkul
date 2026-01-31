@echo off
cd c:\Users\23481\Pictures\ischkul-azure
git add frontend/src/App.tsx frontend/src/services/tourConfig.ts frontend/vite.config.ts
git commit -m "fix: Correct Shepherd.js CSS import path to resolve Vite error

- Changed import from 'shepherd.js/dist/shepherd.css' to 'shepherd.js/dist/css/shepherd.css'
- Added optimizeDeps configuration for shepherd.js in vite.config.ts
- Removed duplicate CSS import from tourConfig.ts (already in App.tsx)
- CSS is now properly imported in correct order: shepherd base CSS then custom theme"
git push
pause
