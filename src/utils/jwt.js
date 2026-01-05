import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'caddiepro-secret-key-change-in-production';
let JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Clean up the expiresIn value (remove extra quotes if present)
if (typeof JWT_EXPIRES_IN === 'string') {
  JWT_EXPIRES_IN = JWT_EXPIRES_IN.replace(/^["']|["']$/g, '').trim();
}

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
