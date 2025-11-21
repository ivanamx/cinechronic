import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { playlistService } from '../services/playlistService';
import { movieService } from '../services/movieService';
import { ratingService } from '../services/ratingService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - (spacing.lg * 4);

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

// Componente para cada poster de película con conteo de vistas
function MoviePosterItem({ movie, onPress }: { movie: any; onPress: () => void }) {
  const { data: viewCount, isLoading: viewCountLoading } = useQuery({
    queryKey: ['movieViewCount', movie.id],
    queryFn: () => movieService.getMovieViewCount(movie.id),
    enabled: !!movie.id,
  });

  const { data: ratings, isLoading: ratingsLoading } = useQuery({
    queryKey: ['movieRatings', movie.id],
    queryFn: () => ratingService.getMovieRatings(movie.id),
    enabled: !!movie.id,
  });

  const hasMultipleRatings = (ratings?.length || 0) > 1;

  return (
    <View style={styles.posterItemContainer}>
      <TouchableOpacity
        style={styles.posterItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {movie.poster ? (
          <Image
            source={{ uri: movie.poster }}
            style={styles.carouselPoster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.carouselPoster, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={32} color={colors.textMuted} />
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.viewCountContainer}>
        <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.viewCountText}>
          {viewCountLoading ? (
            '...'
          ) : viewCount ? (
            `${viewCount.viewCount}/${viewCount.totalUsers}`
          ) : (
            '0/0'
          )}
        </Text>
      </View>
      {/* Calificaciones de usuarios */}
      {ratingsLoading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} style={styles.ratingsLoading} />
      ) : ratings && ratings.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={hasMultipleRatings}
          style={styles.ratingsScrollView}
          contentContainerStyle={[
            styles.ratingsContentContainer,
            !hasMultipleRatings && styles.ratingsContentContainerNoScroll,
          ]}
        >
          {ratings.map((rating: any) => (
            <View key={rating.id} style={styles.ratingItem}>
              <Text style={styles.ratingUsername} numberOfLines={1}>
                {rating.username || 'Usuario'}
              </Text>
              <View style={styles.ratingValueContainer}>
                <Ionicons name="star" size={10} color={colors.accent} />
                <Text style={styles.ratingValue}>{rating.rating}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

// Componente para el contenido del modal de sinopsis con watch providers
function MovieSynopsisContent({ movie }: { movie: any }) {
  const { data: watchProviders, isLoading: providersLoading } = useQuery({
    queryKey: ['watchProviders', movie.tmdbId],
    queryFn: () => movieService.getWatchProviders(movie.tmdbId),
    enabled: !!movie.tmdbId,
  });

  const { data: viewCount } = useQuery({
    queryKey: ['movieViewCount', movie.id],
    queryFn: () => movieService.getMovieViewCount(movie.id),
    enabled: !!movie.id,
  });

  const { data: ratings, isLoading: ratingsLoading } = useQuery({
    queryKey: ['movieRatings', movie.id],
    queryFn: () => ratingService.getMovieRatings(movie.id),
    enabled: !!movie.id,
  });

  // Combinar todos los proveedores (flatrate tiene prioridad)
  const allProviders = [
    ...(watchProviders?.flatrate || []),
    ...(watchProviders?.rent || []),
    ...(watchProviders?.buy || []),
  ];

  // Eliminar duplicados por provider_id
  const uniqueProviders = allProviders.filter((provider, index, self) =>
    index === self.findIndex((p) => p.provider_id === provider.provider_id)
  );

  // Ordenar por display_priority
  const sortedProviders = uniqueProviders.sort((a, b) => 
    (a.display_priority || 0) - (b.display_priority || 0)
  );

  const formatDate = (dateValue: any) => {
    if (!dateValue) return null;
    try {
      const date = typeof dateValue === 'string' 
        ? new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00')
        : new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return format(date, 'dd/MM/yy');
      }
    } catch (error) {
      console.error('Error formatting date:', error);
    }
    return null;
  };

  const cards = [
    {
      id: 'synopsis',
      title: 'Sinopsis',
      content: (
        <View style={styles.cardContent}>
          <View style={styles.movieModalInfo}>
            <Text style={styles.movieModalMovieTitle}>{movie.title}</Text>
            <View style={styles.movieModalYearRow}>
              {movie.year && (
                <Text style={styles.movieModalYear}>{movie.year}</Text>
              )}
              <View style={styles.watchProvidersContainer}>
                <Text style={styles.watchProvidersLabel}>Donde ver:</Text>
                {providersLoading ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : sortedProviders.length > 0 ? (
                  <View style={styles.providersLogosContainer}>
                    {sortedProviders
                      .filter(provider => provider.logo_path)
                      .slice(0, 6)
                      .map((provider) => (
                        <Image
                          key={provider.provider_id}
                          source={{ 
                            uri: `https://image.tmdb.org/t/p/w45${provider.logo_path}`
                          }}
                          style={styles.providerLogo}
                          resizeMode="contain"
                        />
                      ))}
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {movie.synopsis ? (
            <View style={styles.movieModalSynopsisContainer}>
              <Text style={styles.movieModalSynopsis}>{movie.synopsis}</Text>
            </View>
          ) : (
            <View style={styles.movieModalSynopsisContainer}>
              <Text style={styles.movieModalNoSynopsis}>
                No hay sinopsis disponible para esta película.
              </Text>
            </View>
          )}
        </View>
      ),
    },
    {
      id: 'ratings',
      title: 'Calificaciones',
      content: (
        <View style={styles.cardContent}>
          <View style={styles.ratingsHeader}>
            <View style={styles.ratingsViewCountContainer}>
              <Text style={styles.ratingsHeaderText}>Visto por</Text>
              <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.ratingsViewCountText}>
                {viewCount ? `${viewCount.viewCount}/${viewCount.totalUsers}` : '0/0'}
              </Text>
            </View>
          </View>

          {ratingsLoading ? (
            <View style={styles.ratingsLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : ratings && ratings.length > 0 ? (
            <ScrollView style={styles.ratingsList} showsVerticalScrollIndicator={false}>
              {ratings.map((rating: any) => (
                <View key={rating.id} style={styles.ratingListItem}>
                  <View style={styles.ratingListItemHeader}>
                    <Text style={styles.ratingListItemUsername}>
                      {rating.username || 'Usuario'}
                    </Text>
                    <View style={styles.ratingListItemValue}>
                      <Ionicons name="star" size={14} color={colors.accent} />
                      <Text style={styles.ratingListItemRating}>{rating.rating}</Text>
                    </View>
                  </View>
                  {rating.created_at && (
                    <Text style={styles.ratingListItemDate}>
                      {formatDate(rating.created_at)}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noRatingsContainer}>
              <Text style={styles.noRatingsText}>
                Aún no hay calificaciones para esta película.
              </Text>
            </View>
          )}
        </View>
      ),
    },
  ];

  return (
    <View style={styles.movieModalBody}>
      <FlatList
        data={cards}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.cardContainer, { width: CARD_WIDTH }]}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.content}
          </View>
        )}
        getItemLayout={(data, index) => ({
          length: CARD_WIDTH,
          offset: CARD_WIDTH * index,
          index,
        })}
      />
    </View>
  );
}

interface PlaylistDetailModalProps {
  visible: boolean;
  onClose: () => void;
  playlistId: string | null;
}

export default function PlaylistDetailModal({ visible, onClose, playlistId }: PlaylistDetailModalProps) {
  const [selectedMovie, setSelectedMovie] = React.useState<any | null>(null);
  const [showMovieModal, setShowMovieModal] = React.useState(false);

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => playlistService.getPlaylist(playlistId!),
    enabled: visible && !!playlistId,
  });


  // Calcular tiempo total
  const totalDuration = playlist?.movies?.reduce((total: number, movie: any) => {
    return total + (movie.duration || 0);
  }, 0) || 0;

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Detalles del Ciclo</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : playlist ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Primera fila: Foto del director y nombre del ciclo */}
              <View style={styles.firstRow}>
                {(playlist as any).director?.profileUrl ? (
                  <Image
                    source={{ uri: (playlist as any).director.profileUrl }}
                    style={styles.directorPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.directorPhoto, styles.directorPhotoPlaceholder]}>
                    <Ionicons name="person-outline" size={24} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.nameAndDateContainer}>
                  <View style={styles.nameAndCountryRow}>
                    <View style={styles.cycleNameContainer}>
                      <Text style={styles.cycleName}>{playlist.name}</Text>
                      {getCountryCode((playlist as any).director?.country) && (
                        <Text style={styles.directorCountryCode}>
                          {getCountryCode((playlist as any).director?.country)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.dateAndMoviesRow}>
                    <View style={styles.moviesInfo}>
                      <Ionicons name="film-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.moviesCountText}>
                        {playlist.movies?.length || 0} películas
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Segunda fila: Carrusel de posters */}
              {playlist.movies && playlist.movies.length > 0 && (
                <View style={styles.moviesSection}>
                  <FlatList
                    data={playlist.movies}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, index) => item.id?.toString() || index.toString()}
                    contentContainerStyle={styles.carouselContainer}
                    renderItem={({ item, index }) => (
                      <MoviePosterItem
                        movie={item}
                        onPress={() => {
                          setSelectedMovie(item);
                          setShowMovieModal(true);
                        }}
                      />
                    )}
                  />
                </View>
              )}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se pudo cargar el ciclo</Text>
            </View>
          )}
        </View>
      </View>

      {/* Modal de sinopsis de película */}
      <Modal
        visible={showMovieModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowMovieModal(false);
          setSelectedMovie(null);
        }}
      >
        <View style={styles.movieModalOverlay}>
          <View style={styles.movieModalContent}>
            <View style={styles.movieModalHeader}>
              <Text style={styles.movieModalTitle}>Sinopsis</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowMovieModal(false);
                  setSelectedMovie(null);
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedMovie && (
              <MovieSynopsisContent 
                movie={selectedMovie}
              />
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    minWidth: 280, // Mínimo para pantallas pequeñas
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  firstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  directorPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.lime,
  },
  directorPhotoPlaceholder: {
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.border,
  },
  nameAndDateContainer: {
    flex: 1,
  },
  nameAndCountryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cycleNameContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  cycleName: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
  },
  directorCountryCode: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
    fontSize: 12,
  },
  dateAndMoviesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  secondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moviesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  moviesCountText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  moviesSection: {
    marginTop: spacing.md,
  },
  carouselContainer: {
    paddingVertical: spacing.sm,
  },
  posterItemContainer: {
    marginRight: spacing.md,
    alignItems: 'center',
  },
  posterItem: {
    marginBottom: spacing.xs,
  },
  carouselPoster: {
    width: 100,
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    // Responsive: ajustar para pantallas pequeñas
    minWidth: 70,
    minHeight: 105,
  },
  posterPlaceholder: {
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    marginTop: spacing.xs / 2,
  },
  viewCountText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  ratingsScrollView: {
    marginTop: spacing.xs / 2,
    maxHeight: 50,
  },
  ratingsContentContainer: {
    paddingHorizontal: spacing.xs / 2,
    gap: spacing.xs,
  },
  ratingsContentContainerNoScroll: {
    justifyContent: 'center',
  },
  ratingsLoading: {
    marginTop: spacing.xs / 2,
  },
  ratingItem: {
    backgroundColor: colors.backgroundLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 60,
    maxWidth: 80,
  },
  ratingUsername: {
    ...typography.caption,
    color: colors.text,
    fontSize: 9,
    fontWeight: '500',
    marginBottom: spacing.xs / 2,
  },
  ratingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  ratingValue: {
    ...typography.caption,
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  movieModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  movieModalContent: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    minHeight: 400,
  },
  movieModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  movieModalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  movieModalBody: {
    flex: 1,
  },
  cardContainer: {
    padding: spacing.lg,
    height: '100%',
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  movieModalInfo: {
    marginBottom: spacing.md,
  },
  movieModalMovieTitle: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  movieModalYearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  movieModalYear: {
    ...typography.body,
    color: colors.textSecondary,
  },
  watchProvidersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  watchProvidersLabel: {
    ...typography.bodySmall,
    color: colors.lime,
    fontSize: 12,
  },
  providersLogosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  providerLogo: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: colors.backgroundLight,
  },
  ratingsHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ratingsViewCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingsHeaderText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  ratingsViewCountText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  ratingsList: {
    flex: 1,
  },
  ratingsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  ratingListItem: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingListItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ratingListItemUsername: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
  },
  ratingListItemValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  ratingListItemRating: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  ratingListItemDate: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  noRatingsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  noRatingsText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  movieModalSynopsisContainer: {
    marginTop: spacing.md,
  },
  movieModalSynopsis: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: 'justify',
  },
  movieModalNoSynopsis: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.md,
  },
});

