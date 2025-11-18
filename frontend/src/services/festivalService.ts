import api from './api';
import { Festival } from '../types';

export const festivalService = {
  // Obtener todos los festivales
  getFestivals: async (): Promise<Festival[]> => {
    const response = await api.get('/festivals');
    return response.data;
  },

  // Crear nuevo festival
  createFestival: async (data: {
    playlistId: string;
    date: string;
  }): Promise<Festival> => {
    const response = await api.post('/festivals', data);
    return response.data;
  },

  // Obtener festival por ID
  getFestival: async (id: string): Promise<Festival> => {
    const response = await api.get(`/festivals/${id}`);
    return response.data;
  },

  // Unirse a un festival
  joinFestival: async (festivalId: string): Promise<Festival> => {
    const response = await api.post(`/festivals/${festivalId}/join`);
    return response.data;
  },

  // Actualizar estado del festival
  updateFestivalStatus: async (
    festivalId: string,
    status: 'scheduled' | 'active' | 'completed'
  ): Promise<Festival> => {
    const response = await api.patch(`/festivals/${festivalId}/status`, { status });
    return response.data;
  },
};

