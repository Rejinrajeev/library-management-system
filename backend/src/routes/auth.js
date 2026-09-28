const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 200;

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;
    if (!name || !email || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'name, email and password are required.');
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new ApiError(400, 'VALIDATION_ERROR', `name must be ${MAX_NAME_LENGTH} characters or fewer.`);
    }
    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'email must be a valid email address.');
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(400, 'VALIDATION_ERROR', `password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'member')
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );
    const user = result.rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    if (err.code === '23505') {
      return next(new ApiError(409, 'EMAIL_TAKEN', 'An account with that email already exists.'));
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const { password } = req.body;
    if (!email || !password) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'email and password are required.');
    }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
    }
    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: safeUser, token: signToken(safeUser) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
