import api from './api';
import { Playlist } from '../types';

export const playlistService = {
  // Obtener todos los ciclos del usuario
  getPlaylists: async (): Promise<Playlist[]> => {
    const response = await api.get('/playlists');
    return response.data;
  },

  // Crear nuevo ciclo
  createPlaylist: async (data: { name: string; date?: string }): Promise<Playlist> => {
    const response = await api.post('/playlists', data);
    return response.data;
  },

  // Obtener ciclo por ID
  getPlaylist: async (id: string): Promise<Playlist> => {
    const response = await api.get(`/playlists/${id}`);
    return response.data;
  },

  // Agregar película a ciclo
  addMovieToPlaylist: async (playlistId: string, movieId: string): Promise<Playlist> => {
    const response = await api.post(`/playlists/${playlistId}/movies`, { movieId });
    return response.data;
  },

  // Eliminar película de ciclo
  removeMovieFromPlaylist: async (playlistId: string, movieId: string): Promise<Playlist> => {
    const response = await api.delete(`/playlists/${playlistId}/movies/${movieId}`);
    return response.data;
  },

  // Eliminar ciclo
  deletePlaylist: async (id: string): Promise<void> => {
    await api.delete(`/playlists/${id}`);
  },

  // Obtener ciclos programados (público, para Home)
  getScheduledPlaylists: async (): Promise<Playlist[]> => {
    const response = await api.get('/playlists/scheduled');
    return response.data;
  },

  // Buscar directores para autocompletado
  searchDirectors: async (query: string): Promise<Array<{ id: number; name: string; profileUrl: string | null }>> => {
    const response = await api.get(`/playlists/search/directors?query=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Obtener películas de un director
  getDirectorMovies: async (directorId: number): Promise<any[]> => {
    const response = await api.get(`/playlists/director/${directorId}/movies`);
    return response.data;
  },
};

