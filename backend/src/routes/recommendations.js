const express = require('express');
const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w185'; // Tamaño estándar para fotos de perfil
const DAILY_GENERATION_HOUR = 5; // 5:00 AM

let cachedRecommendations = null;
let lastGeneratedDayKey = null;
let lastGeneratedAt = null;

const directorSearchCache = new Map();

function buildPosterUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${POSTER_BASE_URL}${path}`;
}

function normalizeMovieRecord(movie) {
  if (!movie || !movie.id) {
    return null;
  }

  const posterPath = movie.poster_path || movie.poster;
  const poster = buildPosterUrl(posterPath);

  return {
    id: movie.id,
    title: movie.title || movie.name || 'Sin título',
    poster,
    release_date: movie.release_date || movie.first_air_date || null,
    overview: movie.overview || 'Sinopsis no disponible.',
    popularity: movie.popularity || 0,
  };
}

function getDayKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function shouldGenerateNewSet(now = new Date()) {
  if (!cachedRecommendations) return true;
  const currentDayKey = getDayKey(now);
  const generatedToday = currentDayKey === lastGeneratedDayKey;
  if (!generatedToday && now.getHours() >= DAILY_GENERATION_HOUR) {
    return true;
  }
  return false;
}

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

    return {
      profilePath,
      profileUrl,
    };
  } catch (error) {
    console.error(`Error fetching images for person ${personId}:`, error);
    return null;
  }
}

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

async function fetchTrendingDirectorNames(limit = 20) {
  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/trending/person/day?language=en-US`
      : `${TMDB_BASE_URL}/trending/person/day?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB trending/person error: ${response.status}`);
    }

    const data = await response.json();
    const names = [];
    for (const person of data.results || []) {
      if (
        person &&
        (person.known_for_department || '').toLowerCase() === 'directing' &&
        person.name
      ) {
        names.push(person.name);
        if (names.length >= limit) {
          break;
        }
      }
    }

    return names;
  } catch (error) {
    console.error('Error fetching trending directors:', error);
    return [];
  }
}

async function searchDirectorByName(name) {
  const cacheKey = name.toLowerCase();
  if (directorSearchCache.has(cacheKey)) {
    return directorSearchCache.get(cacheKey);
  }

  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`, accept: 'application/json' }
      : { accept: 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/search/person?query=${encodeURIComponent(name)}&language=en-US`
      : `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=en-US`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB search/person error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      console.warn(`⚠️  No se encontraron resultados para el director "${name}".`);
      return null;
    }

    const directingMatch =
      data.results.find(
        (person) =>
          (person.known_for_department || '').toLowerCase() === 'directing'
      ) || data.results[0];

    if (!directingMatch) {
      console.warn(`⚠️  Resultados sin coincidencias de dirección para "${name}".`);
      return null;
    }

    const knownForMovies = (directingMatch.known_for || [])
      .filter(
        (item) =>
          item &&
          item.id &&
          (item.media_type === 'movie' || item.media_type === 'tv') &&
          item.poster_path
      )
      .map((item) => normalizeMovieRecord(item))
      .filter(Boolean);

    const directorDetails = await fetchDirectorDetails(directingMatch.id);

    const result = {
      id: directingMatch.id,
      name: directingMatch.name || name,
      placeOfBirth: directorDetails?.placeOfBirth || null,
      country: directorDetails?.country || null,
      profilePath: directorDetails?.profilePath || null,
      profileUrl: directorDetails?.profileUrl || null,
      knownForMovies,
    };

    directorSearchCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error(`Error buscando director "${name}":`, error);
    return null;
  }
}

async function isMovieDirectedBy(movieId, directorId) {
  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'accept': 'application/json' }
      : { 'accept': 'application/json' };

    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/movie/${movieId}/credits?language=en-US`
      : `${TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`TMDB movie credits error: ${response.status}`);
    }

    const credits = await response.json();
    return (credits.crew || []).some(
      (member) =>
        member &&
        member.id === directorId &&
        (member.job || '').toLowerCase() === 'director'
    );
  } catch (error) {
    console.error(`Error verifying director for movie ${movieId}:`, error);
    return false;
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

    // Obtener detalles del director incluyendo la foto
    const directorDetails = await fetchDirectorDetails(director.id);

    return {
      id: director.id,
      name: director.name,
      profileUrl: directorDetails?.profileUrl || null,
    };
  } catch (error) {
    console.error(`Error getting director for movie ${tmdbId}:`, error);
    return null;
  }
}

async function tryAddMovieCandidate(movie, directorId, directedMovies, seenMovieIds) {
  if (!movie || !movie.id || seenMovieIds.has(movie.id)) {
    return;
  }

  const isDirectedBy = await isMovieDirectedBy(movie.id, directorId);
  if (!isDirectedBy) {
    console.log(`↪️  Omitiendo ${movie.title || movie.name} (no es dirigida por el director con ID ${directorId}).`);
    return;
  }

  const normalizedMovie = normalizeMovieRecord(movie);
  if (!normalizedMovie || !normalizedMovie.poster) {
    return;
  }

  seenMovieIds.add(movie.id);
  directedMovies.push(normalizedMovie);
}

