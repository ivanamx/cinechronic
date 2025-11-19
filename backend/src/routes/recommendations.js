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

async function fetchPopularDirectors() {
  try {
    // Verificar que tengamos al menos una forma de autenticación
    if (!TMDB_ACCESS_TOKEN && !TMDB_API_KEY) {
      console.error('❌ No hay TMDB_ACCESS_TOKEN ni TMDB_API_KEY configurados');
      return [];
    }

    const headers = TMDB_ACCESS_TOKEN
      ? { 
          'Authorization': `Bearer ${TMDB_ACCESS_TOKEN}`, 
          'accept': 'application/json' 
        }
      : { 
          'accept': 'application/json' 
        };

    const allDirectors = new Map(); // Usar Map para evitar duplicados por ID
    
    // ESTRATEGIA 1: Obtener directores de películas populares (más confiable)
    console.log('🎬 Estrategia 1: Obteniendo directores de películas populares...');
    try {
      // Obtener películas populares
      const moviesUrl = TMDB_ACCESS_TOKEN
        ? `${TMDB_BASE_URL}/movie/popular?language=en-US&page=1`
        : `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
      
      const moviesResponse = await fetch(moviesUrl, { headers });
      if (moviesResponse.ok) {
        const moviesData = await moviesResponse.json();
        const popularMovies = (moviesData.results || []).slice(0, 20); // Primeras 20 películas
        
        console.log(`📽️  Obteniendo directores de ${popularMovies.length} películas populares...`);
        
        // Obtener directores de cada película
        for (const movie of popularMovies) {
          if (!movie.id) continue;
          
          try {
            const creditsUrl = TMDB_ACCESS_TOKEN
              ? `${TMDB_BASE_URL}/movie/${movie.id}/credits?language=en-US`
              : `${TMDB_BASE_URL}/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
            
            const creditsResponse = await fetch(creditsUrl, { headers });
            if (creditsResponse.ok) {
              const creditsData = await creditsResponse.json();
              const director = (creditsData.crew || []).find(
                (member) => member && (member.job || '').toLowerCase() === 'director'
              );
              
              if (director && director.id && !allDirectors.has(director.id)) {
                allDirectors.set(director.id, {
                  id: director.id,
                  name: director.name,
                });
                if (allDirectors.size <= 10) {
                  console.log(`  ✅ Director encontrado: ${director.name} (de ${movie.title})`);
                }
              }
            }
            
            // Pequeño delay para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            console.warn(`⚠️  Error obteniendo director de película ${movie.id}:`, error.message);
            continue;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️  Error en estrategia 1:', error.message);
    }

    // ESTRATEGIA 2: Si no tenemos suficientes, usar trending people
    if (allDirectors.size < 10) {
      console.log('📈 Estrategia 2: Obteniendo directores de trending people...');
      try {
        const trendingUrl = TMDB_ACCESS_TOKEN
          ? `${TMDB_BASE_URL}/trending/person/week?language=en-US`
          : `${TMDB_BASE_URL}/trending/person/week?api_key=${TMDB_API_KEY}&language=en-US`;
        
        const trendingResponse = await fetch(trendingUrl, { headers });
        if (trendingResponse.ok) {
          const trendingData = await trendingResponse.json();
          const trendingPeople = trendingData.results || [];
          
          for (const person of trendingPeople) {
            if (!person || !person.id || !person.name) continue;
            
            const department = (person.known_for_department || '').toLowerCase();
            if (department === 'directing' && !allDirectors.has(person.id)) {
              allDirectors.set(person.id, {
                id: person.id,
                name: person.name,
              });
              if (allDirectors.size <= 15) {
                console.log(`  ✅ Director trending encontrado: ${person.name}`);
              }
            }
          }
        }
      } catch (error) {
        console.warn('⚠️  Error en estrategia 2:', error.message);
      }
    }

    // ESTRATEGIA 3: Si aún no tenemos suficientes, buscar directores de top rated movies
    if (allDirectors.size < 10) {
      console.log('⭐ Estrategia 3: Obteniendo directores de top rated movies...');
      try {
        const topRatedUrl = TMDB_ACCESS_TOKEN
          ? `${TMDB_BASE_URL}/movie/top_rated?language=en-US&page=1`
          : `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
        
        const topRatedResponse = await fetch(topRatedUrl, { headers });
        if (topRatedResponse.ok) {
          const topRatedData = await topRatedResponse.json();
          const topMovies = (topRatedData.results || []).slice(0, 15);
          
          for (const movie of topMovies) {
            if (!movie.id || allDirectors.size >= 20) break;
            
            try {
              const creditsUrl = TMDB_ACCESS_TOKEN
                ? `${TMDB_BASE_URL}/movie/${movie.id}/credits?language=en-US`
                : `${TMDB_BASE_URL}/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
              
              const creditsResponse = await fetch(creditsUrl, { headers });
              if (creditsResponse.ok) {
                const creditsData = await creditsResponse.json();
                const director = (creditsData.crew || []).find(
                  (member) => member && (member.job || '').toLowerCase() === 'director'
                );
                
                if (director && director.id && !allDirectors.has(director.id)) {
                  allDirectors.set(director.id, {
                    id: director.id,
                    name: director.name,
                  });
                }
              }
              
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              continue;
            }
          }
        }
      } catch (error) {
        console.warn('⚠️  Error en estrategia 3:', error.message);
      }
    }

    const directorsArray = Array.from(allDirectors.values());
    console.log(`✅ Se encontraron ${directorsArray.length} directores únicos usando métodos dinámicos`);
    return directorsArray;
  } catch (error) {
    console.error('❌ Error fetching popular directors:', error);
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

// Países latinoamericanos
const LATIN_AMERICAN_COUNTRIES = [
  'Mexico', 'México', 'Argentina', 'Chile', 'Colombia', 'Brazil', 'Brasil',
  'Peru', 'Perú', 'Venezuela', 'Uruguay', 'Paraguay', 'Ecuador', 'Bolivia',
  'Cuba', 'Dominican Republic', 'Puerto Rico', 'Costa Rica', 'Panama', 'Panamá',
  'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua'
];

function isLatinAmerican(country) {
  if (!country) return false;
  const normalized = country.trim();
  return LATIN_AMERICAN_COUNTRIES.some(
    latamCountry => latamCountry.toLowerCase() === normalized.toLowerCase()
  );
}

async function getDirectorCandidates(count = 4) {
  // Obtener directores populares de TMDB
  const allDirectors = await fetchPopularDirectors();
  
  console.log(`🔍 getDirectorCandidates: se obtuvieron ${allDirectors?.length || 0} directores`);
  
  if (!allDirectors || allDirectors.length === 0) {
    console.error('❌ No se obtuvieron directores');
    return [];
  }

  // Obtener detalles de todos los directores para verificar países
  const directorsWithDetails = [];
  for (const director of allDirectors) {
    const details = await fetchDirectorDetails(director.id);
    if (details) {
      directorsWithDetails.push({
        ...director,
        country: details.country,
        placeOfBirth: details.placeOfBirth,
      });
    } else {
      // Si no se pueden obtener detalles, incluir sin país
      directorsWithDetails.push({
        ...director,
        country: null,
        placeOfBirth: null,
      });
    }
  }

  // Separar directores latinoamericanos y no latinoamericanos
  const latinAmericanDirectors = directorsWithDetails.filter(d => isLatinAmerican(d.country));
  const otherDirectors = directorsWithDetails.filter(d => !isLatinAmerican(d.country));

  console.log(`🌎 Directores latinoamericanos encontrados: ${latinAmericanDirectors.length}`);
  console.log(`🌍 Otros directores: ${otherDirectors.length}`);

  const selected = [];
  
  // Garantizar que al menos uno sea latinoamericano
  if (latinAmericanDirectors.length > 0) {
    const shuffledLatin = [...latinAmericanDirectors].sort(() => Math.random() - 0.5);
    selected.push(shuffledLatin[0]);
    console.log(`✅ Director latinoamericano seleccionado: ${shuffledLatin[0].name} (${shuffledLatin[0].country})`);
  } else {
    console.warn('⚠️  No se encontraron directores latinoamericanos en los candidatos');
  }

  // Completar con otros directores aleatorios
  const shuffledOthers = [...otherDirectors].sort(() => Math.random() - 0.5);
  const remaining = count - selected.length;
  for (let i = 0; i < remaining && i < shuffledOthers.length; i++) {
    selected.push(shuffledOthers[i]);
  }

  // Mezclar el resultado final para que el latinoamericano no siempre esté primero
  const finalSelected = selected.sort(() => Math.random() - 0.5).slice(0, count);
  
  console.log(`✅ Seleccionados ${finalSelected.length} directores:`, finalSelected.map(d => `${d.name}${d.country ? ` (${d.country})` : ''}`));
  
  return finalSelected;
}

// Funciones para nombre, descripción y rating
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
  const directorCandidates = await getDirectorCandidates(4);

  if (!directorCandidates.length) {
    throw new Error('No se obtuvieron candidatos de directores.');
  }

  const recommendations = [];

  for (const candidate of directorCandidates) {
    if (recommendations.length >= 4) {
      break;
    }

    // Usar detalles ya obtenidos en getDirectorCandidates, o obtenerlos si faltan
    let directorDetails;
    if (candidate.country !== undefined || candidate.placeOfBirth !== undefined) {
      // Ya tenemos algunos detalles, obtener los completos (foto, etc.)
      directorDetails = await fetchDirectorDetails(candidate.id);
      // Si falla, usar los datos básicos que ya tenemos
      if (!directorDetails) {
        directorDetails = {
          country: candidate.country || null,
          placeOfBirth: candidate.placeOfBirth || null,
          profilePath: null,
          profileUrl: null,
        };
      }
    } else {
      // No tenemos detalles, obtenerlos ahora
      directorDetails = await fetchDirectorDetails(candidate.id);
      if (!directorDetails) {
        console.warn(`⚠️  No se pudieron obtener detalles para ${candidate.name}`);
        continue;
      }
    }

    // Buscar películas del director
    const candidateMovies = await getDirectorMovies(candidate.id, candidate.name, {
      preferredMovies: [],
      limit: 20, // Obtener más para tener opciones
    });

    if (!candidateMovies || candidateMovies.length === 0) {
      console.warn(`⚠️  Director ${candidate.name} no tiene películas disponibles.`);
      continue;
    }

    // Seleccionar las mejores 4 películas basándose en popularidad y fecha
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
      .slice(0, 6); // Aumentar a 6 películas para tener más margen

    if (!selectedMovies || selectedMovies.length === 0) {
      console.warn(`⚠️  No se pudieron seleccionar películas para ${candidate.name}.`);
      continue;
    }

    // Generar nombre, descripción y rating
    const cycleName = generateCycleNameFallback(candidate.name);
    const description = generateDescriptionFallback(candidate.name, selectedMovies);
    const rating = generateRatingFallback();

    recommendations.push({
      director: candidate.name,
      directorId: candidate.id,
      directorCountry: directorDetails?.country || null,
      placeOfBirth: directorDetails?.placeOfBirth || null,
      cycleName,
      description,
      rating,
      movies: selectedMovies,
    });
  }

  // Si no hay suficientes recomendaciones, agregar mensaje
  if (recommendations.length < 4) {
    console.warn(`⚠️  Solo se generaron ${recommendations.length} recomendaciones de 4 esperadas`);
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

    console.log('🔍 Verificando si se deben generar nuevas recomendaciones...');
    if (shouldGenerateNewSet()) {
      console.log('🔄 Generando nuevas recomendaciones del día...');
      try {
        const newRecommendations = await buildDailyRecommendations();
        console.log(`✅ Se generaron ${newRecommendations?.length || 0} recomendaciones`);
      } catch (generationError) {
        console.error('❌ Error generando recomendaciones del día:', generationError);
        if (!cachedRecommendations) {
          return res.status(500).json({ message: 'No se pudieron generar recomendaciones en este momento.' });
        }
        console.log('⚠️  Usando recomendaciones en caché debido al error');
      }
    } else {
      console.log('✅ Usando recomendaciones en caché');
    }

    if (!cachedRecommendations || cachedRecommendations.length === 0) {
      console.log('🔄 No hay caché, generando recomendaciones ahora...');
      await buildDailyRecommendations();
    }

    console.log(`📤 Enviando ${cachedRecommendations?.length || 0} recomendaciones al frontend`);

    // Si no hay suficientes recomendaciones, agregar mensaje
    const response = {
      recommendations: cachedRecommendations || [],
      message: (cachedRecommendations?.length || 0) < 4 
        ? 'Regresa más tarde para más recomendaciones' 
        : null
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching director recommendations:', error);
    res.status(500).json({ message: 'Error fetching recommendations' });
  }
});

module.exports = router;

