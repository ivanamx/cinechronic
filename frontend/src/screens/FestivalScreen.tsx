import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { festivalService } from '../services/festivalService';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

export default function FestivalScreen() {
  const route = useRoute();
  const { festivalId } = route.params as any;

  const { data: festival, isLoading } = useQuery({
    queryKey: ['festival', festivalId],
    queryFn: () => festivalService.getFestival(festivalId),
    enabled: !!festivalId,
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!festival) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Festival no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.date}>
          {new Date(festival.date).toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.playlistName}>{festival.playlist.name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Películas del Festival</Text>
        {festival.playlist.movies?.map((movie, index) => (
          <View key={movie.id} style={styles.movieItem}>
            <Text style={styles.movieNumber}>{index + 1}</Text>
            <View style={styles.movieInfo}>
              <Text style={styles.movieTitle}>{movie.title}</Text>
              {movie.year && (
                <Text style={styles.movieYear}>{movie.year}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Participantes</Text>
        {festival.participants?.map((participant) => (
          <View key={participant.id} style={styles.participantItem}>
            <Text style={styles.participantName}>{participant.username}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  date: {
    ...typography.h3,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  playlistName: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.md,
  },
  movieItem: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundLight,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  movieNumber: {
    ...typography.h4,
    color: colors.accent,
    marginRight: spacing.md,
    minWidth: 30,
  },
  movieInfo: {
    flex: 1,
  },
  movieTitle: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  movieYear: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  participantItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantName: {
    ...typography.body,
    color: colors.text,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    padding: spacing.xl,
  },
});

