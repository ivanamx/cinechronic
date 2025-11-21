const express = require('express');
const pool = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// TMDB soporta tanto Bearer Token como API Key
// Bearer Token es el método recomendado (TMDB_ACCESS_TOKEN)
// API Key también funciona (TMDB_API_KEY)
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Get all movies
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM movies ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ message: 'Error fetching movies' });
  }
});

// Get top rated movie (DEBE estar ANTES de /:id para evitar conflictos)
router.get('/top-rated', async (req, res) => {
  // Si no hay token, devolver 404
  if (!req.headers.authorization) {
    return res.status(404).json({ message: 'No rated movies found' });
  }
  
  // Si hay token, validarlo primero
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(404).json({ message: 'No rated movies found' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No rated movies found' });
    }
    
    req.user = { id: result.rows[0].id };
  } catch (error) {
    // Si el token es inválido, devolver 404
    return res.status(404).json({ message: 'No rated movies found' });
  }
  
  // Continuar con la lógica original
  try {
    const result = await pool.query(
      `SELECT m.*, AVG(r.rating) as average_rating, COUNT(r.id) as rating_count
       FROM movies m
       JOIN ratings r ON m.id = r.movie_id
       GROUP BY m.id
       ORDER BY average_rating DESC, rating_count DESC
       LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No rated movies found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching top rated movie:', error);
    res.status(500).json({ message: 'Error fetching top rated movie' });
  }
});

// Get movie by ID (DEBE estar DESPUÉS de rutas específicas como /top-rated)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM movies WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching movie:', error);
    res.status(500).json({ message: 'Error fetching movie' });
  }
});

// Create movie
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tmdbId, title, poster, backdrop, synopsis, year, duration, genre } = req.body;

    // Check if movie already exists
    const existing = await pool.query('SELECT id FROM movies WHERE tmdb_id = $1', [tmdbId]);
    
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO movies (tmdb_id, title, poster, backdrop, synopsis, year, duration, genre)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tmdbId, title, poster, backdrop, synopsis, year, duration, genre || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating movie:', error);
    res.status(500).json({ message: 'Error creating movie' });
  }
});

// Get movie ratings
router.get('/:id/ratings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.username, u.avatar
       FROM ratings r
       JOIN users u ON r.user_id = u.id
       WHERE r.movie_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({ message: 'Error fetching ratings' });
  }
});

// Search movies in TMDB (sin autenticación para permitir búsqueda pública)
router.get('/search/tmdb', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
      return res.status(500).json({ message: 'TMDB authentication not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to .env' });
    }

    // Usar Bearer Token si está disponible (método recomendado), sino usar API Key
    const headers = TMDB_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'accept': 'application/json' }
      : { 'accept': 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&language=en-US`
      : `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.status_message || 'TMDB API error');
    }

    const data = await response.json();
    const results = data.results || [];
    
    // Función auxiliar para obtener el director de una película
    async function getMovieDirector(tmdbId) {
      try {
        const creditsUrl = TMDB_ACCESS_TOKEN
          ? `${TMDB_BASE_URL}/movie/${tmdbId}/credits?language=en-US`
          : `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
        
        const creditsResponse = await fetch(creditsUrl, { headers });
        if (!creditsResponse.ok) {
          return null;
        }
        
        const creditsData = await creditsResponse.json();
        const director = (creditsData.crew || []).find(
          (member) => member && (member.job || '').toLowerCase() === 'director'
        );
        
        return director ? { id: director.id, name: director.name } : null;
      } catch (error) {
        console.error(`Error getting director for movie ${tmdbId}:`, error);
        return null;
      }
    }

    // Enriquecer resultados con duración (runtime) y director de cada película
    // Nota: Esto requiere llamadas adicionales, así que lo hacemos solo para los primeros 10 resultados
    const enrichedResults = await Promise.all(
      results.slice(0, 10).map(async (movie) => {
        try {
          const detailUrl = TMDB_ACCESS_TOKEN
            ? `${TMDB_BASE_URL}/movie/${movie.id}?language=en-US`
            : `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US`;
          
          const detailResponse = await fetch(detailUrl, { headers });
          let runtime = null;
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            runtime = detailData.runtime;
          }
          
          // Obtener director
          const director = await getMovieDirector(movie.id);
          
          return { 
            ...movie, 
            runtime,
            director: director || null
          };
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error);
        }
        return movie;
      })
    );
    
    // Combinar resultados enriquecidos con el resto
    const finalResults = [...enrichedResults, ...results.slice(10)];
    res.json(finalResults);
  } catch (error) {
    console.error('Error searching TMDB:', error);
    res.status(500).json({ message: error.message || 'Error searching movies' });
  }
});

// Get movie details from TMDB (sin autenticación para permitir acceso público)
router.get('/tmdb/:tmdbId', async (req, res) => {
  try {
    const { tmdbId } = req.params;

    if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
      return res.status(500).json({ message: 'TMDB authentication not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to .env' });
    }

    // Usar Bearer Token si está disponible (método recomendado), sino usar API Key
    const headers = TMDB_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'accept': 'application/json' }
      : { 'accept': 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/movie/${tmdbId}?language=en-US`
      : `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: errorData.status_message || 'Movie not found in TMDB' });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching TMDB movie:', error);
    res.status(500).json({ message: 'Error fetching movie details' });
  }
});

// Get watch providers for a movie from TMDB (solo México - MX)
router.get('/tmdb/:tmdbId/watch-providers', async (req, res) => {
  try {
    const { tmdbId } = req.params;

    if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
      return res.status(500).json({ message: 'TMDB authentication not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to .env' });
    }

    // Usar Bearer Token si está disponible (método recomendado), sino usar API Key
    const headers = TMDB_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'accept': 'application/json' }
      : { 'accept': 'application/json' };

    // Obtener watch providers con región MX (México)
    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers?watch_region=MX`
      : `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}&watch_region=MX`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ message: errorData.status_message || 'Watch providers not found' });
    }

    const data = await response.json();
    
    // Extraer solo el objeto MX de la respuesta
    const mxProviders = data.results && data.results.MX ? data.results.MX : null;
    
    if (!mxProviders) {
      return res.json({ 
        link: null,
        flatrate: [],
        rent: [],
        buy: []
      });
    }

    // Devolver solo los datos de México
    res.json({
      link: mxProviders.link || null,
      flatrate: mxProviders.flatrate || [],
      rent: mxProviders.rent || [],
      buy: mxProviders.buy || []
    });
  } catch (error) {
    console.error('Error fetching watch providers:', error);
    res.status(500).json({ message: 'Error fetching watch providers' });
  }
});


module.exports = router;

