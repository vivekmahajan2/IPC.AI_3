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
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { Lawyer } from '../types';

export default function LawyersScreen() {
  const router = useRouter();
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
    <SafeAreaView style={styles.safe}>
      <Header
        title="Lawyer Directory"
        subtitle="Find legal professionals"
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by name, specialization, city..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          icon={<Ionicons name="search" size={18} color={Colors.textLight} />}
          containerStyle={styles.searchInput}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading lawyers...</Text>
          </View>
        )}

        {isError && (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={Colors.error} />
            <Text style={styles.errorText}>
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
                <Card style={styles.lawyerCard}>
                  {/* Main info row */}
                  <View style={styles.lawyerHeader}>
                    <View style={styles.avatarContainer}>
                      <Text style={styles.avatarText}>
                        {lawyer.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.lawyerInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.lawyerName} numberOfLines={1}>
                          {lawyer.name}
                        </Text>
                        {lawyer.is_verified && (
                          <Ionicons
                            name="checkmark-circle"
                            size={16}
                            color={Colors.success}
                          />
                        )}
                      </View>
                      {lawyer.firm_name && (
                        <Text style={styles.firmName} numberOfLines={1}>
                          {lawyer.firm_name}
                        </Text>
                      )}
                      {lawyer.years_of_exp != null && (
                        <Text style={styles.experience}>
                          {lawyer.years_of_exp} years experience
                        </Text>
                      )}
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={Colors.textLight}
                    />
                  </View>

                  {/* Specializations */}
                  {lawyer.specialization.length > 0 && (
                    <View style={styles.tagsRow}>
                      {lawyer.specialization.slice(0, 3).map((spec) => (
                        <View key={spec} style={styles.tag}>
                          <Text style={styles.tagText}>{spec}</Text>
                        </View>
                      ))}
                      {lawyer.specialization.length > 3 && (
                        <View style={[styles.tag, styles.tagMore]}>
                          <Text style={[styles.tagText, styles.tagMoreText]}>
                            +{lawyer.specialization.length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Courts */}
                  {lawyer.practicing_courts.length > 0 && (
                    <View style={styles.courtsRow}>
                      <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.courtsText} numberOfLines={1}>
                        {lawyer.practicing_courts.join(', ')}
                      </Text>
                    </View>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>
                      {lawyer.city && (
                        <View style={styles.detailRow}>
                          <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                          <Text style={styles.detailText}>
                            {lawyer.address ? `${lawyer.address}, ${lawyer.city}` : lawyer.city}
                          </Text>
                        </View>
                      )}

                      {lawyer.bar_council_id && (
                        <View style={styles.detailRow}>
                          <Ionicons name="card-outline" size={16} color={Colors.textSecondary} />
                          <Text style={styles.detailText}>
                            Bar Council: {lawyer.bar_council_id}
                          </Text>
                        </View>
                      )}

                      {lawyer.languages.length > 0 && (
                        <View style={styles.detailRow}>
                          <Ionicons name="language-outline" size={16} color={Colors.textSecondary} />
                          <Text style={styles.detailText}>
                            {lawyer.languages.join(', ')}
                          </Text>
                        </View>
                      )}

                      {/* Contact actions */}
                      <View style={styles.contactActions}>
                        {lawyer.phone && (
                          <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`tel:${lawyer.phone}`)}
                          >
                            <Ionicons name="call" size={16} color={Colors.primary} />
                            <Text style={styles.contactButtonText}>Call</Text>
                          </TouchableOpacity>
                        )}
                        {lawyer.email && (
                          <TouchableOpacity
                            style={styles.contactButton}
                            onPress={() => Linking.openURL(`mailto:${lawyer.email}`)}
                          >
                            <Ionicons name="mail" size={16} color={Colors.primary} />
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
