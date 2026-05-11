const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { adminEmail, jwtSecret } = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function buildToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    preferences: user.preferences || {},
    createdAt: user.created_at,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const role = email.toLowerCase() === adminEmail ? 'admin' : 'member';
    const created = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, preferences, created_at',
      [name, email.toLowerCase(), passwordHash, role]
    );

    const user = created.rows[0];
    return res.status(201).json({ user: sanitizeUser(user), token: buildToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({ user: sanitizeUser(user), token: buildToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, role, preferences, created_at FROM users WHERE id = $1', [req.user.sub]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: sanitizeUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email, currentPassword, newPassword, preferences } = req.body;

    const existingResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingUser = existingResult.rows[0];
    const nextName = typeof name === 'string' ? name.trim() : existingUser.name;
    const nextEmail = typeof email === 'string' ? email.trim().toLowerCase() : existingUser.email;
    const nextPassword = typeof newPassword === 'string' ? newPassword : '';
    const nextPreferences = preferences && typeof preferences === 'object' ? preferences : existingUser.preferences || {};

    if (!nextName) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    if (!nextEmail) {
      return res.status(400).json({ error: 'Email cannot be empty' });
    }

    if (nextPassword && nextPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const passwordChangeRequested = Boolean(nextPassword);
    const emailChanged = nextEmail !== existingUser.email;
    const authCheckNeeded = passwordChangeRequested || emailChanged;

    if (authCheckNeeded) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required for email or password changes' });
      }

      const passwordMatches = await bcrypt.compare(currentPassword, existingUser.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid current password' });
      }
    }

    if (emailChanged) {
      const existingEmail = await db.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [nextEmail, req.user.sub]);
      if (existingEmail.rowCount > 0) {
        return res.status(409).json({ error: 'Email is already registered' });
      }
    }

    let passwordHash = existingUser.password_hash;
    if (passwordChangeRequested) {
      passwordHash = await bcrypt.hash(nextPassword, 12);
    }

    const updated = await db.query(
      'UPDATE users SET name = $1, email = $2, password_hash = $3, preferences = $4 WHERE id = $5 RETURNING id, name, email, role, preferences, created_at',
      [nextName, nextEmail, passwordHash, nextPreferences, req.user.sub]
    );

    const user = updated.rows[0];
    return res.json({ user: sanitizeUser(user), token: buildToken(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
