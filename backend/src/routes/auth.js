const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('username').trim().isLength({ min: 3, max: 100 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, username } = req.body;

      // Check if user exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'Email or username already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await pool.query(
        'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, avatar, created_at',
        [email, username, passwordHash]
      );

      const user = result.rows[0];

      // Generate token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        message: 'User created successfully',
        token,
        user,
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const result = await pool.query(
        'SELECT id, email, username, avatar, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Remove password_hash from response
      delete user.password_hash;

      res.json({
        message: 'Login successful',
        token,
        user,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error during login' });
    }
  }
);

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  res.json(req.user);
});

// Update user profile (username and/or password)
router.put(
  '/update',
  authenticateToken,
  [
    body('username').optional().trim().isLength({ min: 3, max: 100 }),
    body('password').optional().isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;
      const userId = req.user.id;

      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (username) {
        // Check if username is already taken by another user
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId]
        );

        if (existingUser.rows.length > 0) {
          return res.status(400).json({ message: 'Username already exists' });
        }

        updates.push(`username = $${paramCount}`);
        values.push(username);
        paramCount++;
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updates.push(`password_hash = $${paramCount}`);
        values.push(passwordHash);
        paramCount++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: 'No fields to update' });
      }

      // Always update updated_at timestamp
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add userId to values
      values.push(userId);

      // Update user
      const result = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, username, avatar, created_at, updated_at`,
        values
      );

      const user = result.rows[0];

      res.json({
        message: 'Profile updated successfully',
        user,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Error updating profile' });
    }
  }
);

module.exports = router;

