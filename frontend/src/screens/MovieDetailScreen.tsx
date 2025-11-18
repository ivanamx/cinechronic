import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export default function MovieDetailScreen() {
  const route = useRoute();
  const { movie } = route.params as any;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {movie.poster_path && (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}${movie.poster_path}` }}
            style={styles.poster}
          />
        )}

        <View style={styles.content}>
          <View style={styles.headerSection}>
            <Text style={styles.title} numberOfLines={2}>{movie.title}</Text>
            {movie.release_date && (
              <Text style={styles.year}>
                {new Date(movie.release_date).getFullYear()}
              </Text>
            )}
          </View>

          {movie.overview && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sinopsis</Text>
              <Text style={styles.overview} numberOfLines={8}>
                {movie.overview}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>Agregar a Ciclo</Text>
          </TouchableOpacity>
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
  poster: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  headerSection: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  year: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  section: {
    flex: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
    fontSize: 16,
  },
  overview: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: colors.lime,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addButtonText: {
    ...typography.h4,
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
});

