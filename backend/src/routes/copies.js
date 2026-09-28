const express = require('express');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Update a copy's condition. Librarian only.
router.put('/:id', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const { condition } = req.body;
    if (!['good', 'damaged', 'lost'].includes(condition)) {
      throw new ApiError(400, 'VALIDATION_ERROR', "condition must be 'good', 'damaged' or 'lost'.");
    }
    const result = await pool.query(
      `UPDATE copies SET condition = $1 WHERE id = $2 RETURNING *`,
      [condition, req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Copy not found.');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete a copy. Librarian only. A copy that is currently on loan or has loan history cannot be deleted.
router.delete('/:id', requireAuth, requireRole('librarian'), async (req, res, next) => {
  try {
    const everLent = await pool.query('SELECT 1 FROM loans WHERE copy_id = $1 LIMIT 1', [req.params.id]);
    if (everLent.rows[0]) {
      throw new ApiError(409, 'COPY_HAS_LOAN_HISTORY', 'A copy that has ever been lent cannot be deleted.');
    }
    const result = await pool.query('DELETE FROM copies WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Copy not found.');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
