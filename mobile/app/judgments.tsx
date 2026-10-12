import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import api from '../lib/api';
import Header from '../components/ui/Header';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { Judgment } from '../types';

export default function JudgmentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const { data: judgments, isLoading, isError } = useQuery({
    queryKey: ['judgments', submittedQuery],
    queryFn: async () => {
      if (!submittedQuery.trim()) return [];
      const res = await api.get('/judgments/search', {
        params: { q: submittedQuery, limit: 20 },
      });
      return res.data as Judgment[];
    },
    enabled: !!submittedQuery.trim(),
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSubmittedQuery(searchQuery.trim());
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header
        title="Judgments"
        subtitle="Search landmark judgments"
        showBack
        onBack={() => router.back()}
      />

      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Input
          placeholder="Search by case title, section, keyword..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          icon={<Ionicons name="search" size={18} color={colors.textLight} />}
          containerStyle={styles.searchInput}
        />
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={20} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Searching judgments...</Text>
          </View>
        )}

        {isError && (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>
              Failed to search judgments. Please check your connection and try again.
            </Text>
          </Card>
        )}

        {!isLoading && !isError && !submittedQuery && (
          <EmptyState
            icon="book-outline"
            title="Search Judgments"
            message="Enter a keyword, case title, or IPC section to find relevant landmark judgments."
          />
        )}

        {!isLoading && !isError && submittedQuery && judgments?.length === 0 && (
          <EmptyState
            icon="search-outline"
            title="No Results Found"
            message={`No judgments found for "${submittedQuery}". Try different keywords.`}
          />
        )}

        {judgments &&
          judgments.length > 0 &&
          judgments.map((judgment) => (
            <TouchableOpacity
              key={judgment.id}
              activeOpacity={0.7}
              onPress={() => {
                if (judgment.full_text_url) {
                  Linking.openURL(judgment.full_text_url);
                }
              }}
            >
              <Card style={[styles.judgmentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.judgmentHeader}>
                  <View style={[styles.judgmentIconContainer, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="book" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.judgmentMeta}>
                    {judgment.citation && (
                      <Text style={[styles.citation, { color: colors.primary }]}>{judgment.citation}</Text>
                    )}
                    {judgment.judgment_date && (
                      <Text style={[styles.judgmentDate, { color: colors.textLight }]}>
                        {formatDate(judgment.judgment_date)}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={[styles.caseTitle, { color: colors.text }]}>{judgment.case_title}</Text>

                <View style={styles.courtRow}>
                  <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.courtName, { color: colors.textSecondary }]}>{judgment.court_name}</Text>
                </View>

                {judgment.bench && (
                  <View style={styles.courtRow}>
                    <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.benchText, { color: colors.textSecondary }]}>{judgment.bench}</Text>
                  </View>
                )}

                {judgment.summary && (
                  <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={3}>
                    {judgment.summary}
                  </Text>
                )}

                {judgment.full_text_url && (
                  <View style={styles.linkRow}>
                    <Ionicons name="open-outline" size={14} color={colors.primary} />
                    <Text style={[styles.linkText, { color: colors.primary }]}>View Full Judgment</Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.errorLight,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
  },

  // Judgment card
  judgmentCard: {
    marginBottom: Spacing.md,
  },
  judgmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  judgmentIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  judgmentMeta: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  citation: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  judgmentDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  caseTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  courtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  courtName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  benchText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  summary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  linkText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
