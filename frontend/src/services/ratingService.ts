import api from './api';
import { Rating } from '../types';

export const ratingService = {
  // Calificar una película
  rateMovie: async (movieId: string, rating: number): Promise<Rating> => {
    const response = await api.post('/ratings', { movieId, rating });
    return response.data;
  },

  // Obtener calificaciones de una película
  getMovieRatings: async (movieId: string): Promise<Rating[]> => {
    const response = await api.get(`/movies/${movieId}/ratings`);
    return response.data;
  },

  // Obtener calificaciones del usuario
  getUserRatings: async (): Promise<Rating[]> => {
    const response = await api.get('/ratings');
    return response.data;
  },

  // Obtener película mejor calificada del grupo
  getTopRatedMovie: async (): Promise<any | null> => {
    try {
      const response = await api.get('/movies/top-rated');
      return response.data;
    } catch (error: any) {
      // Si es un 404, significa que no hay películas calificadas aún (es normal)
      if (error.response?.status === 404) {
        return null;
      }
      // Para otros errores, lanzar el error
      throw error;
    }
  },
};

