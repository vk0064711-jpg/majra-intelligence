// server/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      companyId: decoded.company_id || decoded.companyId,
      role: decoded.role,
    };
    next();
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = auth;