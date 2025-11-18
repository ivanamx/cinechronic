const express = require('express');
const pool = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all ratings for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, m.title, m.poster, m.year
       FROM ratings r
       JOIN movies m ON r.movie_id = m.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings' });
  }
});

// Rate a movie
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { movieId, rating } = req.body;

    console.log('📥 Recibiendo calificación:', {
      userId: req.user.id,
      movieId,
      rating,
      ratingType: typeof rating,
    });

    if (!movieId) {
      return res.status(400).json({ message: 'movieId is required' });
    }

    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ message: 'Invalid rating. Must be between 1 and 10' });
    }

    // Asegurar que rating sea un entero
    const ratingInt = Math.round(Number(rating));
    if (ratingInt < 1 || ratingInt > 10) {
      return res.status(400).json({ message: 'Invalid rating. Must be between 1 and 10' });
    }

    // Upsert rating (update if exists, insert if not)
    const result = await pool.query(
      `INSERT INTO ratings (user_id, movie_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, movie_id)
       DO UPDATE SET rating = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, movieId, ratingInt]
    );

    console.log('✅ Calificación guardada:', {
      id: result.rows[0].id,
      userId: result.rows[0].user_id,
      movieId: result.rows[0].movie_id,
      rating: result.rows[0].rating,
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating rating:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    res.status(500).json({ message: 'Error creating rating', error: error.message });
  }
});

// Get rating for a specific movie by current user
router.get('/movie/:movieId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ratings WHERE user_id = $1 AND movie_id = $2',
      [req.user.id, req.params.movieId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching rating:', error);
    res.status(500).json({ message: 'Error fetching rating' });
  }
});

// Update rating
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ message: 'Invalid rating. Must be between 1 and 10' });
    }

    const result = await pool.query(
      'UPDATE ratings SET rating = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
      [rating, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating rating:', error);
    res.status(500).json({ message: 'Error updating rating' });
  }
});

// Delete rating
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM ratings WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    res.json({ message: 'Rating deleted' });
  } catch (error) {
    console.error('Error deleting rating:', error);
    res.status(500).json({ message: 'Error deleting rating' });
  }
});

module.exports = router;

