import api from './api';
import { Movie } from '../types';

export const movieService = {
  // Buscar películas en TMDB (a través del backend)
  searchMovies: async (query: string): Promise<any[]> => {
    try {
      const response = await api.get(`/movies/search/tmdb?query=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching movies:', error);
      throw error;
    }
  },

  // Obtener detalles de una película de TMDB (a través del backend)
  getMovieDetails: async (tmdbId: number): Promise<any> => {
    try {
      const response = await api.get(`/movies/tmdb/${tmdbId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching movie details:', error);
      throw error;
    }
  },

  // Guardar película en nuestra base de datos
  saveMovie: async (movieData: Partial<Movie>): Promise<Movie> => {
    const response = await api.post('/movies', movieData);
    return response.data;
  },

  // Obtener películas guardadas
  getSavedMovies: async (): Promise<Movie[]> => {
    const response = await api.get('/movies');
    return response.data;
  },
};

