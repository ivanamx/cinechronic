# 🎬 CineChronic

Aplicación móvil para crear y gestionar mini festivales de cine entre amigos. Busca películas, crea listas de reproducción, calendariza festivales de un día y califica películas para que las mejor calificadas sean programadas para discusión.

## 🏗️ Arquitectura

- **Frontend**: React Native con Expo
- **Backend**: Node.js + Express
- **Base de Datos**: PostgreSQL
- **API de Películas**: The Movie Database (TMDB)

## 📋 Requisitos Previos

- Node.js (v18 o superior)
- PostgreSQL (v14 o superior)
- npm o yarn
- Expo CLI (`npm install -g expo-cli`)
- Cuenta en TMDB para API key (gratuita): https://www.themoviedb.org/settings/api

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd cinechronic
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Crear archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=cinechronic
DB_USER=postgres
DB_PASSWORD=tu_password

JWT_SECRET=tu_secret_key_super_segura
JWT_EXPIRES_IN=7d

TMDB_API_KEY=tu_api_key_de_tmdb
```

### 3. Configurar Base de Datos

Crear la base de datos en PostgreSQL:

```bash
createdb cinechronic
```

O usando psql:

```sql
CREATE DATABASE cinechronic;
```

Ejecutar migraciones:

```bash
npm run migrate
```

### 4. Configurar Frontend

```bash
cd ../frontend
npm install
```

Configurar la URL de la API en `src/services/api.ts`:

```typescript
const API_BASE_URL = __DEV__ 
  ? 'http://TU_IP_LOCAL:3000/api'  // Cambiar por tu IP local
  : 'https://tu-api-produccion.com/api';
```

**Nota**: Para desarrollo, necesitas usar tu IP local (no localhost) para que el dispositivo móvil pueda conectarse. En Windows puedes obtenerla con `ipconfig`, en Mac/Linux con `ifconfig`.

### 5. Obtener API Key de TMDB

1. Ve a https://www.themoviedb.org/
2. Crea una cuenta (gratis)
3. Ve a Settings > API
4. Solicita una API Key
5. Copia la key y agrégala a tu `.env` del backend

## 🏃 Ejecutar la Aplicación

### Backend

```bash
cd backend
npm run dev
```

El servidor estará corriendo en `http://localhost:3000`

### Frontend

```bash
cd frontend
npm start
```

Esto abrirá Expo Dev Tools. Puedes:
- Escanear el QR con Expo Go en tu teléfono
- Presionar `a` para abrir en Android emulator
- Presionar `i` para abrir en iOS simulator

## 📱 Estructura del Proyecto

```
cinechronic/
├── frontend/              # Aplicación React Native
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── screens/       # Pantallas de la app
│   │   ├── navigation/    # Configuración de navegación
│   │   ├── services/      # Servicios API
│   │   ├── store/         # Estado global (Zustand)
│   │   ├── theme/         # Colores, tipografía, spacing
│   │   └── types/         # TypeScript types
│   ├── App.tsx
│   └── package.json
│
├── backend/               # API Node.js
│   ├── src/
│   │   ├── db/            # Conexión y esquema de BD
│   │   ├── middleware/    # Middleware (auth, etc)
│   │   ├── routes/        # Rutas de la API
│   │   └── server.js      # Servidor principal
│   └── package.json
│
└── README.md
```

## 🎨 Características

- ✅ Búsqueda de películas con TMDB
- ✅ Crear y gestionar listas de reproducción
- ✅ Calendarizar festivales de cine de 1 día
- ✅ Sistema de calificaciones (1-10)
- ✅ Ranking automático de películas mejor calificadas
- ✅ Participación en festivales entre usuarios
- ✅ Autenticación con JWT
- ✅ Diseño temático "CineChronic"

## 🔐 Endpoints de la API

### Autenticación
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual

### Películas
- `GET /api/movies` - Listar películas
- `POST /api/movies` - Crear película
- `GET /api/movies/:id` - Detalle de película
- `GET /api/movies/:id/ratings` - Calificaciones de película
- `GET /api/movies/top-rated` - Película mejor calificada

### Listas
- `GET /api/playlists` - Listar listas del usuario
- `POST /api/playlists` - Crear lista
- `GET /api/playlists/:id` - Detalle de lista
- `POST /api/playlists/:id/movies` - Agregar película
- `DELETE /api/playlists/:id/movies/:movieId` - Eliminar película

### Festivales
- `GET /api/festivals` - Listar festivales
- `POST /api/festivals` - Crear festival
- `GET /api/festivals/:id` - Detalle de festival
- `POST /api/festivals/:id/join` - Unirse a festival

### Calificaciones
- `GET /api/ratings` - Calificaciones del usuario
- `POST /api/ratings` - Calificar película
- `PUT /api/ratings/:id` - Actualizar calificación

## 🛠️ Scripts Disponibles

### Backend
- `npm start` - Iniciar servidor en producción
- `npm run dev` - Iniciar servidor en desarrollo (con nodemon)
- `npm run migrate` - Ejecutar migraciones de BD

### Frontend
- `npm start` - Iniciar Expo
- `npm run android` - Abrir en Android
- `npm run ios` - Abrir en iOS
- `npm run web` - Abrir en navegador

## 📝 Próximos Pasos

- [ ] Implementar sistema de notificaciones push
- [ ] Agregar chat/comentarios durante festivales
- [ ] Implementar drag & drop para reordenar películas
- [ ] Agregar modo offline
- [ ] Implementar búsqueda avanzada con filtros
- [ ] Agregar estadísticas de usuario
- [ ] Implementar compartir listas entre usuarios

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y está destinado para uso entre amigos.

---

**CineChronic** - Tu festival de cine personal 🎬✨

