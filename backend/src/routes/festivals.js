const express = require('express');
const pool = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all festivals (opcional: permitir acceso sin token para ver festivales públicos)
router.get('/', async (req, res) => {
  // Si no hay token, devolver array vacío
  if (!req.headers.authorization) {
    return res.json([]);
  }
  
  // Si hay token, validarlo primero
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json([]);
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.json([]);
    }
    
    req.user = { id: result.rows[0].id };
  } catch (error) {
    // Si el token es inválido, devolver array vacío
    return res.json([]);
  }
  
  // Continuar con la lógica original
  try {
    const result = await pool.query(
      `SELECT f.*,
       json_build_object(
         'id', p.id,
         'name', p.name,
         'scheduled_date', p.scheduled_date,
         'movies', COALESCE(
           json_agg(
             json_build_object(
               'id', m.id,
               'tmdbId', m.tmdb_id,
               'title', m.title,
               'poster', m.poster,
               'year', m.year
             ) ORDER BY pm.order_index
           ) FILTER (WHERE m.id IS NOT NULL),
           '[]'
         )
       ) as playlist,
       json_build_object(
         'id', u.id,
         'username', u.username,
         'avatar', u.avatar
       ) as created_by_user,
       COALESCE(
         json_agg(
           DISTINCT json_build_object(
             'id', up.id,
             'username', up.username,
             'avatar', up.avatar
           )
         ) FILTER (WHERE up.id IS NOT NULL),
         '[]'
       ) as participants
       FROM festivals f
       JOIN playlists p ON f.playlist_id = p.id
       JOIN users u ON f.created_by = u.id
       LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
       LEFT JOIN movies m ON pm.movie_id = m.id
       LEFT JOIN festival_participants fp ON f.id = fp.festival_id
       LEFT JOIN users up ON fp.user_id = up.id
       WHERE f.date >= CURRENT_DATE OR f.status != 'completed'
       GROUP BY f.id, p.id, u.id
       ORDER BY f.date ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching festivals:', error);
    res.status(500).json({ message: 'Error fetching festivals' });
  }
});

// Get festival by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*,
       json_build_object(
         'id', p.id,
         'name', p.name,
         'scheduled_date', p.scheduled_date,
         'movies', COALESCE(
           json_agg(
             json_build_object(
               'id', m.id,
               'tmdbId', m.tmdb_id,
               'title', m.title,
               'poster', m.poster,
               'backdrop', m.backdrop,
               'synopsis', m.synopsis,
               'year', m.year,
               'duration', m.duration,
               'genre', m.genre
             ) ORDER BY pm.order_index
           ) FILTER (WHERE m.id IS NOT NULL),
           '[]'
         )
       ) as playlist,
       json_build_object(
         'id', u.id,
         'username', u.username,
         'avatar', u.avatar
       ) as created_by_user,
       COALESCE(
         json_agg(
           DISTINCT json_build_object(
             'id', up.id,
             'username', up.username,
             'avatar', up.avatar
           )
         ) FILTER (WHERE up.id IS NOT NULL),
         '[]'
       ) as participants
       FROM festivals f
       JOIN playlists p ON f.playlist_id = p.id
       JOIN users u ON f.created_by = u.id
       LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
       LEFT JOIN movies m ON pm.movie_id = m.id
       LEFT JOIN festival_participants fp ON f.id = fp.festival_id
       LEFT JOIN users up ON fp.user_id = up.id
       WHERE f.id = $1
       GROUP BY f.id, p.id, u.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Festival not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching festival:', error);
    res.status(500).json({ message: 'Error fetching festival' });
  }
});

// Create festival
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { playlistId, date } = req.body;

    // Verify playlist ownership
    const playlistCheck = await pool.query(
      'SELECT user_id FROM playlists WHERE id = $1',
      [playlistId]
    );

    if (playlistCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlistCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const result = await pool.query(
      'INSERT INTO festivals (playlist_id, date, created_by) VALUES ($1, $2, $3) RETURNING *',
      [playlistId, date, req.user.id]
    );

    // Add creator as participant
    await pool.query(
      'INSERT INTO festival_participants (festival_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [result.rows[0].id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating festival:', error);
    res.status(500).json({ message: 'Error creating festival' });
  }
});

// Join festival
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO festival_participants (festival_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Joined festival successfully' });
  } catch (error) {
    console.error('Error joining festival:', error);
    res.status(500).json({ message: 'Error joining festival' });
  }
});

// Update festival status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['scheduled', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await pool.query(
      'UPDATE festivals SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Festival not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating festival status:', error);
    res.status(500).json({ message: 'Error updating festival status' });
  }
});

module.exports = router;

