import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, Image } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { playlistService } from '../services/playlistService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

interface CreatePlaylistModalProps {
  visible: boolean;
  onClose: (created?: boolean) => void;
  initialDirectorName?: string | null;
}

export default function CreatePlaylistModal({ visible, onClose, initialDirectorName }: CreatePlaylistModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: number; name: string; profileUrl: string | null }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Efecto para establecer el nombre inicial del director cuando se abre el modal
  useEffect(() => {
    if (visible && initialDirectorName) {
      setName(initialDirectorName);
    } else if (!visible) {
      // Limpiar cuando se cierra el modal
      setName('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [visible, initialDirectorName]);

  const createMutation = useMutation({
    mutationFn: () => playlistService.createPlaylist({ 
      name,
      date: undefined 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledPlaylists'] });
      setName('');
      onClose(true); // Pasar true para indicar que se creó exitosamente
    },
  });

  const handleCreate = () => {
    if (name.trim()) {
      createMutation.mutate();
    }
  };

  const handleClose = () => {
    setName('');
    setSuggestions([]);
    setShowSuggestions(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    onClose(false); // Pasar false para indicar que se canceló
  };

  // Buscar directores cuando el usuario escribe (después del 2do carácter)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (name.length >= 2) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await playlistService.searchDirectors(name);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error('Error searching directors:', error);
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setIsSearching(false);
        }
      }, 300); // Debounce de 300ms
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [name]);

  const handleSelectDirector = (director: { id: number; name: string; profileUrl: string | null }) => {
    // Cancelar el timeout del onBlur si existe
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setName(director.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Crear Nuevo Ciclo</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Nombre del director</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Christopher Nolan"
                placeholderTextColor={colors.textMuted}
                autoFocus
                onFocus={() => {
                  if (suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay para permitir que el touch en la sugerencia se registre
                  blurTimeoutRef.current = setTimeout(() => {
                    setShowSuggestions(false);
                    blurTimeoutRef.current = null;
                  }, 200);
                }}
              />
              {isSearching && (
                <View style={styles.searchIndicator}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                </View>
              )}
            </View>
            
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.id.toString()}
                    style={styles.suggestionItem}
                    onPressIn={() => handleSelectDirector(item)}
                    activeOpacity={0.7}
                  >
                    {item.profileUrl ? (
                      <Image
                        source={{ uri: item.profileUrl }}
                        style={styles.suggestionPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.suggestionPhoto, styles.suggestionPhotoPlaceholder]}>
                        <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={styles.suggestionText}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

        <TouchableOpacity
          style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || createMutation.isPending}
        >
          <Text style={styles.createButtonText}>
                {createMutation.isPending ? 'Creando...' : 'Crear Ciclo'}
          </Text>
        </TouchableOpacity>
          </ScrollView>
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: '25%',
  },
  modalContent: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 20,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  form: {
    padding: spacing.lg,
  },
  label: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.backgroundLight,
    color: colors.text,
    padding: spacing.md,
    paddingRight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIndicator: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -8 }],
  },
  suggestionsContainer: {
    marginTop: spacing.xs,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 200,
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  suggestionPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  suggestionPhotoPlaceholder: {
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: colors.border,
  },
  suggestionText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  createButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.lime,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    ...typography.h4,
    color: colors.lime,
  },
});

