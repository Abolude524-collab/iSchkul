const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    console.log('🔐 Auth middleware - Authorization header:', authHeader ? '✓ Present' : '✗ Missing');
    
    if (!authHeader) {
      console.log('❌ No authorization header provided');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    let token = authHeader.replace(/^Bearer\s+/i, '').trim();
    
    // Check for malformed tokens (like "null" string)
    if (token === 'null' || token === 'undefined' || !token) {
      console.log('❌ Malformed token:', token);
      return res.status(401).json({ error: 'Access denied. Invalid token format.' });
    }
    
    console.log('🔑 Token extracted - Length:', token.length, 'Valid JWT format:', token.startsWith('eyJ'));

    if (!token) {
      console.log('❌ Token is empty after extraction');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ JWT verified successfully - User ID:', decoded.id);
    } catch (jwtError) {
      console.error('❌ JWT verification failed:', {
        name: jwtError.name,
        message: jwtError.message,
        tokenLength: token.length,
        tokenStart: token.substring(0, 30) + '...'
      });
      return res.status(401).json({ error: 'Invalid token. JWT verification failed.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('❌ User not found in database - ID:', decoded.id);
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    console.log('✅ User authenticated:', user.email);

    // Ensure req.user has both _id and id for compatibility
    req.user = user;
    req.user.id = user._id.toString();
    next();
  } catch (error) {
    console.error('🔴 Auth middleware error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ error: 'Authentication failed: ' + error.message });
  }
};

module.exports = auth;