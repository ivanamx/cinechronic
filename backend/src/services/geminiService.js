// Servicio para interactuar con Google Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


// Función para llamar a Gemini
async function callGemini(prompt, options = {}) {
  if (!GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY no configurada, usando valores por defecto');
    return null;
  }

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: options.model || 'gemini-pro' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
}

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
  'Coen Brothers': {
    signature: 'entrelazan humor absurdo con fatalismo noir',
    focus: 'Su ironía meta y personajes excéntricos encantan',
    texture: 'mezclando folk americano con violencia inesperada',
  },
  'Paul Thomas Anderson': {
    signature: 'retrata obsesiones americanas con lirismo expansivo',
    focus: 'Su cámara fluida respira junto a personajes frágiles',
    texture: 'dejando capas de deseo, poder y espiritualidad',
  },
};

const DEFAULT_STYLE_PROFILE = {
  signature: 'moldea relatos autorales de personalidad inconfundible',
  focus: 'Su pulso narrativo imprime carácter',
  texture: 'mezclando sensibilidad visual con riesgo temático',
};

function getStyleProfile(directorName) {
  if (!directorName) return DEFAULT_STYLE_PROFILE;
  const matchKey = Object.keys(DIRECTOR_STYLE_PROFILES).find(
    (key) => key.toLowerCase() === directorName.toLowerCase()
  );
  return DIRECTOR_STYLE_PROFILES[matchKey] || DEFAULT_STYLE_PROFILE;
}

function formatHighlightTitles(movies) {
  const sample = (movies || [])
    .map((m) => m.title)
    .filter(Boolean)
    .slice(0, 2);

  if (sample.length === 2) {
    return `${sample[0]} y ${sample[1]}`;
  }
  if (sample.length === 1) {
    return sample[0];
  }
  return 'estas películas';
}

function buildFallbackDescription(directorName, movies) {
  const profile = getStyleProfile(directorName);
  const highlight = formatHighlightTitles(movies);
  const line1 = `${directorName} ${profile.signature}.`;
  const line2 = `${profile.focus} en ${highlight}, ${profile.texture}.`;
  return `${line1}\n${line2}`;
}

function ensureTwoLines(text, directorName, movies) {
  const cleaned = (text || '').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return buildFallbackDescription(directorName, movies);
  }

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length >= 2) {
    return `${sentences[0]}\n${sentences[1]}`;
  }

  if (sentences.length === 1) {
    const sentence = sentences[0];
    if (sentence.length > 160) {
      const midpoint = Math.floor(sentence.length / 2);
      const splitIndex =
        sentence.indexOf(' ', midpoint) !== -1
          ? sentence.indexOf(' ', midpoint)
          : midpoint;
      const first = sentence.slice(0, splitIndex).trim();
      const second = sentence.slice(splitIndex).trim();
      if (first && second) {
        return `${first}.\n${second}`;
      }
    }
    const fallbackSecondLine = buildFallbackDescription(directorName, movies).split('\n')[1];
    return `${sentence}\n${fallbackSecondLine}`;
  }

  return buildFallbackDescription(directorName, movies);
}

