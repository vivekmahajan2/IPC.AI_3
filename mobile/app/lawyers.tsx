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
import { Lawyer } from '../types';

export default function LawyersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: lawyers, isLoading, isError } = useQuery({
    queryKey: ['lawyers', searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      const res = await api.get('/lawyers', { params });
      return res.data as Lawyer[];
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header
        title="Lawyer Directory"
        subtitle="Find legal professionals"
        showBack
        onBack={() => router.back()}
      />

      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Input
          placeholder="Search by name, specialization, city..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          icon={<Ionicons name="search" size={18} color={colors.textLight} />}
          containerStyle={styles.searchInput}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading lawyers...</Text>
          </View>
        )}

        {isError && (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>
              Failed to load lawyer directory. Please try again.
            </Text>
          </Card>
        )}

        {!isLoading && !isError && lawyers?.length === 0 && (
          <EmptyState
            icon="people-outline"
            title="No Lawyers Found"
            message={
              searchQuery.trim()
                ? `No lawyers found for "${searchQuery}". Try different keywords.`
                : 'No lawyers available at the moment.'
            }
          />
        )}

        {lawyers &&
          lawyers.map((lawyer) => {
            const isExpanded = expandedId === lawyer.id;

            return (
              <TouchableOpacity
                key={lawyer.id}
                activeOpacity={0.8}
                onPress={() => toggleExpand(lawyer.id)}
              >
                <Card style={[styles.lawyerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {/* Main info row */}
                  <View style={styles.lawyerHeader}>
                    <View style={[styles.avatarContainer, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {lawyer.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.lawyerInfo}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.lawyerName, { color: colors.text }]} numberOfLines={1}>
                          {lawyer.name}
                        </Text>
                        {lawyer.is_verified && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={colors.success}
                          />
                        )}
                      </View>
                      {lawyer.firm_name && (
                        <Text style={[styles.firmName, { color: colors.textSecondary }]} numberOfLines={1}>
                          {lawyer.firm_name}
                        </Text>
                      )}
                      {lawyer.years_of_exp != null && (
                        <Text style={[styles.experience, { color: colors.textLight }]}>
                          {lawyer.years_of_exp} years experience
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textLight}
                    />
                  </View>

                  {/* Specializations */}
                  {lawyer.specialization.length > 0 && (
                    <View style={styles.tagsRow}>
                      {lawyer.specialization.slice(0, 3).map((spec) => (
                        <View key={spec} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.tagText, { color: colors.primary }]}>{spec}</Text>
                        </View>
                      ))}
                      {lawyer.specialization.length > 3 && (
                        <View style={[styles.tag, styles.tagMore, { backgroundColor: colors.surfaceAlt }]}>
                          <Text style={[styles.tagText, styles.tagMoreText, { color: colors.textSecondary }]}>
                            +{lawyer.specialization.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Courts */}
                  {lawyer.practicing_courts.length > 0 && (
                    <View style={styles.courtsRow}>
                      <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
                      <Text style={[styles.courtsText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {lawyer.practicing_courts.join(', ')}
                      </Text>
                    </View>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <View style={[styles.expandedSection, { borderTopColor: colors.border }]}>
                      {lawyer.city && (
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {lawyer.address ? `${lawyer.address}, ${lawyer.city}` : lawyer.city}
                          </Text>
                        </View>
                      )}

                      {lawyer.bar_council_id && (
                        <View style={styles.detailRow}>
                          <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            Bar Council: {lawyer.bar_council_id}
                          </Text>
                        </View>
                      )}

                      {lawyer.languages.length > 0 && (
                        <View style={styles.detailRow}>
                          <Ionicons name="language-outline" size={16} color={colors.textSecondary} />
                          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                            {lawyer.languages.join(', ')}
                          </Text>
                        </View>
                      )}

                      {/* Contact actions */}
                      <View style={styles.contactActions}>
                        {lawyer.phone && (
                          <TouchableOpacity
                            style={[styles.contactButton, { borderColor: colors.primary }]}
                            onPress={() => Linking.openURL(`tel:${lawyer.phone}`)}
                          >
                            <Ionicons name="call" size={16} color={colors.primary} />
                            <Text style={[styles.contactButtonText, { color: colors.primary }]}>Call</Text>
                          </TouchableOpacity>
                        )}
                        {lawyer.email && (
                          <TouchableOpacity
                            style={[styles.contactButton, { borderColor: colors.primary }]}
                            onPress={() => Linking.openURL(`mailto:${lawyer.email}`)}
                          >
                            <Ionicons name="mail" size={16} color={colors.primary} />

                            <Text style={styles.contactButtonText}>Email</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  searchInput: {
    marginBottom: 0,
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

  // Lawyer card
  lawyerCard: {
    marginBottom: Spacing.md,
  },
  lawyerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.secondary,
  },
  lawyerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lawyerName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    flexShrink: 1,
  },
  firmName: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  experience: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
    marginTop: 1,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  tag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  tagMore: {
    backgroundColor: Colors.surfaceAlt,
  },
  tagMoreText: {
    color: Colors.textSecondary,
  },

  // Courts
  courtsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  courtsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },

  // Expanded
  expandedSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  detailText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
});
