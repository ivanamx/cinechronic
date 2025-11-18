import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { playlistService } from '../services/playlistService';
import { recommendationService, DirectorRecommendation } from '../services/recommendationService';
import { movieService } from '../services/movieService';
import PlaylistDetailModal from '../components/PlaylistDetailModal';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - (spacing.lg * 2);

// Función para convertir nombre de país a código ISO
const getCountryCode = (countryName: string | null | undefined): string | null => {
  if (!countryName) return null;
  
  const countryMap: { [key: string]: string } = {
    'México': 'MX',
    'Mexico': 'MX',
    'United States': 'US',
    'United States of America': 'US',
    'USA': 'US',
    'France': 'FR',
    'Spain': 'ES',
    'España': 'ES',
    'Argentina': 'AR',
    'Brazil': 'BR',
    'Brasil': 'BR',
    'Italy': 'IT',
    'Italia': 'IT',
    'Germany': 'DE',
    'Deutschland': 'DE',
    'United Kingdom': 'GB',
    'UK': 'GB',
    'Canada': 'CA',
    'Japan': 'JP',
    'China': 'CN',
    'South Korea': 'KR',
    'Korea': 'KR',
    'India': 'IN',
    'Australia': 'AU',
    'Russia': 'RU',
    'Poland': 'PL',
    'Polonia': 'PL',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Switzerland': 'CH',
    'Austria': 'AT',
    'Portugal': 'PT',
    'Greece': 'GR',
    'Turkey': 'TR',
    'Israel': 'IL',
    'Iran': 'IR',
    'Egypt': 'EG',
    'South Africa': 'ZA',
    'Chile': 'CL',
    'Colombia': 'CO',
    'Peru': 'PE',
    'Perú': 'PE',
    'Venezuela': 'VE',
    'Uruguay': 'UY',
    'Paraguay': 'PY',
    'Ecuador': 'EC',
    'Bolivia': 'BO',
    'Cuba': 'CU',
    'Dominican Republic': 'DO',
    'Puerto Rico': 'PR',
  };
  
  // Buscar coincidencia exacta (case insensitive)
  const normalized = countryName.trim();
  const match = countryMap[normalized] || countryMap[Object.keys(countryMap).find(key => 
    key.toLowerCase() === normalized.toLowerCase()
  ) || ''];
  
  if (match) return match;
  
  // Si no hay coincidencia, intentar usar las primeras 2 letras en mayúsculas
  // Solo si el nombre tiene más de 2 caracteres
  if (normalized.length > 2) {
    return normalized.substring(0, 2).toUpperCase();
  }
  
  return normalized.toUpperCase();
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const carouselRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterType, setFilterType] = useState<'proximos' | 'pasados'>('proximos');

  const { data: scheduledPlaylists, isLoading: playlistsLoading } = useQuery({
    queryKey: ['scheduledPlaylists'],
    queryFn: () => playlistService.getScheduledPlaylists(),
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: ['directorRecommendations'],
    queryFn: () => recommendationService.getDirectorRecommendations(),
  });

  const validRecommendations = useMemo(() => {
    if (!recommendations) return [];
    return recommendations
      .map((rec) => ({
        ...rec,
        movies: (rec.movies || []).slice(0, 6),
      }))
      .filter((rec) => rec.movies.length >= 4);
  }, [recommendations]);

  const createPlaylistMutation = useMutation({
    mutationFn: async (recommendation: DirectorRecommendation) => {
      // Crear el ciclo sin fecha
      const playlist = await playlistService.createPlaylist({
        name: recommendation.cycleName,
        date: undefined,
      });

      // Agregar las 5 películas al ciclo
      for (const movie of recommendation.movies) {
        try {
          // Guardar la película en la base de datos
          const savedMovie = await movieService.saveMovie({
            tmdbId: movie.id,
            title: movie.title,
            poster: movie.poster || undefined,
            synopsis: movie.overview,
            year: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
          });

          // Agregar al ciclo
          await playlistService.addMovieToPlaylist(playlist.id, savedMovie.id);
        } catch (error) {
          console.error('Error adding movie to playlist:', error);
        }
      }

      return playlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledPlaylists'] });
    },
  });

  // Auto-scroll del carrusel cada 5 segundos
  useEffect(() => {
    if (!validRecommendations || validRecommendations.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % validRecommendations.length;
        carouselRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        return nextIndex;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [validRecommendations]);

  const handleAddRecommendation = useCallback((recommendation: DirectorRecommendation) => {
    createPlaylistMutation.mutate(recommendation);
  }, [createPlaylistMutation]);

  const renderRecommendationCard = useCallback(({ item }: { item: DirectorRecommendation }) => {
    const moviesToDisplay = (item.movies || []).slice(0, 6);
    const directorLabel = item.directorCountry
      ? `${item.director} • ${item.directorCountry}`
      : item.director;

    if (moviesToDisplay.length < 4) {
      return null;
    }

    return (
      <View style={[styles.recommendationCard, { width: CARD_WIDTH }]}>
      {/* Header con nombre del ciclo, total de películas y rating */}
      <View style={styles.recommendationHeader}>
        <View style={styles.recommendationTitleContainer}>
          <Text style={styles.recommendationCycleName}>{item.cycleName}</Text>
          <Text style={styles.recommendationMovieCount}>({item.movies.length} películas)</Text>
          <View style={styles.recommendationRatingBadge}>
            <Ionicons name="star" size={12} color={colors.accent} />
            <Text style={styles.recommendationRatingText}>{item.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      {/* Director con botón Agregar */}
      <View style={styles.recommendationDirectorRow}>
        <Text style={styles.recommendationDirector}>{directorLabel}</Text>
        <TouchableOpacity
          style={styles.addRecommendationBadge}
          onPress={() => handleAddRecommendation(item)}
          disabled={createPlaylistMutation.isPending}
        >
          <Ionicons name="add" size={14} color={colors.background} />
          <Text style={styles.addRecommendationBadgeText}>
            {createPlaylistMutation.isPending ? '...' : 'Agregar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Descripción */}
      <Text style={styles.recommendationDescription} numberOfLines={2}>
        {item.description}
      </Text>

      {/* Portadas de películas - Scroll horizontal con 4 visibles */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recommendationPostersContainer}
      >
        {moviesToDisplay.map((movie, index) => (
          <View key={movie.id || index} style={styles.recommendationPosterItem}>
            {movie.poster ? (
              <Image
                source={{ uri: movie.poster }}
                style={styles.recommendationPoster}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.recommendationPoster, styles.posterPlaceholder]}>
                <Ionicons name="film-outline" size={20} color={colors.textMuted} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
    );
  }, [handleAddRecommendation, createPlaylistMutation.isPending]);


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Image 
            source={require('../../assets/cchroniclogo2.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Sección superior: Ciclos */}
        <View style={styles.topSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ciclos</Text>
            <View style={styles.filterBadges}>
              <TouchableOpacity
                style={[
                  styles.filterBadge,
                  filterType === 'proximos' && styles.filterBadgeActive,
                ]}
                onPress={() => setFilterType('proximos')}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    filterType === 'proximos' && styles.filterBadgeTextActive,
                  ]}
                >
                  Próximos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterBadge,
                  filterType === 'pasados' && styles.filterBadgeActive,
                ]}
                onPress={() => setFilterType('pasados')}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    filterType === 'pasados' && styles.filterBadgeTextActive,
                  ]}
                >
                  Pasados
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView 
            style={styles.scrollSection}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {playlistsLoading ? (
              <Text style={styles.loadingText}>Cargando...</Text>
            ) : (() => {
              // Filtrar playlists según el filtro seleccionado
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const filteredPlaylists = (scheduledPlaylists || []).filter((playlist) => {
                const dateValue = (playlist as any).scheduled_date || (playlist as any).scheduledDate || playlist.scheduled_date;
                if (!dateValue) return false;
                
                try {
                  const playlistDate = typeof dateValue === 'string' 
                    ? new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00')
                    : new Date(dateValue);
                  playlistDate.setHours(0, 0, 0, 0);
                  
                  if (filterType === 'proximos') {
                    return playlistDate >= today;
                  } else {
                    return playlistDate < today;
                  }
                } catch (error) {
                  console.error('Error filtering playlist date:', error);
                  return false;
                }
              });
              
              return filteredPlaylists.length > 0 ? (
                filteredPlaylists.map((playlist) => {
                // Obtener la fecha formateada en DD/MM/YY
                const dateValue = (playlist as any).scheduled_date || (playlist as any).scheduledDate || playlist.scheduled_date;
                let formattedDate = null;
                if (dateValue) {
                  try {
                    const date = typeof dateValue === 'string' 
                      ? new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00')
                      : new Date(dateValue);
                    if (!isNaN(date.getTime())) {
                      formattedDate = format(date, 'dd/MM/yy');
                    }
                  } catch (error) {
                    console.error('Error formatting date:', error, dateValue);
                  }
                }

                const director = (playlist as any).director;
                const createdByUser = (playlist as any).created_by_user;
                const countryCode = getCountryCode(director?.country);

                return (
                  <TouchableOpacity
                    key={playlist.id}
                    style={styles.cycleCard}
                    onPress={() => {
                      setSelectedPlaylistId(playlist.id);
                      setShowDetailModal(true);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Fila con nombre, fecha y número de películas */}
                    <View style={styles.cycleInfoRow}>
                      {director?.profileUrl ? (
                        <Image
                          source={{ uri: director.profileUrl }}
                          style={styles.directorPhoto}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.directorPhoto, styles.directorPhotoPlaceholder]}>
                          <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.cycleNameContainer}>
                        <Text style={styles.cycleName}>{playlist.name}</Text>
                        {countryCode && (
                          <Text style={styles.cycleCountryCode}>{countryCode}</Text>
                        )}
                      </View>
                      {formattedDate && (
                        <Text style={styles.cycleDate}>{formattedDate}</Text>
                      )}
                      <View style={styles.moviesAndUserRow}>
                        <Text style={styles.cycleMoviesCount}>
                          {playlist.movies?.length || 0} películas
                        </Text>
                        {createdByUser?.username && (
                          <View style={styles.userBadge}>
                            <Ionicons name="person-circle-outline" size={12} color={colors.textSecondary} />
                            <Text style={styles.userBadgeText}>{createdByUser.username}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
                })
              ) : (
                <Text style={styles.emptyText}>
                  {filterType === 'proximos' 
                    ? 'No hay ciclos próximos' 
                    : 'No hay ciclos pasados'}
                </Text>
              );
            })()}
          </ScrollView>
        </View>

        <PlaylistDetailModal
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPlaylistId(null);
          }}
          playlistId={selectedPlaylistId}
        />

        {/* Divisor */}
        <View style={styles.divider} />

        {/* Sección inferior: Recomendaciones */}
        <View style={styles.bottomSection}>
          <View style={styles.recommendationsTitleContainer}>
            <Text style={styles.sectionTitle}>Recomendaciones</Text>
          </View>
          {recommendationsLoading ? (
            <View style={styles.recommendationsContent}>
              <Text style={styles.loadingText}>Cargando recomendaciones...</Text>
            </View>
          ) : validRecommendations.length > 0 ? (
            <View style={styles.carouselWrapper}>
              <FlatList
                ref={carouselRef}
                data={validRecommendations}
                renderItem={renderRecommendationCard}
                keyExtractor={(item, index) => `recommendation-${item.directorId}-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + spacing.md}
                decelerationRate="fast"
                contentContainerStyle={styles.recommendationsCarousel}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + spacing.md));
                  setCurrentIndex(index);
                }}
                onScrollToIndexFailed={(info) => {
                  // Si falla el scroll, intentar de nuevo después de un delay
                  setTimeout(() => {
                    carouselRef.current?.scrollToIndex({ index: info.index, animated: true });
                  }, 100);
                }}
                getItemLayout={(data, index) => ({
                  length: CARD_WIDTH + spacing.md,
                  offset: (CARD_WIDTH + spacing.md) * index,
                  index,
                })}
              />
            </View>
          ) : (
            <View style={styles.recommendationsContent}>
              <Text style={styles.emptyText}>No hay recomendaciones disponibles</Text>
            </View>
          )}
        </View>
      </View>
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
  header: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '80%',
    height: 60,
    maxWidth: 300,
  },
  topSection: {
    flex: 0.4,
    paddingTop: spacing.md,
  },
  bottomSection: {
    flex: 0.6,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  scrollSection: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
  },
  filterBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBadgeActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  filterBadgeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
    fontSize: 12,
  },
  filterBadgeTextActive: {
    color: colors.background,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  recommendationsTitleContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  recommendationsContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  carouselWrapper: {
    flex: 1,
    minHeight: 280,
    marginTop: spacing.lg,
    // Asegurar que funcione en pantallas pequeñas
    maxHeight: '100%',
  },
  recommendationsCarousel: {
    paddingHorizontal: spacing.lg,
  },
  recommendationCard: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    marginRight: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  recommendationHeader: {
    marginBottom: spacing.sm,
  },
  recommendationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  recommendationCycleName: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  recommendationMovieCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  recommendationRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    marginLeft: 'auto',
  },
  recommendationRatingText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 10,
  },
  recommendationDirectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recommendationDirector: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
    flex: 1,
  },
  recommendationDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  recommendationPostersContainer: {
    paddingVertical: spacing.xs,
    paddingBottom: spacing.xs / 2,
    marginBottom: spacing.xs,
  },
  recommendationPosterItem: {
    marginRight: spacing.sm,
    width: (CARD_WIDTH - spacing.md * 2 - spacing.sm * 3) / 4, // 4 portadas visibles
  },
  recommendationPoster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addRecommendationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: 4,
  },
  addRecommendationBadgeText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: '600',
    fontSize: 11,
  },
  cycleCard: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  cycleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    width: '100%',
  },
  directorPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.lime,
  },
  directorPhotoPlaceholder: {
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.border,
  },
  cycleNameContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    flex: 1,
    minWidth: 120,
  },
  cycleName: {
    ...typography.h4,
    color: colors.text,
    fontWeight: '600',
  },
  cycleCountryCode: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
    fontSize: 12,
  },
  cycleDate: {
    ...typography.bodySmall,
    color: colors.lime,
    fontWeight: '500',
  },
  moviesAndUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flex: 1,
    minWidth: 150,
  },
  cycleMoviesCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 12,
    gap: spacing.xs / 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 10,
  },
  posterPlaceholder: {
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.md,
  },
});

