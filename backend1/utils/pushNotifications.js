const axios = require('axios');
const PushToken = require('../models/PushToken');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const isExpoPushToken = (token) => {
  return typeof token === 'string' && (token.startsWith('ExpoPushToken') || token.startsWith('ExponentPushToken'));
};

const sendPushToUser = async (userId, { title, body, data = {} }) => {
  try {
    const tokens = await PushToken.find({ userId }).lean();
    if (!tokens || tokens.length === 0) return;

    const messages = tokens
      .filter(t => isExpoPushToken(t.token))
      .map(t => ({
        to: t.token,
        title,
        body,
        data,
        sound: 'default'
      }));

    if (messages.length === 0) return;

    await axios.post(EXPO_PUSH_URL, messages, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  } catch (error) {
    console.error('Expo push send error:', error?.response?.data || error.message);
  }
};

module.exports = {
  sendPushToUser
};