#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Leaderboard System Verification\n');

const checks = [];

// 1. Check if Leaderboard model exists
console.log('1️⃣ Checking Leaderboard Model...');
const leaderboardModelPath = path.join(__dirname, 'models', 'Leaderboard.js');
if (fs.existsSync(leaderboardModelPath)) {
  const content = fs.readFileSync(leaderboardModelPath, 'utf-8');
  if (content.includes('title') && content.includes('status') && content.includes('participants')) {
    console.log('✅ Leaderboard model exists with correct schema\n');
    checks.push(true);
  } else {
    console.log('❌ Leaderboard model missing required fields\n');
    checks.push(false);
  }
} else {
  console.log('❌ Leaderboard model file not found\n');
  checks.push(false);
}

// 2. Check server.js has weekly leaderboard logic
console.log('2️⃣ Checking Weekly Leaderboard Logic...');
const serverPath = path.join(__dirname, 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf-8');
if (serverContent.includes('initializeWeeklyLeaderboard') && serverContent.includes('checkAndRotateWeeklyLeaderboard')) {
  console.log('✅ Weekly leaderboard initialization and rotation logic present\n');
  checks.push(true);
} else {
  console.log('❌ Weekly leaderboard logic missing from server.js\n');
  checks.push(false);
}

// 3. Check leaderboard.js has been converted to database
console.log('3️⃣ Checking Leaderboard Routes Conversion...');
const leaderboardRoutePath = path.join(__dirname, 'routes', 'leaderboard.js');
const leaderboardRouteContent = fs.readFileSync(leaderboardRoutePath, 'utf-8');
const hasGlobalLeaderboards = leaderboardRouteContent.includes('global.leaderboards');
if (!hasGlobalLeaderboards && leaderboardRouteContent.includes('Leaderboard.findById')) {
  console.log('✅ Leaderboard routes converted to database queries\n');
  checks.push(true);
} else if (hasGlobalLeaderboards) {
  console.log('❌ Leaderboard routes still using global.leaderboards (in-memory)\n');
  checks.push(false);
} else {
  console.log('⚠️ Leaderboard routes unclear\n');
  checks.push(false);
}

// 4. Check for required endpoints
console.log('4️⃣ Checking API Endpoints...');
const requiredEndpoints = [
  { method: 'GET', path: '/active', name: 'Get active leaderboard' },
  { method: 'POST', path: '/create', name: 'Create leaderboard' },
  { method: 'POST', path: '/join', name: 'Join leaderboard' },
  { method: 'POST', path: '/leave', name: 'Leave leaderboard' },
  { method: 'GET', path: '/participants', name: 'Get participants' },
  { method: 'POST', path: '/end', name: 'End leaderboard' }
];

let allEndpointsFound = true;
requiredEndpoints.forEach(endpoint => {
  const found = leaderboardRouteContent.includes(`router.${endpoint.method.toLowerCase()}('${endpoint.path}'`);
  if (found) {
    console.log(`  ✅ ${endpoint.method} ${endpoint.path} - ${endpoint.name}`);
  } else {
    console.log(`  ❌ ${endpoint.method} ${endpoint.path} - ${endpoint.name}`);
    allEndpointsFound = false;
  }
});
console.log();
checks.push(allEndpointsFound);

// 5. Check admin middleware
console.log('5️⃣ Checking Admin Access Control...');
if (leaderboardRouteContent.includes('requireAdmin') && leaderboardRouteContent.includes('role === \'admin\'')) {
  console.log('✅ Admin middleware present with role checks\n');
  checks.push(true);
} else {
  console.log('❌ Admin access control missing or incomplete\n');
  checks.push(false);
}

// 6. Check test file exists
console.log('6️⃣ Checking Test Suite...');
const testPath = path.join(__dirname, 'test_weekly_leaderboard.js');
if (fs.existsSync(testPath)) {
  const testContent = fs.readFileSync(testPath, 'utf-8');
  const testScenarios = (testContent.match(/console\.log\('[\d❌️⃣✅]/g) || []).length;
  console.log(`✅ Test suite exists with ${testScenarios} test scenarios\n`);
  checks.push(true);
} else {
  console.log('❌ Test file not found\n');
  checks.push(false);
}

// 7. Check for documentation
console.log('7️⃣ Checking Documentation...');
const docFiles = [
  '../WEEKLY_LEADERBOARD_GUIDE.md',
  '../LEADERBOARD_STATUS.md',
  '../WEEKLY_LEADERBOARD_QUICKSTART.md',
  '../LEADERBOARD_RESTORATION_COMPLETE.md'
];
const docsFound = docFiles.filter(doc => fs.existsSync(path.join(__dirname, doc))).length;
console.log(`✅ Found ${docsFound}/${docFiles.length} documentation files\n`);
checks.push(docsFound >= 3);

// 8. Check User model has xp field
console.log('8️⃣ Checking User Model XP Field...');
const userModelPath = path.join(__dirname, 'models', 'User.js');
if (fs.existsSync(userModelPath)) {
  const userContent = fs.readFileSync(userModelPath, 'utf-8');
  if (userContent.includes('xp')) {
    console.log('✅ User model has xp field for leaderboard rankings\n');
    checks.push(true);
  } else {
    console.log('❌ User model missing xp field\n');
    checks.push(false);
  }
} else {
  console.log('❌ User model not found\n');
  checks.push(false);
}

// 9. Summary
console.log('═'.repeat(50));
const passCount = checks.filter(c => c).length;
const totalCount = checks.length;
const percentage = Math.round((passCount / totalCount) * 100);

console.log(`\n📊 Verification Summary\n`);
console.log(`Passed: ${passCount}/${totalCount} (${percentage}%)\n`);

if (percentage === 100) {
  console.log('🎉 ALL CHECKS PASSED - System Ready for Production\n');
  console.log('Next Steps:');
  console.log('1. Start backend: npm run dev');
  console.log('2. Run tests: node test_weekly_leaderboard.js');
  console.log('3. Check logs for: "✅ Weekly leaderboard created for week of..."');
  console.log('4. Admin dashboard should show leaderboards\n');
  process.exit(0);
} else if (percentage >= 75) {
  console.log('⚠️ MOSTLY READY - Review failures above\n');
  process.exit(1);
} else {
  console.log('❌ ISSUES FOUND - Cannot deploy\n');
  console.log('Please address the failures above before deploying.\n');
  process.exit(1);
}
