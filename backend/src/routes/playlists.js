const express = require('express');
const pool = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w185';

// Obtener la foto del director usando el endpoint de imágenes
async function fetchDirectorProfileImage(personId) {
  if (!personId) {
    return null;
  }

  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    // Usar el endpoint de imágenes según la documentación oficial
    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/person/${personId}/images`
      : `${TMDB_BASE_URL}/person/${personId}/images?api_key=${TMDB_API_KEY}`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB person images error: ${response.status}`);
    }

    const data = await response.json();
    
    // Tomar la primera foto del array de profiles
    const firstProfile = data.profiles && data.profiles.length > 0 ? data.profiles[0] : null;
    const profilePath = firstProfile?.file_path || null;
    const profileUrl = profilePath ? `${PROFILE_BASE_URL}${profilePath}` : null;

    console.log(`📸 Imágenes obtenidas para person ${personId}:`, {
      totalProfiles: data.profiles?.length || 0,
      firstProfilePath: profilePath,
      profileUrl: profileUrl,
    });

    return {
      profilePath,
      profileUrl,
    };
  } catch (error) {
    console.error(`Error fetching images for person ${personId}:`, error);
    return null;
  }
}

// Extraer país del lugar de nacimiento
function extractCountryFromPlace(placeOfBirth) {
  if (!placeOfBirth || typeof placeOfBirth !== 'string') {
    return null;
  }
  const parts = placeOfBirth
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts[parts.length - 1];
}

// Obtener detalles completos del director (foto y país)
async function fetchDirectorDetails(personId) {
  if (!personId) {
    return null;
  }

  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/person/${personId}?language=en-US`
      : `${TMDB_BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB person details error: ${response.status}`);
    }

    const details = await response.json();
    const placeOfBirth = details.place_of_birth || null;
    const country = extractCountryFromPlace(placeOfBirth);

    // Obtener la foto usando el endpoint de imágenes
    const directorImage = await fetchDirectorProfileImage(personId);

    return {
      placeOfBirth,
      country,
      profilePath: directorImage?.profilePath || null,
      profileUrl: directorImage?.profileUrl || null,
    };
  } catch (error) {
    console.error(`Error fetching details for person ${personId}:`, error);
    return null;
  }
}

// Buscar director por nombre (similar a la función en recommendations.js)
async function searchDirectorByName(name) {
  if (!name || name.trim().length === 0) {
    return null;
  }

  try {
    // Limpiar el nombre: remover caracteres especiales al final y espacios extra
    const cleanedName = name.trim().replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ]/g, '').trim();
    
    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    // Intentar primero con el nombre limpio
    let searchQuery = cleanedName;
    let url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(searchQuery)}&language=en-US`
      : `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=en-US`;

    let response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB search/person error: ${response.status}`);
    }

    let data = await response.json();
    
    // Si no hay resultados con el nombre limpio, intentar con el nombre original
    if (!data.results || data.results.length === 0) {
      searchQuery = name.trim();
      url = TMDB_ACCESS_TOKEN
        ? `${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(searchQuery)}&language=en-US`
        : `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=en-US`;
      
      response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`TMDB search/person error: ${response.status}`);
      }
      data = await response.json();
    }

    if (!data.results || data.results.length === 0) {
      console.warn(`⚠️  No se encontraron resultados para el director "${name}" (buscado como "${searchQuery}")`);
      return null;
    }

    // Buscar el director que mejor coincida
    const directingMatch =
      data.results.find(
        (person) =>
          (person.known_for_department || '').toLowerCase() === 'directing'
      ) || data.results[0];

    if (!directingMatch) {
      console.warn(`⚠️  Resultados sin coincidencias de dirección para "${name}"`);
      return null;
    }

    console.log(`✅ Director encontrado: "${name}" -> "${directingMatch.name}" (ID: ${directingMatch.id})`);

    // Obtener detalles del director (país, lugar de nacimiento, etc.)
    const directorDetails = await fetchDirectorDetails(directingMatch.id);

    return {
      id: directingMatch.id,
      name: directingMatch.name || name,
      placeOfBirth: directorDetails?.placeOfBirth || null,
      country: directorDetails?.country || null,
    };
  } catch (error) {
    console.error(`Error buscando director "${name}":`, error);
    return null;
  }
}

// Obtener el director de una película por su TMDB ID
async function getMovieDirector(tmdbId) {
  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'accept': 'application/json' }
      : { 'accept': 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/movie/${tmdbId}/credits?language=en-US`
      : `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB movie credits error: ${response.status}`);
    }

    const credits = await response.json();
    const director = (credits.crew || []).find(
      (member) => member && (member.job || '').toLowerCase() === 'director'
    );

    if (!director) {
      return null;
    }

    // Obtener la foto del director usando el endpoint de imágenes
    const directorImage = await fetchDirectorProfileImage(director.id);

    return {
      id: director.id,
      name: director.name,
      profileUrl: directorImage?.profileUrl || null,
    };
  } catch (error) {
    console.error(`Error getting director for movie ${tmdbId}:`, error);
    return null;
  }
}

