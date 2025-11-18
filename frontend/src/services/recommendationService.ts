import api from './api';

export interface RecommendationMovie {
  id: number;
  title: string;
  poster: string | null;
  release_date: string;
  overview: string;
}

export interface DirectorRecommendation {
  director: string;
  directorId: number;
  directorCountry?: string | null;
  placeOfBirth?: string | null;
  cycleName: string;
  description: string;
  rating: number;
  movies: RecommendationMovie[];
}

export const recommendationService = {
  // Obtener recomendaciones basadas en directores destacados
  getDirectorRecommendations: async (): Promise<DirectorRecommendation[]> => {
    const response = await api.get('/recommendations/directors');
    return response.data;
  },
};

