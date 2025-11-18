import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList, Image, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { playlistService } from '../services/playlistService';
import { authService } from '../services/authService';
import RatePlaylistModal from '../components/RatePlaylistModal';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showPlaylistsModal, setShowPlaylistsModal] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: playlists, isLoading } = useQuery({
    queryKey: ['playlists'],
    queryFn: () => playlistService.getPlaylists(),
    enabled: showPlaylistsModal,
  });

  const handleLogout = async () => {
    await logout();
  };

  const handleSelectPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setShowPlaylistsModal(false);
    setShowRateModal(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { username?: string; password?: string }) => {
      return await authService.updateProfile(data);
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setShowConfigModal(false);
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.message || 'Error al actualizar el perfil');
    },
  });

  const handleUpdateProfile = () => {
    if (!newUsername && !newPassword) {
      Alert.alert('Error', 'Debes ingresar al menos un campo para actualizar');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const updateData: { username?: string; password?: string } = {};
    if (newUsername) updateData.username = newUsername;
    if (newPassword) updateData.password = newPassword;

    updateProfileMutation.mutate(updateData);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.username}>{user?.username || 'Usuario'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
        </View>

        <View style={styles.menu}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => setShowPlaylistsModal(true)}
        >
          <Text style={styles.menuItemText}>Mis Calificaciones</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => {
            setNewUsername('');
            setNewPassword('');
            setConfirmPassword('');
            setShowConfigModal(true);
          }}
        >
          <Text style={styles.menuItemText}>Configuración</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => setShowAboutModal(true)}
        >
          <Text style={styles.menuItemText}>Acerca de</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={[styles.menuItemText, styles.logoutText]}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* Modal para seleccionar ciclo */}
      <Modal
        visible={showPlaylistsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlaylistsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Ciclo</Text>
              <TouchableOpacity onPress={() => setShowPlaylistsModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Cargando ciclos...</Text>
              </View>
            ) : playlists && playlists.length > 0 ? (
              <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const dateValue = (item as any).scheduled_date || (item as any).scheduledDate || item.scheduled_date;
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
                      console.error('Error formatting date:', error);
                    }
                  }

                  return (
                    <TouchableOpacity
                      style={styles.playlistItem}
                      onPress={() => handleSelectPlaylist(item.id)}
                    >
                      <View style={styles.playlistItemContent}>
                        <Text style={styles.playlistItemName}>{item.name}</Text>
                        {formattedDate && (
                          <Text style={styles.playlistItemDate}>{formattedDate}</Text>
                        )}
                        <Text style={styles.playlistItemMovies}>
                          {item.movies?.length || 0} películas
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.playlistList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No tienes ciclos creados</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de calificación */}
      <RatePlaylistModal
        visible={showRateModal}
        onClose={() => {
          setShowRateModal(false);
          setSelectedPlaylistId(null);
        }}
        playlistId={selectedPlaylistId}
      />

      {/* Modal de configuración */}
      <Modal
        visible={showConfigModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configuración</Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.configContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nombre de usuario</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nuevo nombre de usuario"
                  placeholderTextColor={colors.textMuted}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  autoCapitalize="none"
                />
                <Text style={styles.inputHint}>
                  Deja vacío si no deseas cambiar el nombre de usuario
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nueva contraseña</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nueva contraseña"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Text style={styles.inputHint}>
                  Debe tener al menos 6 caracteres
                </Text>
              </View>

              {newPassword ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirmar contraseña</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirma la nueva contraseña"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.updateButton, updateProfileMutation.isPending && styles.updateButtonDisabled]}
                onPress={handleUpdateProfile}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.updateButtonText}>Actualizar</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Acerca de */}
      <Modal
        visible={showAboutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Acerca de</Text>
              <TouchableOpacity onPress={() => setShowAboutModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.aboutContent}>
              <View style={styles.aboutHeader}>
                <View style={styles.aboutLogo}>
                  <Image
                    source={require('../../assets/cchroniclogo2.png')}
                    style={styles.aboutLogoImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.aboutAppName}>CineChronic</Text>
                <Text style={styles.aboutVersion}>Versión 1.0.0</Text>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutDescription}>
                  CineChronic es una aplicación para descubrir y organizar ciclos de cine. 
                  Explora recomendaciones de directores, crea tus propios ciclos de películas 
                  y califica tus favoritas.
                </Text>
              </View>

              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Características</Text>
                <View style={styles.aboutFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.lime} />
                  <Text style={styles.aboutFeatureText}>Recomendaciones personalizadas de directores</Text>
                </View>
                <View style={styles.aboutFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.lime} />
                  <Text style={styles.aboutFeatureText}>Creación y gestión de ciclos de cine</Text>
                </View>
                <View style={styles.aboutFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.lime} />
                  <Text style={styles.aboutFeatureText}>Sistema de calificaciones</Text>
                </View>
                <View style={styles.aboutFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.lime} />
                  <Text style={styles.aboutFeatureText}>Búsqueda de películas</Text>
                </View>
              </View>

              <View style={styles.aboutFooter}>
                <Text style={styles.aboutCopyright}>
                  © {new Date().getFullYear()} CineChronic
                </Text>
                <Text style={styles.aboutFooterText}>
                  Todos los derechos reservados
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    ...typography.h1,
    color: colors.text,
  },
  username: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  menu: {
    padding: spacing.md,
  },
  menuItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    ...typography.body,
    color: colors.text,
  },
  logoutText: {
    color: colors.error,
  },
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
    maxHeight: '90%',
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
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  playlistList: {
    padding: spacing.md,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playlistItemContent: {
    flex: 1,
  },
  playlistItemName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  playlistItemDate: {
    ...typography.bodySmall,
    color: colors.lime,
    marginBottom: spacing.xs,
  },
  playlistItemMovies: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  configContent: {
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  inputHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontSize: 12,
  },
  updateButton: {
    backgroundColor: colors.lime,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    ...typography.h4,
    color: colors.background,
    fontWeight: '600',
  },
  aboutContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  aboutHeader: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: 0,
  },
  aboutLogo: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  aboutLogoImage: {
    width: '100%',
    height: '100%',
  },
  aboutAppName: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
    fontSize: 20,
  },
  aboutVersion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  aboutSection: {
    marginBottom: spacing.sm,
  },
  aboutDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'justify',
    fontSize: 13,
  },
  aboutSectionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
    fontSize: 14,
  },
  aboutFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  aboutFeatureText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    fontSize: 12,
  },
  aboutFooter: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  aboutCopyright: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
    fontSize: 11,
  },
  aboutFooterText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    fontSize: 10,
  },
});