// Buscar directores y películas para autocompletado
router.get('/search/directors', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
    const TMDB_API_KEY = process.env.TMDB_API_KEY;
    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    const directorsSet = new Map(); // Usar Map para evitar duplicados por ID

    // 1. Buscar directores por nombre
    try {
      const personUrl = TMDB_ACCESS_TOKEN
        ? `${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(query)}&language=en-US`
        : `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;
      
      const personResponse = await fetch(personUrl, { headers });
      if (personResponse.ok) {
        const personData = await personResponse.json();
        if (personData.results) {
          for (const person of personData.results) {
            if (person.known_for_department?.toLowerCase() === 'directing' && person.id) {
              const profileImage = await fetchDirectorProfileImage(person.id);
              directorsSet.set(person.id, {
                id: person.id,
                name: person.name,
                profileUrl: profileImage?.profileUrl || null,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error searching directors:', error);
    }

    // 2. Buscar películas por título y obtener sus directores (solo si no hay suficientes directores)
    if (directorsSet.size < 5) {
      try {
        const movieUrl = TMDB_ACCESS_TOKEN
          ? `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(query)}&language=en-US`
          : `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;
        
        const movieResponse = await fetch(movieUrl, { headers });
        if (movieResponse.ok) {
          const movieData = await movieResponse.json();
          if (movieData.results) {
            // Limitar a las primeras 3 películas para hacer menos llamadas
            const moviesToProcess = movieData.results.slice(0, 3);
            
            // Procesar en paralelo con Promise.all pero con timeout
            const directorPromises = moviesToProcess.map(async (movie) => {
              if (movie.id) {
                try {
                  const director = await getMovieDirector(movie.id);
                  return director;
                } catch (error) {
                  console.error(`Error getting director for movie ${movie.id}:`, error);
                  return null;
                }
              }
              return null;
            });

            const directors = await Promise.all(directorPromises);
            
            for (const director of directors) {
              if (director && director.id && directorsSet.size < 10) {
                directorsSet.set(director.id, {
                  id: director.id,
                  name: director.name,
                  profileUrl: director.profileUrl || null,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error searching movies:', error);
      }
    }

    // Convertir Map a Array y limitar resultados
    const results = Array.from(directorsSet.values()).slice(0, 10);
    
    res.json(results);
  } catch (error) {
    console.error('Error in director search:', error);
    res.status(500).json({ message: 'Error searching directors' });
  }
});

// Obtener películas de un director por su ID
router.get('/director/:directorId/movies', async (req, res) => {
  try {
    const { directorId } = req.params;
    
    if (!directorId) {
      return res.status(400).json({ message: 'Director ID is required' });
    }

    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    // Obtener películas del director
    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/person/${directorId}/movie_credits?language=en-US`
      : `${TMDB_BASE_URL}/person/${directorId}/movie_credits?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Filtrar solo películas donde el director fue director (no productor, escritor, etc.)
    const directedMovies = (data.crew || [])
      .filter(movie => {
        if (!movie || !movie.id || !movie.poster_path) {
          return false;
        }
        const job = (movie.job || '').toLowerCase();
        const department = (movie.department || '').toLowerCase();
        return job === 'director' && department === 'directing';
      })
      .sort((a, b) => {
        // Ordenar por popularidad descendente, luego por fecha de lanzamiento
        const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
        if (popularityDiff !== 0) return popularityDiff;
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 20) // Limitar a 20 películas
      .map(movie => {
        // Normalizar formato de película para que sea consistente con searchMovies
        return {
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster_path,
          release_date: movie.release_date,
          vote_average: movie.vote_average,
          overview: movie.overview,
          genre_ids: movie.genre_ids || [],
          // Obtener runtime y director para las primeras 5 películas
          runtime: null,
          director: {
            id: parseInt(directorId),
            name: data.name || null
          }
        };
      });

    // Enriquecer las primeras 5 películas con runtime
    const enrichedMovies = await Promise.all(
      directedMovies.slice(0, 5).map(async (movie) => {
        try {
          const detailUrl = TMDB_ACCESS_TOKEN
            ? `${TMDB_BASE_URL}/movie/${movie.id}?language=en-US`
            : `${TMDB_BASE_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=en-US`;
          
          const detailResponse = await fetch(detailUrl, { headers });
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return {
              ...movie,
              runtime: detailData.runtime || null
            };
          }
        } catch (error) {
          console.error(`Error fetching details for movie ${movie.id}:`, error);
        }
        return movie;
      })
    );

    // Combinar películas enriquecidas con el resto
    const finalResults = [...enrichedMovies, ...directedMovies.slice(5)];
    
    res.json(finalResults);
  } catch (error) {
    console.error('Error fetching director movies:', error);
    res.status(500).json({ message: 'Error fetching director movies' });
  }
});

// Get all playlists for current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
       COALESCE(
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
       ) as movies
       FROM playlists p
       LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
       LEFT JOIN movies m ON pm.movie_id = m.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    
    // Obtener información del director para cada playlist usando el nombre del ciclo
    const playlistsWithDirectors = await Promise.all(
      result.rows.map(async (playlist) => {
        // El campo name ahora contiene el nombre del director
        let director = null;
        const directorName = playlist.name;
        
        console.log(`🔍 Buscando director para playlist "${directorName}":`);
        
        if (directorName && directorName.trim().length > 0) {
          try {
            director = await searchDirectorByName(directorName);
            if (director) {
              // Obtener la foto del director (igual que en /scheduled)
              const directorImage = await fetchDirectorProfileImage(director.id);
              director = {
                id: director.id,
                name: director.name,
                country: director.country || null,
                placeOfBirth: director.placeOfBirth || null,
                profileUrl: directorImage?.profileUrl || null,
              };
              console.log(`✅ Director encontrado para "${directorName}":`, {
                directorName: director.name,
                hasProfileUrl: !!director.profileUrl,
                profileUrl: director.profileUrl,
              });
            } else {
              console.warn(`⚠️  No se encontró director para "${directorName}"`);
            }
          } catch (error) {
            console.error(`❌ Error obteniendo director para playlist "${directorName}":`, error);
          }
        }

        return {
          ...playlist,
          director: director || null,
        };
      })
    );
    
    res.json(playlistsWithDirectors);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

// Get all scheduled playlists (for Home screen - public)
router.get('/scheduled', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
       json_build_object(
         'id', u.id,
         'username', u.username,
         'avatar', u.avatar
       ) as created_by_user,
       COALESCE(
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
       ) as movies
       FROM playlists p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
       LEFT JOIN movies m ON pm.movie_id = m.id
       WHERE p.scheduled_date IS NOT NULL
       GROUP BY p.id, u.id
       ORDER BY p.scheduled_date ASC`,
      []
    );
    
    // Obtener información del director para cada playlist usando el nombre del ciclo
    const playlistsWithDirectors = await Promise.all(
      result.rows.map(async (playlist) => {
        // El campo name ahora contiene el nombre del director
        let director = null;
        const directorName = playlist.name;
        
        console.log(`🔍 Buscando director para playlist "${directorName}":`);
        
        if (directorName && directorName.trim().length > 0) {
          try {
            director = await searchDirectorByName(directorName);
            if (director) {
              // Obtener la foto del director
              const directorImage = await fetchDirectorProfileImage(director.id);
              director = {
                id: director.id,
                name: director.name,
                country: director.country || null,
                placeOfBirth: director.placeOfBirth || null,
                profileUrl: directorImage?.profileUrl || null,
              };
              console.log(`✅ Director encontrado para "${directorName}":`, {
                directorName: director.name,
                hasProfileUrl: !!director.profileUrl,
                profileUrl: director.profileUrl,
              });
            } else {
              console.warn(`⚠️  No se encontró director para "${directorName}"`);
            }
          } catch (error) {
            console.error(`❌ Error obteniendo director para playlist "${directorName}":`, error);
          }
        }

        return {
          ...playlist,
          director: director || null,
        };
      })
    );
    
    // Debug: ver qué datos se están retornando
    if (playlistsWithDirectors.length > 0) {
      console.log('📅 Backend returning scheduled playlists:', playlistsWithDirectors.map(r => ({
        id: r.id,
        name: r.name,
        scheduled_date: r.scheduled_date,
        director: r.director ? r.director.name : null,
      })));
    }
    
    res.json(playlistsWithDirectors);
  } catch (error) {
    console.error('Error fetching scheduled playlists:', error);
    res.status(500).json({ message: 'Error fetching scheduled playlists' });
  }
});

// Get playlist by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, 
       COALESCE(
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
             'genre', m.genre,
             'ratings', COALESCE(
               (SELECT json_agg(
                 json_build_object(
                   'id', r.id,
                   'rating', r.rating,
                   'username', u.username,
                   'avatar', u.avatar,
                   'createdAt', r.created_at
                 ) ORDER BY r.created_at DESC
               )
               FROM ratings r
               JOIN users u ON r.user_id = u.id
               WHERE r.movie_id = m.id),
               '[]'
             )
           ) ORDER BY pm.order_index
         ) FILTER (WHERE m.id IS NOT NULL),
         '[]'
       ) as movies,
       COALESCE(
         (SELECT json_agg(
           json_build_object(
             'id', participant_data.id,
             'username', participant_data.username,
             'avatar', participant_data.avatar
           )
         )
         FROM (
           SELECT DISTINCT u.id, u.username, u.avatar
           FROM festivals f
           LEFT JOIN festival_participants fp ON f.id = fp.festival_id
           LEFT JOIN users u ON fp.user_id = u.id
           WHERE f.playlist_id = p.id AND u.id IS NOT NULL
         ) participant_data),
         '[]'
       ) as participants
       FROM playlists p
       LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
       LEFT JOIN movies m ON pm.movie_id = m.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const playlistData = result.rows[0];
    
    // Obtener información del director usando el nombre del ciclo (igual que en /scheduled)
    let director = null;
    const directorName = playlistData.name;
    
    console.log(`🔍 Buscando director para playlist "${directorName}":`);
    
    if (directorName && directorName.trim().length > 0) {
      try {
        director = await searchDirectorByName(directorName);
        if (director) {
          // Obtener la foto del director (igual que en /scheduled)
          const directorImage = await fetchDirectorProfileImage(director.id);
          director = {
            id: director.id,
            name: director.name,
            country: director.country || null,
            placeOfBirth: director.placeOfBirth || null,
            profileUrl: directorImage?.profileUrl || null,
          };
          console.log(`✅ Director encontrado para "${directorName}":`, {
            directorName: director.name,
            hasProfileUrl: !!director.profileUrl,
            profileUrl: director.profileUrl,
          });
        } else {
          console.warn(`⚠️  No se encontró director para "${directorName}"`);
        }
      } catch (error) {
        console.error(`❌ Error obteniendo director para playlist "${directorName}":`, error);
      }
    }

    const responseData = {
      ...playlistData,
      director: director || null,
    };

    console.log('📅 Backend returning playlist:', {
      id: responseData.id,
      name: responseData.name,
      scheduled_date: responseData.scheduled_date,
      director: director ? director.name : null,
      hasProfileUrl: !!director?.profileUrl,
      hasCountry: !!director?.country,
    });

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ message: 'Error fetching playlist' });
  }
});

// Create playlist
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, date } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Si hay fecha, agregarla a la consulta
    let query, values;
    if (date) {
      query = 'INSERT INTO playlists (user_id, name, scheduled_date) VALUES ($1, $2, $3) RETURNING *';
      values = [req.user.id, name.trim(), date];
    } else {
      query = 'INSERT INTO playlists (user_id, name) VALUES ($1, $2) RETURNING *';
      values = [req.user.id, name.trim()];
    }

    const result = await pool.query(query, values);

    res.status(201).json({ ...result.rows[0], movies: [] });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

// Add movie to playlist
router.post('/:id/movies', authenticateToken, async (req, res) => {
  try {
    const { movieId } = req.body;
    const playlistId = req.params.id;

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

    // Get current max order_index
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(order_index), -1) as max_order FROM playlist_movies WHERE playlist_id = $1',
      [playlistId]
    );

    const nextOrder = maxOrder.rows[0].max_order + 1;

    await pool.query(
      'INSERT INTO playlist_movies (playlist_id, movie_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [playlistId, movieId, nextOrder]
    );

    // Return updated playlist
    const result = await pool.query(
      `SELECT p.*, 
       COALESCE(
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
       ) as movies
       FROM playlists p
       LEFT JOIN playlist_movies pm ON p.id = pm.playlist_id
       LEFT JOIN movies m ON pm.movie_id = m.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [playlistId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding movie to playlist:', error);
    res.status(500).json({ message: 'Error adding movie to playlist' });
  }
});

// Remove movie from playlist
router.delete('/:id/movies/:movieId', authenticateToken, async (req, res) => {
  try {
    const { id, movieId } = req.params;

    // Verify playlist ownership
    const playlistCheck = await pool.query(
      'SELECT user_id FROM playlists WHERE id = $1',
      [id]
    );

    if (playlistCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlistCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await pool.query(
      'DELETE FROM playlist_movies WHERE playlist_id = $1 AND movie_id = $2',
      [id, movieId]
    );

    res.json({ message: 'Movie removed from playlist' });
  } catch (error) {
    console.error('Error removing movie from playlist:', error);
    res.status(500).json({ message: 'Error removing movie from playlist' });
  }
});

// Delete playlist
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify playlist ownership
    const playlistCheck = await client.query(
      'SELECT user_id FROM playlists WHERE id = $1',
      [req.params.id]
    );

    if (playlistCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlistCheck.rows[0].user_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete playlist (CASCADE will automatically delete related records in playlist_movies, festivals, etc.)
    await client.query('DELETE FROM playlists WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting playlist:', error);
    res.status(500).json({ message: 'Error deleting playlist' });
  } finally {
    client.release();
  }
});

module.exports = router;

