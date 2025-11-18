import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { playlistService } from '../services/playlistService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

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

  // Debug: ver qué datos llegan
  React.useEffect(() => {
    if (playlist) {
      console.log('📅 Playlist data:', {
        scheduled_date: playlist.scheduled_date,
        scheduledDate: (playlist as any).scheduledDate,
        allKeys: Object.keys(playlist),
        director: (playlist as any).director,
        hasDirector: !!(playlist as any).director,
        directorProfileUrl: (playlist as any).director?.profileUrl,
      });
    }
  }, [playlist]);

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
              {/* Primera fila: Foto del director, nombre del ciclo y fecha */}
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
                    {(() => {
                      const dateValue = (playlist as any).scheduled_date || (playlist as any).scheduledDate || playlist.scheduled_date;
                      if (dateValue) {
                        try {
                          const date = typeof dateValue === 'string' 
                            ? new Date(dateValue.includes('T') ? dateValue : dateValue + 'T00:00:00')
                            : new Date(dateValue);
                          if (!isNaN(date.getTime())) {
                            return (
                              <Text style={styles.cycleDate}>
                                {format(date, 'dd/MM/yy')}
                              </Text>
                            );
                          }
                        } catch (error) {
                          console.error('Error formatting date:', error, dateValue);
                        }
                      }
                      return null;
                    })()}
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
                      <TouchableOpacity
                        style={styles.posterItem}
                        onPress={() => {
                          setSelectedMovie(item);
                          setShowMovieModal(true);
                        }}
                        activeOpacity={0.7}
                      >
                        {item.poster ? (
                          <Image
                            source={{ uri: item.poster }}
                            style={styles.carouselPoster}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.carouselPoster, styles.posterPlaceholder]}>
                            <Ionicons name="film-outline" size={32} color={colors.textMuted} />
                          </View>
                        )}
                      </TouchableOpacity>
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
              <ScrollView style={styles.movieModalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.movieModalInfo}>
                  <Text style={styles.movieModalMovieTitle}>{selectedMovie.title}</Text>
                  {selectedMovie.year && (
                    <Text style={styles.movieModalYear}>{selectedMovie.year}</Text>
                  )}
                </View>

                {selectedMovie.synopsis ? (
                  <View style={styles.movieModalSynopsisContainer}>
                    <Text style={styles.movieModalSynopsis}>{selectedMovie.synopsis}</Text>
                  </View>
                ) : (
                  <View style={styles.movieModalSynopsisContainer}>
                    <Text style={styles.movieModalNoSynopsis}>
                      No hay sinopsis disponible para esta película.
                    </Text>
                  </View>
                )}
              </ScrollView>
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
  cycleDate: {
    ...typography.bodySmall,
    color: colors.lime,
    fontWeight: '500',
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
  posterItem: {
    marginRight: spacing.md,
  },
  carouselPoster: {
    width: 120,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    // Responsive: ajustar para pantallas pequeñas
    minWidth: 80,
    minHeight: 120,
  },
  posterPlaceholder: {
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
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
    padding: spacing.lg,
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
  movieModalYear: {
    ...typography.body,
    color: colors.textSecondary,
  },
  movieModalSynopsisContainer: {
    marginTop: spacing.md,
  },
  movieModalSynopsis: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  movieModalNoSynopsis: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing.md,
  },
});

