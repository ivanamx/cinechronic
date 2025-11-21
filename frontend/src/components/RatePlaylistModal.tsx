import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, ActivityIndicator, PanResponder } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { playlistService } from '../services/playlistService';
import { ratingService } from '../services/ratingService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface RatePlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  playlistId: string | null;
}

export default function RatePlaylistModal({ visible, onClose, playlistId }: RatePlaylistModalProps) {
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState<{ [movieId: string]: number }>({});
  const [previewRatings, setPreviewRatings] = useState<{ [movieId: string]: number }>({});
  const [submittedMovies, setSubmittedMovies] = useState<Set<string>>(new Set());

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => playlistService.getPlaylist(playlistId!),
    enabled: visible && !!playlistId,
  });

  // Cargar calificaciones existentes cuando se carga el ciclo
  useEffect(() => {
    if (playlist?.movies && playlist.movies.length > 0) {
      const initialRatings: { [movieId: string]: number } = {};
      // Aquí podrías cargar calificaciones existentes si las hay
      // Por ahora, inicializamos todas en 5.0
      playlist.movies.forEach((movie: any) => {
        initialRatings[movie.id] = 5.0;
      });
      setRatings(initialRatings);
    }
  }, [playlist]);


  const updateRating = (movieId: string, value: number) => {
    // Asegurar que el valor esté entre 1 y 10
    const clampedValue = Math.max(1, Math.min(10, value));
    // Redondear a 1 decimal
    const roundedValue = Math.round(clampedValue * 10) / 10;
    setRatings((prev) => ({
      ...prev,
      [movieId]: roundedValue,
    }));
  };

  // Calcular el promedio de calificaciones
  const averageRating = React.useMemo(() => {
    if (!playlist?.movies || playlist.movies.length === 0) return 0;
    const ratingValues = playlist.movies
      .map((movie: any) => ratings[movie.id] || 5.0)
      .filter((rating: number) => rating > 0);
    
    if (ratingValues.length === 0) return 0;
    const sum = ratingValues.reduce((acc: number, val: number) => acc + val, 0);
    return sum / ratingValues.length;
  }, [ratings, playlist?.movies]);

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
            <View style={styles.headerInfo}>
              <View style={styles.titleRow}>
                <View style={styles.titleWithBadge}>
                  <Text style={styles.modalTitle}>{playlist?.name || 'Calificar Ciclo'}</Text>
                  <View style={styles.ratingBadgeInline}>
                    <Ionicons name="star" size={14} color={colors.accent} />
                    <Text style={styles.ratingBadgeText}>
                      {averageRating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
              {playlist?.scheduled_date && (
                <Text style={styles.modalDate}>
                  {formatDate(playlist.scheduled_date) || formatDate((playlist as any).scheduledDate)}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : playlist?.movies && playlist.movies.length > 0 ? (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {playlist.movies.map((movie: any, index: number) => (
                <MovieRatingItem
                  key={movie.id || index}
                  movie={movie}
                  rating={ratings[movie.id] || 5.0}
                  previewRating={previewRatings[movie.id]}
                  onRatingChange={(value) => updateRating(movie.id, value)}
                  onPreviewChange={(value) => {
                    setPreviewRatings((prev) => ({
                      ...prev,
                      [movie.id]: value,
                    }));
                  }}
                  onPreviewEnd={() => {
                    setPreviewRatings((prev) => {
                      const newPreview = { ...prev };
                      delete newPreview[movie.id];
                      return newPreview;
                    });
                  }}
                  isSubmitted={submittedMovies.has(movie.id)}
                  onSubmitted={(movieId) => {
                    setSubmittedMovies((prev) => new Set(prev).add(movieId));
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay películas en este ciclo</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Componente para cada item de calificación de película
function MovieRatingItem({
  movie,
  rating,
  previewRating,
  onRatingChange,
  onPreviewChange,
  onPreviewEnd,
  isSubmitted,
  onSubmitted,
}: {
  movie: any;
  rating: number;
  previewRating?: number;
  onRatingChange: (value: number) => void;
  onPreviewChange: (value: number) => void;
  onPreviewEnd: () => void;
  isSubmitted: boolean;
  onSubmitted: (movieId: string) => void;
}) {
  const queryClient = useQueryClient();
  const rateMovieMutation = useMutation({
    mutationFn: async (ratingValue: number) => {
      // Redondear a 1 decimal y convertir a número entero
      const roundedRating = Math.round(ratingValue * 10) / 10;
      const finalRating = Math.round(roundedRating);
      const movieIdString = String(movie.id);
      
      return ratingService.rateMovie(movieIdString, finalRating);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      queryClient.invalidateQueries({ queryKey: ['movieViewCount', movie.id] });
      onSubmitted(movie.id);
    },
    onError: (error: any) => {
      console.error('❌ Error al calificar película:', error);
    },
  });

  const handleSubmit = () => {
    rateMovieMutation.mutate(rating);
  };

  return (
    <View style={styles.movieItem}>
      <View style={styles.movieRow}>
        {movie.poster ? (
          <Image
            source={{ uri: movie.poster }}
            style={styles.moviePoster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.moviePoster, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.movieInfoContainer}>
          <View style={styles.movieTitleRow}>
            <Text style={styles.movieTitle} numberOfLines={1}>
              {movie.title}
              {movie.year && (
                <Text style={styles.movieYear}>
                  {' • '}{movie.year}
                </Text>
              )}
            </Text>
            <Text style={styles.ratingLabel}>
              {(previewRating ?? rating).toFixed(1)}
            </Text>
          </View>
          <View style={styles.ratingContainer}>
            <Slider
              value={rating}
              onValueChange={onRatingChange}
              onValueChangePreview={onPreviewChange}
              onValueChangeEnd={onPreviewEnd}
              minimumValue={1}
              maximumValue={10}
              step={0.1}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.submitButtonIndividual,
              (rateMovieMutation.isPending || isSubmitted) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={rateMovieMutation.isPending || isSubmitted}
          >
            {rateMovieMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : isSubmitted ? (
              <View style={styles.submittedContainer}>
                <Ionicons name="checkmark-circle" size={16} color={colors.background} />
                <Text style={styles.submitButtonTextIndividual}>Enviado</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonTextIndividual}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Componente Slider personalizado
interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  onValueChangePreview?: (value: number) => void;
  onValueChangeEnd?: () => void;
  minimumValue: number;
  maximumValue: number;
  step: number;
}

function Slider({ value, onValueChange, onValueChangePreview, onValueChangeEnd, minimumValue, maximumValue, step }: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const sliderTrackRef = React.useRef<View>(null);
  const [sliderWidth, setSliderWidth] = useState(200);
  const thumbSize = 20;

  // Sincronizar localValue con value cuando no se está arrastrando
  React.useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  // Usar localValue durante el arrastre para movimiento fluido, value cuando no se arrastra
  const displayValue = isDragging ? localValue : value;
  const percentage = ((displayValue - minimumValue) / (maximumValue - minimumValue)) * 100;
  // Calcular posición del thumb: el thumb debe moverse desde 0 hasta sliderWidth - thumbSize
  const thumbPosition = Math.max(0, Math.min(sliderWidth - thumbSize, (percentage / 100) * (sliderWidth - thumbSize)));

  const calculateValue = (locationX: number, applyStep: boolean = false) => {
    if (sliderWidth <= 0) return displayValue;
    
    // Asegurar que locationX esté dentro del rango del track
    const clampedX = Math.max(0, Math.min(sliderWidth, locationX));
    // Calcular el porcentaje (0 a 100)
    const newPercentage = (clampedX / sliderWidth) * 100;
    // Calcular el valor en el rango [minimumValue, maximumValue]
    let newValue = minimumValue + (newPercentage / 100) * (maximumValue - minimumValue);
    
    // Solo aplicar el step si se solicita (al soltar el dedo)
    if (applyStep) {
      newValue = Math.round(newValue / step) * step;
    }
    
    // Asegurar que esté dentro del rango válido
    const finalValue = Math.max(minimumValue, Math.min(maximumValue, newValue));
    
    return finalValue;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      const { locationX } = evt.nativeEvent;
      // Calcular valor sin step para movimiento fluido
      const newValue = calculateValue(locationX, false);
      setLocalValue(newValue);
    },
    onPanResponderMove: (evt) => {
      // Usar locationX que es relativo al componente
      const { locationX } = evt.nativeEvent;
      // Calcular valor sin step para movimiento fluido
      const newValue = calculateValue(locationX, false);
      setLocalValue(newValue);
      // Llamar al callback de preview para actualizar la visualización en tiempo real
      if (onValueChangePreview) {
        onValueChangePreview(newValue);
      }
    },
    onPanResponderRelease: (evt) => {
      // Al soltar, aplicar el step y actualizar el valor final
      const { locationX } = evt.nativeEvent;
      const finalValue = calculateValue(locationX, true);
      setLocalValue(finalValue);
      onValueChange(finalValue);
      // Limpiar el preview
      if (onValueChangeEnd) {
        onValueChangeEnd();
      }
      setIsDragging(false);
    },
  });

  return (
    <View style={styles.sliderContainer}>
      <View
        ref={sliderTrackRef}
        style={styles.sliderTrack}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          if (width > 0 && width !== sliderWidth) {
            setSliderWidth(width);
          }
        }}
        {...panResponder.panHandlers}
      >
        <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
        <View
          style={[
            styles.sliderThumb,
            { left: thumbPosition },
            isDragging && styles.sliderThumbActive,
          ]}
          pointerEvents="none"
        />
      </View>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{minimumValue}</Text>
        <Text style={styles.sliderLabel}>{maximumValue}</Text>
      </View>
    </View>
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
    maxHeight: '92%',
    minHeight: 500,
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
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    marginBottom: spacing.xs,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  ratingBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 12,
    gap: spacing.xs / 2,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  ratingBadgeText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 12,
  },
  modalDate: {
    ...typography.bodySmall,
    color: colors.lime,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
  },
  movieItem: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  movieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  moviePoster: {
    width: 60,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  posterPlaceholder: {
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  movieInfoContainer: {
    flex: 1,
  },
  movieTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  movieTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flex: 1,
    minWidth: 100,
  },
  movieYear: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  ratingContainer: {
    width: '100%',
  },
  ratingLabel: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  sliderContainer: {
    width: '100%',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: colors.backgroundLight,
    borderRadius: 3,
    position: 'relative',
    width: '100%',
    paddingVertical: 10,
    marginVertical: -10,
    justifyContent: 'center',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: colors.lime,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lime,
    borderWidth: 2,
    borderColor: colors.background,
    top: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sliderThumbActive: {
    transform: [{ scale: 1.2 }],
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    width: '100%',
  },
  sliderLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 10,
  },
  submitButtonIndividual: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonTextIndividual: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: '600',
    fontSize: 12,
  },
  submittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

