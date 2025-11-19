import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Swipeable } from 'react-native-gesture-handler';
import { playlistService } from '../services/playlistService';
import CreatePlaylistModal from './CreatePlaylistScreen';
import PlaylistDetailModal from '../components/PlaylistDetailModal';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export default function PlaylistsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => playlistService.getPlaylists(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playlistService.deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledPlaylists'] });
    },
  });

  const handleDelete = useCallback((playlistId: string, playlistName: string) => {
    Alert.alert(
      'Eliminar Ciclo',
      `¿Estás seguro de que quieres eliminar "${playlistName}"? Esta acción no se puede deshacer.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate(playlistId);
            // Cerrar el swipeable si está abierto
            if (swipeableRefs.current[playlistId]) {
              swipeableRefs.current[playlistId]?.close();
            }
          },
        },
      ]
    );
  }, [deleteMutation]);

  const closeSwipeable = useCallback((playlistId: string) => {
    Object.keys(swipeableRefs.current).forEach((id) => {
      if (id !== playlistId && swipeableRefs.current[id]) {
        swipeableRefs.current[id]?.close();
      }
    });
  }, []);

  const renderRightActions = useCallback((playlistId: string, playlistName: string) => {
    return (
      <View style={styles.rightActionContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(playlistId, playlistName)}
        >
          <Ionicons name="trash-outline" size={24} color={colors.background} />
          <Text style={styles.deleteButtonText}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    );
  }, [handleDelete]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color={colors.lime} />
          <Text style={styles.createButtonText}>Crear Nuevo Ciclo</Text>
        </TouchableOpacity>

        <CreatePlaylistModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />

        <PlaylistDetailModal
          visible={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPlaylistId(null);
          }}
          playlistId={selectedPlaylistId}
        />

      {isLoading ? (
        <Text style={styles.loadingText}>Cargando...</Text>
      ) : playlists && playlists.length > 0 ? (
        <FlatList
          data={playlists}
          renderItem={({ item }) => (
            <Swipeable
              ref={(ref) => {
                if (ref) {
                  swipeableRefs.current[item.id] = ref;
                } else {
                  delete swipeableRefs.current[item.id];
                }
              }}
              renderRightActions={() => renderRightActions(item.id, item.name)}
              rightThreshold={40}
              onSwipeableWillOpen={() => closeSwipeable(item.id)}
            >
              <TouchableOpacity
                style={styles.playlistCard}
                onPress={() => {
                  setSelectedPlaylistId(item.id);
                  setShowDetailModal(true);
                }}
                activeOpacity={0.7}
              >
                {/* Fecha en esquina superior derecha */}
                {item.scheduled_date && (() => {
                  try {
                    const date = new Date(item.scheduled_date + 'T00:00:00');
                    if (!isNaN(date.getTime())) {
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = String(date.getFullYear()).slice(-2);
                      return (
                        <View style={styles.dateBadge}>
                          <Text style={styles.dateBadgeText}>{day}/{month}/{year}</Text>
                        </View>
                      );
                    }
                  } catch (error) {
                    console.error('Error formatting date:', error);
                  }
                  return null;
                })()}
                
                <View style={styles.cardContent}>
                  {/* Foto del director */}
                  {(item as any).director?.profileUrl ? (
                    <Image
                      source={{ uri: (item as any).director.profileUrl }}
                      style={styles.directorPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.directorPhoto, styles.directorPhotoPlaceholder]}>
                      <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  
                  {/* Contenido principal */}
                  <View style={styles.textContent}>
                    {/* Primera fila: Nombre */}
                    <Text style={styles.playlistName}>{item.name}</Text>
                    
                    {/* Segunda fila: Número de películas */}
                    <Text style={styles.playlistMovies}>
                      {item.movies?.length || 0} películas
                    </Text>
                  </View>
                </View>
                
                {/* Fila aparte: Lugar de origen */}
                {(item as any).director?.placeOfBirth && (
                  <View style={styles.bottomInfoRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.infoText}>
                      {(item as any).director.placeOfBirth}
                    </Text>
                  </View>
                )}
                
                {/* Fila aparte: Timeline */}
                {item.movies && item.movies.length > 0 && (() => {
                  const years = item.movies
                    .map((movie: any) => movie.year)
                    .filter((year): year is number => year != null && !isNaN(year))
                    .sort((a, b) => a - b);
                  
                  if (years.length > 0) {
                    const yearRange = years.length === 1
                      ? `${years[0]}`
                      : `${years[0]} - ${years[years.length - 1]}`;
                    
                    return (
                      <View style={styles.bottomInfoRow}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.infoLabel}>Timeline:</Text>
                        <Text style={styles.infoText}>{yearRange}</Text>
                      </View>
                    );
                  }
                  return null;
                })()}
                
              </TouchableOpacity>
            </Swipeable>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tienes ciclos aún</Text>
          <Text style={styles.emptySubtext}>
            Crea tu primer ciclo para comenzar
          </Text>
        </View>
      )}
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lime,
    borderStyle: 'dashed',
  },
  createButtonText: {
    ...typography.h4,
    color: colors.lime,
    marginLeft: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
  },
  playlistCard: {
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  dateBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
  },
  dateBadgeText: {
    ...typography.bodySmall,
    color: colors.lime,
    fontWeight: '600',
    fontSize: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  directorPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.lime,
  },
  directorPhotoPlaceholder: {
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.border,
  },
  textContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  playlistName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  bottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  playlistDate: {
    ...typography.bodySmall,
    color: colors.accent,
    fontSize: 12,
  },
  playlistMovies: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '500',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rightActionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    flex: 1,
  },
  deleteButton: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    flex: 1,
    borderRadius: 12,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deleteButtonText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});

