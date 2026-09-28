const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Q1: the 5 most borrowed books in the last 30 days.
router.get('/most-borrowed', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.title, b.author, COUNT(*) AS borrow_count
      FROM loans l
      JOIN copies c ON c.id = l.copy_id
      JOIN books b ON b.id = c.book_id
      WHERE l.borrow_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY b.id, b.title, b.author
      ORDER BY borrow_count DESC
      LIMIT 5
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Q2: members with overdue loans, and the total fine each would owe if returned today.
router.get('/overdue-fines', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id AS member_id, u.name, u.email,
             COUNT(*) AS overdue_loans,
             SUM((CURRENT_DATE - l.due_date) * 10) AS total_fine
      FROM loans l
      JOIN users u ON u.id = l.member_id
      WHERE l.return_date IS NULL AND l.due_date < CURRENT_DATE
      GROUP BY u.id, u.name, u.email
      ORDER BY total_fine DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
