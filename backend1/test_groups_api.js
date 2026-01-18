const axios = require('axios');

async function testGroupsAPI() {
  try {
    // You need to get the actual token from the browser
    // Open DevTools -> Application -> Local Storage -> authToken
    const token = 'YOUR_TOKEN_HERE'; // Replace with actual token
    
    console.log('Testing GET /api/groups endpoint...\n');
    
    const response = await axios.get('http://localhost:5000/api/groups', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.groups) {
      console.log(`\nFound ${response.data.groups.length} groups`);
      response.data.groups.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.name}`);
        console.log(`   ID: ${group._id}`);
        console.log(`   Members: ${group.members ? group.members.length : group.memberCount || 0}`);
        console.log(`   Category: ${group.category || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testGroupsAPI();
