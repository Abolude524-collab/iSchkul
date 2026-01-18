const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const SET_ID = process.argv[2] || '695d9bf43b4245481bad3e20';

(async () => {
  try {
    console.log('Base URL:', API_BASE);

    const headers = {};
    if (process.env.AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.AUTH_TOKEN}`;

    const setsRes = await axios.get(`${API_BASE}/api/flashcard-sets/list`, { headers, validateStatus: () => true });
    console.log('\nGET /api/flashcard-sets/list status:', setsRes.status);
    if (setsRes.data) console.log('Response:', JSON.stringify(setsRes.data).slice(0, 2000));

    const dueRes = await axios.get(`${API_BASE}/api/flashcards/due`, { params: { limit: 50, groupId: SET_ID }, headers, validateStatus: () => true });
    console.log('\nGET /api/flashcards/due?groupId=' + SET_ID + ' status:', dueRes.status);
    if (dueRes.data) console.log('Response:', JSON.stringify(dueRes.data).slice(0, 2000));

    const allRes = await axios.get(`${API_BASE}/api/flashcards`, { params: { limit: 100, groupId: SET_ID }, headers, validateStatus: () => true });
    console.log('\nGET /api/flashcards?groupId=' + SET_ID + ' status:', allRes.status);
    if (allRes.data) console.log('Response:', JSON.stringify(allRes.data).slice(0, 2000));
  } catch (err) {
    console.error('Request failed:', err.message);
  }
})();
