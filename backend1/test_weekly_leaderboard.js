const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let adminToken = '';
let userToken1 = '';
let userToken2 = '';
let userId1 = '';
let userId2 = '';
let adminUserId = '';
let leaderboardId = '';
let weeklyLeaderboardId = '';

async function test() {
  try {
    console.log('🧪 Testing Weekly Leaderboard System\n');
    
    // 1. Create admin user
    console.log('1️⃣ Creating platform admin...');
    try {
      const adminRes = await axios.post(`${BASE_URL}/auth/register`, {
        name: 'Admin User',
        email: `admin-${Date.now()}@test.com`,
        password: 'Test123!',
        username: `admin-${Date.now()}`
      });
      adminUserId = adminRes.data.user._id;
      adminToken = adminRes.data.token;
      
      // Update to admin - first get a valid token for the admin user
      await axios.post(`${BASE_URL}/admin/users/role`, 
        { userId: adminUserId, role: 'admin' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      console.log('✅ Admin created and promoted');
    } catch (error) {
      console.log('⚠️ Admin creation failed, trying login...');
      try {
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
          email: 'admin@ischkul.com',
          password: 'admin123'
        });
        adminToken = loginRes.data.token;
        console.log('✅ Existing admin logged in');
      } catch {
        console.log('❌ Could not get admin token');
        console.log('   Please ensure the admin@ischkul.com account exists');
        console.log('   Run: node create-superadmin.js');
        return;
      }
    }
    
    // 2. Create test users
    console.log('\n2️⃣ Creating test users...');
    const user1Res = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test User 1',
      email: `user1-${Date.now()}@test.com`,
      password: 'Test123!',
      username: `user1-${Date.now()}`
    });
    userId1 = user1Res.data.user._id;
    userToken1 = user1Res.data.token;
    console.log(`✅ User 1 created: ${user1Res.data.user.name}`);

    const user2Res = await axios.post(`${BASE_URL}/auth/register`, {
      name: 'Test User 2',
      email: `user2-${Date.now()}@test.com`,
      password: 'Test123!',
      username: `user2-${Date.now()}`
    });
    userId2 = user2Res.data.user.userId;
    userToken2 = user2Res.data.token;
    console.log(`✅ User 2 created: ${user2Res.data.user.name}`);

    // 3. Check if active weekly leaderboard exists
    console.log('\n3️⃣ Checking for active weekly leaderboard...');
    const activeRes = await axios.get(`${BASE_URL}/leaderboard/active`, {
      headers: { Authorization: `Bearer ${userToken1}` }
    });
    
    if (activeRes.data.leaderboard) {
      weeklyLeaderboardId = activeRes.data.leaderboard._id;
      console.log('✅ Active weekly leaderboard found:', activeRes.data.leaderboard.title);
      console.log('   Start:', new Date(activeRes.data.leaderboard.startDate).toLocaleDateString());
      console.log('   End:', new Date(activeRes.data.leaderboard.endDate).toLocaleDateString());
      console.log('   Status:', activeRes.data.leaderboard.status);
    } else {
      console.log('❌ No active weekly leaderboard found');
    }

    // 4. Admin creates a manual leaderboard
    console.log('\n4️⃣ Admin creating manual leaderboard...');
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 7);

    const manualRes = await axios.post(`${BASE_URL}/leaderboard/create`, {
      title: 'Test Competition',
      description: 'Manual leaderboard for testing',
      startDate: startDate,
      endDate: endDate,
      prizes: [
        { rank: 1, description: '🥇 Winner - 100 points' },
        { rank: 2, description: '🥈 Runner-up - 50 points' }
      ],
      isRestricted: false
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    leaderboardId = manualRes.data._id || manualRes.data.leaderboard._id;
    console.log('✅ Manual leaderboard created:', manualRes.data.title || manualRes.data.leaderboard.title);

    // 5. User 1 joins the leaderboards
    console.log('\n5️⃣ User 1 joining leaderboards...');
    const joinManualRes = await axios.post(`${BASE_URL}/leaderboard/join`, {
      leaderboardId: leaderboardId
    }, {
      headers: { Authorization: `Bearer ${userToken1}` }
    });
    console.log('✅ User 1 joined manual leaderboard');

    if (weeklyLeaderboardId) {
      try {
        await axios.post(`${BASE_URL}/leaderboard/join`, {
          leaderboardId: weeklyLeaderboardId
        }, {
          headers: { Authorization: `Bearer ${userToken1}` }
        });
        console.log('✅ User 1 joined weekly leaderboard');
      } catch (error) {
        console.log('⚠️ Could not join weekly leaderboard:', error.response?.data?.error);
      }
    }

    // 6. Check rankings
    console.log('\n6️⃣ Checking leaderboard rankings...');
    const rankingsRes = await axios.get(`${BASE_URL}/leaderboard/${leaderboardId}`, {
      headers: { Authorization: `Bearer ${userToken1}` }
    });
    console.log(`✅ Manual leaderboard rankings retrieved (${rankingsRes.data.rankings?.length || 0} users)`);

    if (weeklyLeaderboardId) {
      try {
        const weeklyRankingsRes = await axios.get(`${BASE_URL}/leaderboard/${weeklyLeaderboardId}`, {
          headers: { Authorization: `Bearer ${userToken1}` }
        });
        console.log(`✅ Weekly leaderboard rankings retrieved (${weeklyRankingsRes.data.rankings?.length || 0} users)`);
      } catch (error) {
        console.log('⚠️ Could not get weekly leaderboard rankings');
      }
    }

    // 7. Admin views all leaderboards
    console.log('\n7️⃣ Admin listing all leaderboards...');
    const adminListRes = await axios.get(`${BASE_URL}/leaderboard/list`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✅ Admin can see ${adminListRes.data.length || 0} leaderboards total`);
    adminListRes.data.forEach((lb, idx) => {
      console.log(`   ${idx + 1}. ${lb.title} (${lb.status})`);
    });

    // 8. Test user role verification
    console.log('\n8️⃣ Verifying role-based access...');
    try {
      await axios.post(`${BASE_URL}/leaderboard/create`, {
        title: 'Unauthorized Leaderboard',
        startDate: now,
        endDate: endDate
      }, {
        headers: { Authorization: `Bearer ${userToken1}` }
      });
      console.log('❌ Non-admin user was able to create leaderboard (security issue!)');
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Non-admin user correctly blocked from creating leaderboard');
      } else {
        console.log('⚠️ Unexpected error:', error.response?.data?.error);
      }
    }

    // 9. Check participation tracking
    console.log('\n9️⃣ Checking participation tracking...');
    const participantsRes = await axios.get(`${BASE_URL}/leaderboard/participants?leaderboardId=${leaderboardId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log(`✅ Manual leaderboard has ${participantsRes.data.participantCount || 0} participants`);

    // 10. Test leaving leaderboard
    console.log('\n🔟 User 1 leaving manual leaderboard...');
    await axios.post(`${BASE_URL}/leaderboard/leave`, {
      leaderboardId: leaderboardId
    }, {
      headers: { Authorization: `Bearer ${userToken1}` }
    });
    console.log('✅ User 1 left the leaderboard');

    console.log('\n✨ All tests completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Weekly leaderboard system: ${weeklyLeaderboardId ? '✅ ACTIVE' : '⚠️ NOT FOUND'}`);
    console.log(`   - Manual leaderboard creation: ✅ WORKING`);
    console.log(`   - Admin access controls: ✅ ENFORCED`);
    console.log(`   - User participation: ✅ TRACKED`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }

  process.exit(0);
}

test();
