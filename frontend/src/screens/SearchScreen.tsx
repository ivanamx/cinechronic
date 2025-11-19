import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { movieService } from '../services/movieService';
import { playlistService } from '../services/playlistService';
import SelectPlaylistModal from '../components/SelectPlaylistModal';
import CreatePlaylistModal from './CreatePlaylistScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Mapeo de IDs de géneros de TMDB a nombres
const GENRE_MAP: { [key: number]: string } = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

const getGenreName = (genreId: number): string => {
  return GENRE_MAP[genreId] || '';
};

export default function SearchScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [directors, setDirectors] = useState<any[]>([]);
  const [directorMovies, setDirectorMovies] = useState<any[]>([]);
  const [matchedDirector, setMatchedDirector] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [directorNameForCreate, setDirectorNameForCreate] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setErrorMessage(null);
    setMatchedDirector(null);
    setDirectorMovies([]);
    setDirectors([]);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('🔍 Buscando:', query);
      
      // Búsqueda paralela de películas y directores
      const [moviesResults, directorsResults] = await Promise.all([
        movieService.searchMovies(query).catch(err => {
          console.error('Error searching movies:', err);
          return [];
        }),
        playlistService.searchDirectors(query).catch(err => {
          console.error('Error searching directors:', err);
          return [];
        })
      ]);

      console.log('✅ Películas encontradas:', moviesResults.length);
      console.log('✅ Directores encontrados:', directorsResults.length);

      setDirectors(directorsResults);
      setSearchResults(moviesResults);

      // Verificar si hay coincidencia exacta con algún director
      const queryLower = query.toLowerCase().trim();
      const exactMatch = directorsResults.find(
        (director: any) => director.name.toLowerCase().trim() === queryLower
      );

      if (exactMatch) {
        console.log('🎯 Coincidencia exacta con director:', exactMatch.name);
        setMatchedDirector(exactMatch);
        
        // Obtener películas del director
        try {
          const movies = await playlistService.getDirectorMovies(exactMatch.id);
          console.log('🎬 Películas del director:', movies.length);
          setDirectorMovies(movies);
        } catch (error) {
          console.error('Error fetching director movies:', error);
          setDirectorMovies([]);
        }
      } else {
        setMatchedDirector(null);
        setDirectorMovies([]);
      }

      if (moviesResults.length === 0 && directorsResults.length === 0 && !exactMatch) {
        setErrorMessage('No se encontraron resultados');
      }
    } catch (error: any) {
      console.error('❌ Search error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      if (error.response?.status === 500 && error.response?.data?.message?.includes('TMDB')) {
        setErrorMessage('Error de configuración: Falta la API key de TMDB en el backend');
      } else if (error.message === 'Network Error' || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
        setErrorMessage('No se puede conectar al servidor. Verifica que el backend esté corriendo en el puerto 3000.');
      } else if (error.response?.status === 400) {
        setErrorMessage(error.response.data?.message || 'Búsqueda inválida');
      } else {
        setErrorMessage(error.response?.data?.message || 'Error al buscar. Intenta de nuevo.');
      }
      setSearchResults([]);
      setDirectors([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMoviePress = (movie: any) => {
    (navigation as any).navigate('MovieDetail', { movie });
  };

  const handleCreateCycleFromDirector = (director: any) => {
    setDirectorNameForCreate(director.name);
    setShowCreatePlaylistModal(true);
  };

  const renderDirectorItem = (director: any) => (
    <View style={styles.directorCard}>
      <View style={styles.directorCardContent}>
        {director.profileUrl ? (
          <Image
            source={{ uri: director.profileUrl }}
            style={styles.directorPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.directorPhotoPlaceholder}>
            <Ionicons name="person-outline" size={40} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.directorInfo}>
          <Text style={styles.directorName}>{director.name}</Text>
          <Text style={styles.directorLabel}>Director</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.createCycleButton}
        onPress={() => handleCreateCycleFromDirector(director)}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle" size={20} color={colors.lime} />
        <Text style={styles.createCycleButtonText}>Crear Ciclo</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMovieItem = ({ item }: { item: any }) => (
    <View style={styles.movieCard}>
      <TouchableOpacity
        style={styles.movieCardContent}
        onPress={() => handleMoviePress(item)}
        activeOpacity={0.7}
      >
        {item.poster_path ? (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}${item.poster_path}` }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Ionicons name="film-outline" size={40} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.movieInfo}>
          <Text style={styles.movieTitle} numberOfLines={1}>
            {item.title ? (item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title) : 'Sin título'}
          </Text>
          <View style={styles.directorAndYearRow}>
            {item.director?.name && (
              <Text style={styles.movieDirector} numberOfLines={1}>
                {item.director.name}
                {item.release_date && (() => {
                  try {
                    const year = new Date(item.release_date).getFullYear();
                    if (!isNaN(year)) {
                      return ` • ${year}`;
                    }
                  } catch (error) {
                    console.error('Error parsing release date:', error);
                  }
                  return null;
                })()}
              </Text>
            )}
          </View>

          <View style={styles.movieMeta}>
            <View style={styles.ratingRow}>
              {item.vote_average != null && (
                <View style={styles.ratingItem}>
                  <Ionicons name="star" size={16} color={colors.accent} />
                  <Text style={styles.movieRating}>
                    {item.vote_average.toFixed(1)}/10
                  </Text>
                  <Text style={styles.ratingSource}>TMDB</Text>
                </View>
              )}

              {item.runtime && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{item.runtime} min</Text>
                </View>
              )}
            </View>

            {item.genre_ids && item.genre_ids.length > 0 && (
              <View style={styles.genresContainer}>
                {item.genre_ids.slice(0, 2).map((genreId: number, index: number) => {
                  const genreName = getGenreName(genreId);
                  return genreName ? (
                    <View key={index} style={styles.genreTag}>
                      <Text style={styles.genreText}>{genreName}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={(e) => {
          e.stopPropagation();
          setSelectedMovie(item);
          setShowPlaylistModal(true);
        }}
      >
        <Ionicons name="add-circle" size={24} color="#ADFF2F" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar película o director..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoCapitalize="none"
          />
        </View>

      {isSearching && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Buscando...</Text>
        </View>
      )}

      {errorMessage && !isSearching && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <FlatList
        data={[
          // Si hay director con coincidencia exacta, mostrarlo primero
          ...(matchedDirector ? [{ type: 'director', data: matchedDirector }] : []),
          // Películas del director si hay coincidencia exacta
          ...(matchedDirector && directorMovies.length > 0 
            ? directorMovies.map((movie: any) => ({ type: 'movie', data: movie }))
            : []),
          // Películas generales solo si NO hay coincidencia exacta con director
          ...(!matchedDirector 
            ? searchResults.map((movie: any) => ({ type: 'movie', data: movie }))
            : [])
        ]}
        renderItem={({ item }) => {
          if (item.type === 'director') {
            return renderDirectorItem(item.data);
          } else {
            return renderMovieItem({ item: item.data });
          }
        }}
        keyExtractor={(item, index) => 
          item.type === 'director' 
            ? `director-${item.data.id}` 
            : `movie-${item.data.id}-${index}`
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isSearching && searchQuery.length >= 2 && !errorMessage ? (
            <Text style={styles.emptyText}>No se encontraron resultados</Text>
          ) : null
        }
      />
      </View>

      <SelectPlaylistModal
        visible={showPlaylistModal}
        onClose={() => {
          setShowPlaylistModal(false);
          setSelectedMovie(null);
        }}
        movie={selectedMovie}
        onCreatePlaylist={() => {
          setShowPlaylistModal(false);
          setShowCreatePlaylistModal(true);
        }}
      />

      <CreatePlaylistModal
        visible={showCreatePlaylistModal}
        onClose={(created: boolean = false) => {
          setShowCreatePlaylistModal(false);
          setDirectorNameForCreate(null);
          // Si se creó desde búsqueda, simplemente regresar a la pantalla de búsqueda
          // No abrir el modal de selección automáticamente
          // El usuario puede presionar el botón de agregar de nuevo si quiere agregar la película
        }}
        initialDirectorName={directorNameForCreate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.backgroundDark,
  },
  searchInput: {
    ...typography.body,
    backgroundColor: colors.backgroundLight,
    color: colors.text,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  errorContainer: {
    backgroundColor: colors.error + '20',
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  movieCard: {
    position: 'relative',
    backgroundColor: colors.backgroundLight,
    marginBottom: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  movieCardContent: {
    flexDirection: 'row',
  },
  poster: {
    width: 100,
    height: 150,
    resizeMode: 'cover',
    backgroundColor: colors.backgroundLight,
  },
  posterPlaceholder: {
    width: 100,
    height: 150,
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movieInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  movieTitle: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  directorAndYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  movieDirector: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  movieRating: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  ratingSource: {
    ...typography.caption,
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },
  movieMeta: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  genreTag: {
    backgroundColor: colors.backgroundDark + '66', // BackgroundDark con transparencia (hex 66 = ~40%)
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary, // Primary
  },
  genreText: {
    ...typography.caption,
    color: colors.primary, // Primary
    fontSize: 11,
    fontWeight: '500',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.xl,
  },
  addButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ADFF2F40', // Verde limón con transparencia
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ADFF2F', // Verde limón
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  directorCard: {
    backgroundColor: colors.backgroundLight,
    marginBottom: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  directorCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  directorPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.md,
  },
  directorPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  directorInfo: {
    flex: 1,
  },
  directorName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  directorLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  createCycleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '20',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  createCycleButtonText: {
    ...typography.bodySmall,
    color: colors.lime,
    fontWeight: '600',
  },
});

