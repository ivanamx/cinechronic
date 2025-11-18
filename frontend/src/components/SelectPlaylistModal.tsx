import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { playlistService } from '../services/playlistService';
import { movieService } from '../services/movieService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { format } from 'date-fns';

interface SelectPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  movie: any; // Película de TMDB que se quiere agregar
  onCreatePlaylist?: () => void; // Callback para abrir modal de crear ciclo
}

export default function SelectPlaylistModal({ visible, onClose, movie, onCreatePlaylist }: SelectPlaylistModalProps) {
  const queryClient = useQueryClient();

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => playlistService.getPlaylists(),
    enabled: visible, // Solo cargar cuando el modal está visible
  });

  const addMovieMutation = useMutation({
    mutationFn: async ({ playlistId, movieData }: { playlistId: string; movieData: any }) => {
      // Primero, guardar la película en la base de datos si no existe
      const savedMovie = await movieService.saveMovie({
        tmdbId: movieData.id,
        title: movieData.title,
        poster: movieData.poster_path ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}` : undefined,
        backdrop: movieData.backdrop_path ? `https://image.tmdb.org/t/p/w500${movieData.backdrop_path}` : undefined,
        synopsis: movieData.overview,
        year: movieData.release_date ? new Date(movieData.release_date).getFullYear() : undefined,
        duration: movieData.runtime,
        genre: movieData.genre_ids || [],
      });

      // Luego, agregar la película al ciclo
      return await playlistService.addMovieToPlaylist(playlistId, savedMovie.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      onClose();
    },
  });

  const handleSelectPlaylist = (playlistId: string) => {
    addMovieMutation.mutate({ playlistId, movieData: movie });
  };

  const handleCreatePlaylist = () => {
    if (onCreatePlaylist) {
      onCreatePlaylist();
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.titleContainer}>
                <Text style={styles.modalTitle}>Agregar a Ciclo</Text>
                {onCreatePlaylist && (
                  <TouchableOpacity
                    style={styles.createBadge}
                    onPress={handleCreatePlaylist}
                  >
                    <Ionicons name="add" size={16} color={colors.background} />
                    <Text style={styles.createBadgeText}>Crear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {!movie ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.emptyText}>No hay película seleccionada</Text>
              </View>
            ) : isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : playlists && playlists.length > 0 ? (
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.playlistItem}
                    onPress={() => handleSelectPlaylist(item.id)}
                    disabled={addMovieMutation.isPending}
                  >
                    <View style={styles.playlistInfo}>
                      <Text style={styles.playlistName}>{item.name}</Text>
                      {item.scheduled_date && (() => {
                        try {
                          const date = new Date(item.scheduled_date + 'T00:00:00');
                          if (!isNaN(date.getTime())) {
                            return (
                              <Text style={styles.playlistDate}>
                                {format(date, 'dd MMM yyyy')}
                              </Text>
                            );
                          }
                        } catch (error) {
                          console.error('Error formatting date:', error);
                        }
                        return null;
                      })()}
                      <Text style={styles.playlistMovies}>
                        {item.movies?.length || 0} películas
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="list-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No tienes ciclos creados</Text>
                <Text style={styles.emptySubtext}>
                  Crea tu primer ciclo para agregar películas
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreatePlaylist}
                >
                  <Ionicons name="add-circle" size={20} color={colors.text} />
                  <Text style={styles.createButtonText}>Crear Ciclo</Text>
                </TouchableOpacity>
              </View>
            )}

            {addMovieMutation.isPending && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Agregando...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </>
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
    maxWidth: 400,
    maxHeight: '70%',
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  createBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createBadgeText: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: '600',
    fontSize: 12,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  playlistDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  playlistMovies: {
    ...typography.caption,
    color: colors.accent,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.h4,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  createButtonText: {
    ...typography.h4,
    color: colors.text,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
  },
});