// Generar nombre del ciclo (2-3 palabras) usando Gemini
async function generateCycleName(directorName, movies) {
  if (!GEMINI_API_KEY) {
    // Fallback si no hay API key
    const lastName = directorName.split(' ').pop();
    const names = [
      `${lastName} Essentials`,
      `Ciclo ${lastName}`,
      `${lastName} Collection`,
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  const movieTitles = movies.slice(0, 3).map(m => m.title).join(', ');
  const prompt = `Genera un nombre creativo de 2 a 3 palabras para un ciclo de cine del director ${directorName}. 
Las películas incluidas son: ${movieTitles}.
El nombre debe ser corto, atractivo y relacionado con el estilo del director.
Responde SOLO con el nombre, sin explicaciones ni comillas.`;

  const response = await callGemini(prompt);
  if (response) {
    // Limpiar la respuesta (quitar comillas, espacios extra, etc.)
    return response.trim().replace(/^["']|["']$/g, '').trim();
  }

  // Fallback si Gemini falla
  const lastName = directorName.split(' ').pop();
  return `${lastName} Essentials`;
}

function parseListResponse(response) {
  if (!response) return [];
  const cleaned = response
    .replace(/\r/g, '\n')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(cleaned)];
}

function normalizeIndicesResponse(response, total) {
  if (!response) return [];
  const match = response.match(/[\[\(]?([\d,\s]+)/);
  const text = match ? match[1] : response;
  const indices = text
    .split(/[\s,]+/)
    .map((value) => parseInt(value, 10))
    .filter((value) => !isNaN(value) && value >= 1 && value <= total);
  return [...new Set(indices)];
}

// Generar descripción usando Gemini
async function generateDescription(directorName, movies) {
  if (!GEMINI_API_KEY) {
    return buildFallbackDescription(directorName, movies);
  }

  const movieTitles = movies.map(m => m.title).join(', ');
  const prompt = `Escribe EXACTAMENTE dos oraciones en español para describir el estilo cinematográfico del director ${directorName}.
Contexto de películas incluidas: ${movieTitles || 'sin títulos específicos'}.
La primera oración debe describir tono, ritmo o rasgos visuales del director.
La segunda debe mencionar de forma concreta 1 o 2 películas de la lista o relacionar este ciclo con su estilo.
Incluye un salto de línea entre ambas oraciones y no añadas texto adicional.`;

  const response = await callGemini(prompt);
  if (response) {
    return ensureTwoLines(response, directorName, movies);
  }

  // Fallback si Gemini falla
  return buildFallbackDescription(directorName, movies);
}

// Calcular rating usando Gemini
async function generateRating(directorName, movies) {
  if (!GEMINI_API_KEY) {
    // Fallback: rating aleatorio entre 7.5 y 9.5
    return parseFloat((Math.random() * 2 + 7.5).toFixed(1));
  }

  const movieTitles = movies.map(m => m.title).join(', ');
  const prompt = `Evalúa la calidad general de un ciclo de cine del director ${directorName} con las siguientes películas: ${movieTitles}.
Califica del 1 al 10 (con un decimal) considerando la calidad cinematográfica, coherencia del ciclo, y relevancia del director.
Responde SOLO con el número (ejemplo: 8.5), sin explicaciones ni texto adicional.`;

  const response = await callGemini(prompt);
  if (response) {
    const rating = parseFloat(response.trim());
    if (!isNaN(rating) && rating >= 1 && rating <= 10) {
      return parseFloat(rating.toFixed(1));
    }
  }

  // Fallback si Gemini falla
  return parseFloat((Math.random() * 2 + 7.5).toFixed(1));
}

// Sugerir 4 directores
async function suggestDirectorNames() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada: no se pueden sugerir directores.');
  }

  const prompt = `Selecciona 4 directores o directoras de cine contemporáneos o clásicos que destaquen por calidad, influencia o prestigio.
IMPORTANTE: 
- Al menos 1 de los 4 debe ser una propuesta innovadora (directores emergentes, vanguardistas, o con estilos cinematográficos experimentales).
- Al menos 1 de los 4 debe ser un director o directora latinoamericano/a (de México, Argentina, Chile, Colombia, Brasil, etc.).
Incluye cine de autor, cine mundial o propuestas innovadoras (evita repetir nombres recientes).
Responde únicamente con una lista separada por comas.`;

  const response = await callGemini(prompt);
  const names = parseListResponse(response);
  return names.slice(0, 6); // devolver hasta 6 para tener espacio si alguno falla
}

// Seleccionar películas para el ciclo
async function selectMoviesForCycle(directorName, candidateMovies) {
  const sanitizedCandidates = (candidateMovies || []).map((movie, index) => ({
    index: index + 1,
    title: movie.title || movie.name || `Película ${index + 1}`,
    overview: movie.overview || 'Sinopsis no disponible.',
    release_date: movie.release_date || movie.first_air_date || 's/f',
    popularity: movie.popularity || 0,
    poster: movie.poster || null,
    id: movie.id,
  }));

  if (sanitizedCandidates.length <= 6 || !GEMINI_API_KEY) {
    return sanitizedCandidates.slice(0, Math.max(4, Math.min(6, sanitizedCandidates.length)));
  }

  const listText = sanitizedCandidates
    .map(
      (movie) =>
        `${movie.index}. ${movie.title} (${movie.release_date}): ${movie.overview}`
    )
    .join('\n');

  const prompt = `A partir de la siguiente lista de películas vinculadas al director ${directorName}, selecciona de 4 a 6 títulos que formen un ciclo coherente que describa su estilo.
${listText}
Devuelve exclusivamente un JSON con esta forma: {"indices":[n1,n2,n3,...]} usando los números de lista en orden ascendente.`;

  const response = await callGemini(prompt);
  const indices = normalizeIndicesResponse(response, sanitizedCandidates.length);

  if (indices.length >= 4) {
    const selected = indices
      .slice(0, 6)
      .map((value) => sanitizedCandidates[value - 1])
      .filter(Boolean);
    if (selected.length >= 4) {
      return selected;
    }
  }

  return sanitizedCandidates.slice(0, 6);
}

// Seleccionar directores destacados dinámicamente usando Gemini
async function selectFeaturedDirectors(allDirectors, count = 3) {
  if (!GEMINI_API_KEY || allDirectors.length <= count) {
    // Fallback: selección aleatoria
    return allDirectors.sort(() => Math.random() - 0.5).slice(0, count);
  }

  const directorsList = allDirectors.map(d => d.name).join(', ');
  const prompt = `De la siguiente lista de directores de cine, selecciona los ${count} más relevantes y destacados actualmente: ${directorsList}.
Considera relevancia actual, influencia cinematográfica, y popularidad.
Responde SOLO con los nombres separados por comas, en el mismo orden que aparecen en la lista.`;

  const response = await callGemini(prompt);
  if (response) {
    const selectedNames = response.split(',').map(name => name.trim());
    const selected = allDirectors.filter(d => 
      selectedNames.some(name => d.name.includes(name) || name.includes(d.name))
    );
    
    if (selected.length >= count) {
      return selected.slice(0, count);
    }
  }

  // Fallback si Gemini falla
  return allDirectors.sort(() => Math.random() - 0.5).slice(0, count);
}

module.exports = {
  generateCycleName,
  generateDescription,
  generateRating,
  selectFeaturedDirectors,
  suggestDirectorNames,
  selectMoviesForCycle,
};