// Función para obtener películas de un director desde TMDB
async function getDirectorMovies(directorId, directorName, options = {}) {
  const { preferredMovies = [], limit = 12 } = options;
  try {
    const headers = TMDB_ACCESS_TOKEN
      ? { 'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 'accept': 'application/json' }
      : { 'accept': 'application/json' };

    const directedMovies = [];
    const seenMovieIds = new Set();

    for (const movie of preferredMovies) {
      if (directedMovies.length >= limit) {
        break;
      }
      await tryAddMovieCandidate(movie, directorId, directedMovies, seenMovieIds);
    }

    if (directedMovies.length >= limit) {
      return directedMovies;
    }

    // Obtener películas adicionales del director
    const url = TMDB_ACCESS_TOKEN
      ? `${TMDB_BASE_URL}/person/${directorId}/movie_credits?language=en-US`
      : `${TMDB_BASE_URL}/person/${directorId}/movie_credits?api_key=${TMDB_API_KEY}&language=en-US`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    
    const uniqueDirectedMovies = [];

    (data.crew || []).forEach(movie => {
      if (!movie || !movie.id || seenMovieIds.has(movie.id)) {
        return;
      }

      const job = (movie.job || '').toLowerCase();
      const department = (movie.department || '').toLowerCase();

      if (job === 'director' && department === 'directing' && movie.poster_path) {
        uniqueDirectedMovies.push(movie);
      }
    });

    const sortedCandidates = uniqueDirectedMovies
      .sort((a, b) => {
        if (b.popularity !== a.popularity) {
          return (b.popularity || 0) - (a.popularity || 0);
        }
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 20);

    for (const movie of sortedCandidates) {
      if (directedMovies.length >= limit) {
        break;
      }
      await tryAddMovieCandidate(movie, directorId, directedMovies, seenMovieIds);
    }

    if (directedMovies.length === 0) {
      console.warn(`⚠️  Director ${directorName} no tiene películas verificadas con poster disponible.`);
    }

    return directedMovies;
  } catch (error) {
    console.error(`Error fetching movies for director ${directorName}:`, error);
    return [];
  }
}

async function getDirectorNameCandidates(count = 4) {
  // Obtener más directores de los que necesitamos para tener opciones
  const allNames = await fetchTrendingDirectorNames(20);
  
  if (!allNames || allNames.length === 0) {
    return [];
  }

  // Mezclar aleatoriamente y seleccionar exactamente 'count' directores
  const shuffled = [...allNames].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Funciones de fallback para nombre, descripción y rating (sin Gemini)
function generateCycleNameFallback(directorName) {
  const lastName = directorName.split(' ').pop();
  const names = [
    `${lastName} Essentials`,
    `Ciclo ${lastName}`,
    `${lastName} Collection`,
  ];
  return names[Math.floor(Math.random() * names.length)];
}

function generateDescriptionFallback(directorName, movies) {
  const DIRECTOR_STYLE_PROFILES = {
    'Christopher Nolan': {
      signature: 'entreteje paradojas temporales con precisión matemática',
      focus: 'Su pulso cerebral se expande',
      texture: 'combinando tensión épica con atmósferas de ciencia ficción',
    },
    'Quentin Tarantino': {
      signature: 'combina diálogos afilados con violencia coreografiada',
      focus: 'Su estilo grindhouse reverbera',
      texture: 'alimentando homenajes pop y ritmo vertiginoso',
    },
    'Martin Scorsese': {
      signature: 'explora moralidad y culpa con cámara inquieta',
      focus: 'Su narración operística resalta',
      texture: 'mostrando personajes complejos y música envolvente',
    },
    'Steven Spielberg': {
      signature: 'fusiona asombro infantil con espectáculo cinematográfico',
      focus: 'Su mirada humanista guía cada set piece',
      texture: 'creando aventuras emotivas llenas de imaginación',
    },
    'Denis Villeneuve': {
      signature: 'esculpe ciencia ficción contemplativa y melancólica',
      focus: 'Su control del silencio y la escala es hipnótico',
      texture: 'bañando cada imagen en un futurismo sensorial',
    },
    'Wes Anderson': {
      signature: 'dibuja simetrías pop repletas de melancolía',
      focus: 'Su paleta pastel narra obsesiones familiares',
      texture: 'mezclando humor seco con coreografías milimétricas',
    },
    'David Fincher': {
      signature: 'desmenuza obsesiones oscuras con precisión quirúrgica',
      focus: 'Su dirección fría y meticulosa atenaza',
      texture: 'sumergiendo cada plano en tensión psicológica',
    },
    'Bong Joon-ho': {
      signature: 'salta entre géneros para desnudar la desigualdad',
      focus: 'Su humor negro y suspenso social impactan',
      texture: 'tejiendo sátira, empatía y caos visual',
    },
    'Alejandro González Iñárritu': {
      signature: 'confronta el destino con cámara inmersiva y catártica',
      focus: 'Su sensibilidad emocional vibra',
      texture: 'mientras alterna realismo brutal y poesía visual',
    },
    'Alfonso Cuarón': {
      signature: 'abraza planos secuencia que flotan entre intimidad y vértigo',
      focus: 'Su humanismo detallista ilumina cada escena',
      texture: 'fundiendo naturalismo y asombro técnico',
    },
  };

  const DEFAULT_STYLE_PROFILE = {
    signature: 'moldea relatos autorales de personalidad inconfundible',
    focus: 'Su pulso narrativo imprime carácter',
    texture: 'mezclando sensibilidad visual con riesgo temático',
  };

  const matchKey = Object.keys(DIRECTOR_STYLE_PROFILES).find(
    (key) => key.toLowerCase() === directorName.toLowerCase()
  );
  const profile = DIRECTOR_STYLE_PROFILES[matchKey] || DEFAULT_STYLE_PROFILE;

  const sample = (movies || [])
    .map((m) => m.title)
    .filter(Boolean)
    .slice(0, 2);
  
  const highlight = sample.length === 2 
    ? `${sample[0]} y ${sample[1]}`
    : sample.length === 1 
    ? sample[0]
    : 'estas películas';

  const line1 = `${directorName} ${profile.signature}.`;
  const line2 = `${profile.focus} en ${highlight}, ${profile.texture}.`;
  return `${line1}\n${line2}`;
}

function generateRatingFallback() {
  // Rating aleatorio entre 7.5 y 9.5
  return parseFloat((Math.random() * 2 + 7.5).toFixed(1));
}

async function buildDailyRecommendations() {
  const nameCandidates = await getDirectorNameCandidates(4);

  if (!nameCandidates.length) {
    throw new Error('No se obtuvieron candidatos de directores.');
  }

  const recommendations = [];

  for (const name of nameCandidates) {
    if (recommendations.length >= 4) {
      break;
    }

    const director = await searchDirectorByName(name);
    if (!director) {
      continue;
    }

    const candidateMovies = await getDirectorMovies(director.id, director.name, {
      preferredMovies: director.knownForMovies,
      limit: 12,
    });

    if (!candidateMovies || candidateMovies.length < 4) {
      console.warn(`⚠️  Director ${director.name} no tiene suficientes películas candidatas.`);
      continue;
    }

    // Seleccionar las mejores 6 películas basándose en popularidad y fecha
    const selectedMovies = candidateMovies
      .sort((a, b) => {
        // Priorizar popularidad, luego fecha más reciente
        if (b.popularity !== a.popularity) {
          return (b.popularity || 0) - (a.popularity || 0);
        }
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 6);

    if (!selectedMovies || selectedMovies.length < 4) {
      console.warn(`⚠️  No se pudieron seleccionar suficientes películas para ${director.name}.`);
      continue;
    }

    // Usar funciones de fallback (sin Gemini)
    const cycleName = generateCycleNameFallback(director.name);
    const description = generateDescriptionFallback(director.name, selectedMovies);
    const rating = generateRatingFallback();

    recommendations.push({
      director: director.name,
      directorId: director.id,
      directorCountry: director.country || null,
      placeOfBirth: director.placeOfBirth || null,
      cycleName,
      description,
      rating,
      movies: selectedMovies,
    });
  }

  if (!recommendations.length) {
    throw new Error('No se generaron recomendaciones de directores.');
  }

  cachedRecommendations = recommendations;
  lastGeneratedDayKey = getDayKey();
  lastGeneratedAt = new Date();

  return recommendations;
}

// Get director-based recommendations
router.get('/directors', async (req, res) => {
  try {
    if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
      return res.status(500).json({ 
        message: 'TMDB authentication not configured. Add TMDB_ACCESS_TOKEN or TMDB_API_KEY to .env' 
      });
    }

    if (shouldGenerateNewSet()) {
      try {
        await buildDailyRecommendations();
      } catch (generationError) {
        console.error('Error generando recomendaciones del día:', generationError);
        if (!cachedRecommendations) {
          return res.status(500).json({ message: 'No se pudieron generar recomendaciones en este momento.' });
        }
      }
    }

    if (!cachedRecommendations) {
      await buildDailyRecommendations();
    }

    res.json(cachedRecommendations);
  } catch (error) {
    console.error('Error fetching director recommendations:', error);
    res.status(500).json({ message: 'Error fetching recommendations' });
  }
});

module.exports = router;

