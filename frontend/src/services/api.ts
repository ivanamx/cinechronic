import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ============================================
// CONFIGURACIÓN DE URLS DEL API
// ============================================
// Cambia USE_PRODUCTION a true para forzar producción incluso en desarrollo
const USE_PRODUCTION = false;

// URL de desarrollo (túnel o local)
const DEV_URL = 'https://hot-paths-invite.loca.lt/api'; // Cambia esto por tu túnel de desarrollo

// URL de producción (tu VPS/dominio)
const PROD_URL = Constants.expoConfig?.extra?.apiUrl || 
                 process.env.EXPO_PUBLIC_API_URL || 
                 'https://api.golfclubsforbeginners.com/api';

// ============================================
// Detectar la URL base del API según la plataforma
// ============================================
const getApiBaseUrl = () => {
  // Si está en producción (build de EAS) o USE_PRODUCTION está en true
  if (!__DEV__ || USE_PRODUCTION) {
    console.log('🌐 Producción - API URL:', PROD_URL);
    return PROD_URL;
  }

  // En desarrollo:
  
  // En web, siempre usar localhost
  if (Platform.OS === 'web') {
    return 'http://localhost:3000/api';
  }

  // Verificar si hay una URL de ngrok/túnel configurada (PRIORIDAD ALTA)
  const ngrokUrl = Constants.expoConfig?.extra?.ngrokUrl || process.env.EXPO_PUBLIC_NGROK_URL;
  if (ngrokUrl) {
    console.log('🌐 Usando túnel URL:', ngrokUrl);
    return `${ngrokUrl}/api`;
  }

  // Si hay una URL de desarrollo configurada, usarla
  if (DEV_URL && DEV_URL !== 'https://hot-paths-invite.loca.lt/api') {
    console.log('🌐 Usando URL de desarrollo:', DEV_URL);
    return DEV_URL;
  }
  
  // Para iOS/Android: Usar la MISMA IP que Expo está usando
  let serverUrl = '192.168.0.10'; // Fallback
  
  // Obtener la IP del servidor Expo
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
  
  if (hostUri) {
    // Extraer la IP del hostUri (ej: "192.168.0.10:8081" -> "192.168.0.10")
    const match = hostUri.match(/^([^:]+)/);
    if (match) {
      const detected = match[1];
      
      // Si es un túnel, NO puede alcanzar IP local - mostrar error claro
      if (detected.includes('exp.direct') || detected.includes('tunnel')) {
        console.error('❌ NO PUEDES USAR --tunnel con backend en IP local');
        console.error('✅ USA: npx expo start --lan --clear');
        // Intentar de todas formas (probablemente fallará)
        serverUrl = '192.168.0.10';
      } else if (detected !== 'localhost' && detected !== '127.0.0.1') {
        // Usar la IP que Expo detectó
        serverUrl = detected;
      }
    }
  }
  
  const apiUrl = `http://${serverUrl}:3000/api`;
  console.log(`🔗 Conectando a: ${apiUrl}`);
  return apiUrl;
};

const API_BASE_URL = getApiBaseUrl();

// Log para debugging - esto te ayudará a ver qué URL se está usando
if (__DEV__) {
  console.log('🌐 API Base URL:', API_BASE_URL);
  console.log('📱 Platform:', Platform.OS);
  console.log('🔧 Dev Mode:', __DEV__);
  console.log('📡 Expo hostUri:', Constants.expoConfig?.hostUri || Constants.manifest?.hostUri);
  console.log('💡 Tip: Si la búsqueda no funciona, verifica que:');
  console.log('   1. El backend esté corriendo en el puerto 3000');
  console.log('   2. La IP detectada sea correcta (revisa los logs arriba)');
  console.log('   3. Tu iPhone y PC estén en la misma red WiFi');
  console.log('   4. Si usa localhost, reinicia Expo con: npx expo start --tunnel');
}

// Configurar axios para React Native/Expo Go
// En React Native, axios usa XMLHttpRequest por defecto, que puede tener problemas con IPs locales
// Intentamos usar el adaptador HTTP nativo
let axiosConfig: any = {
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true',
  },
  timeout: 30000, // Aumentar timeout a 30 segundos para búsquedas complejas
};

// En iOS/Android, intentar usar el adaptador HTTP nativo si está disponible
if (Platform.OS !== 'web') {
  try {
    // React Native usa XMLHttpRequest por defecto, que debería funcionar
    // Pero a veces necesita configuración adicional
    axiosConfig.validateStatus = (status: number) => status >= 200 && status < 300;
  } catch (e) {
    // Si falla, usar configuración por defecto
  }
}

const api = axios.create(axiosConfig);

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Log detallado del error para debugging
    if (__DEV__) {
      console.error('❌ API Error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });
    }

    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Request timeout - El servidor tardó demasiado en responder');
    } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      console.error('🌐 Network Error - Verifica que:');
      console.error('   1. El backend esté corriendo (puerto 3000)');
      console.error('   2. La URL del API sea correcta:', API_BASE_URL);
      console.error('   3. No haya problemas de firewall o CORS');
      if (Platform.OS !== 'web') {
        console.error('   4. Tu dispositivo esté en la misma red WiFi que el servidor');
      }
    } else if (error.response) {
      // El servidor respondió con un código de error
      console.error(`📡 Server Error ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      // La petición se hizo pero no hubo respuesta
      console.error('📭 No response from server:', error.request);
    }
    
    if (error.response?.status === 401) {
      // Token expirado o inválido
      try {
        await AsyncStorage.removeItem('authToken');
      } catch (storageError) {
        // AsyncStorage puede fallar en web en algunos casos
        if (__DEV__) {
          console.warn('⚠️ No se pudo limpiar el token:', storageError);
        }
      }
      // Redirigir a login
    }
    return Promise.reject(error);
  }
);

export default api;

