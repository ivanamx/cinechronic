import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

export const authService = {
  // Registro
  register: async (email: string, password: string, username: string): Promise<{ user: User; token: string }> => {
    const response = await api.post('/auth/register', { email, password, username });
    const { token, user } = response.data;
    await AsyncStorage.setItem('authToken', token);
    return { user, token };
  },

  // Login (acepta email o username)
  login: async (emailOrUsername: string, password: string): Promise<{ user: User; token: string }> => {
    const response = await api.post('/auth/login', { emailOrUsername, password });
    const { token, user } = response.data;
    await AsyncStorage.setItem('authToken', token);
    return { user, token };
  },

  // Logout
  logout: async (): Promise<void> => {
    await AsyncStorage.removeItem('authToken');
  },

  // Obtener usuario actual
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Verificar si está autenticado
  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  },

  // Actualizar perfil (username y/o password)
  updateProfile: async (data: { username?: string; password?: string }): Promise<User> => {
    const response = await api.put('/auth/update', data);
    return response.data.user;
  },
};

