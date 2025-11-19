import api from './api';

export interface RecommendationMovie {
  id: number;
  title: string;
  poster: string | null;
  release_date: string;
  overview: string;
  popularity: number;
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

export interface RecommendationsResponse {
  recommendations: DirectorRecommendation[];
  message?: string | null;
}

export const recommendationService = {
  // Obtener recomendaciones basadas en directores destacados
  getDirectorRecommendations: async (): Promise<DirectorRecommendation[]> => {
    const response = await api.get<RecommendationsResponse>('/recommendations/directors');
    // Si la respuesta tiene la estructura nueva con recommendations, usarla
    // Si es un array directamente (compatibilidad), usarlo
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return response.data.recommendations || [];
  },
};

