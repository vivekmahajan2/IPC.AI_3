import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import api from '../lib/api';
import Header from '../components/ui/Header';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { useTheme } from '../context/ThemeContext';
import { Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { SectionMapping } from '../types';

const ACT_NAMES: Record<string, string> = {
  BNS: 'Bharatiya Nyaya Sanhita (BNS)',
  IPC: 'Indian Penal Code (IPC)',
  BNSS: 'Bharatiya Nagarik Suraksha Sanhita (BNSS)',
  CrPC: 'Code of Criminal Procedure (CrPC)',
  BSA: 'Bharatiya Sakshya Adhiniyam (BSA)',
  IEA: 'Indian Evidence Act (IEA)',
};

export default function BareActScreen() {
  const { act } = useLocalSearchParams<{ act: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSectionId, setExpandedSectionId] = useState<number | null>(null);

  const actCode = (act || 'BNS').toUpperCase();
  const actFullName = ACT_NAMES[actCode] || `${actCode} Bare Act`;
  const isNewAct = ['BNS', 'BNSS', 'BSA'].includes(actCode);

  const { data: sections, isLoading, isError } = useQuery({
    queryKey: ['bare-act-sections', actCode],
    queryFn: async () => {
      const res = await api.get('/compare', {
        params: { act: actCode },
      });
      return res.data as SectionMapping[];
    },
  });

  const toggleExpand = (id: number) => {
    setExpandedSectionId(expandedSectionId === id ? null : id);
  };

  const filteredSections = React.useMemo(() => {
    if (!sections) return [];
    if (!searchQuery.trim()) return sections;

    const query = searchQuery.toLowerCase().trim();
    return sections.filter((item) => {
      const sectionNum = isNewAct ? item.new_section : item.old_section;
      const title = isNewAct ? item.old_title : item.old_title;
      const text = isNewAct ? item.new_text : item.old_text;

      return (
        sectionNum.toLowerCase().includes(query) ||
        (title && title.toLowerCase().includes(query)) ||
        (text && text.toLowerCase().includes(query))
      );
    });
  }, [sections, searchQuery, isNewAct]);

  const renderSectionItem = ({ item }: { item: SectionMapping }) => {
    const isExpanded = expandedSectionId === item.id;
    const sectionNum = isNewAct ? item.new_section : item.old_section;
    const sectionTitle = isNewAct ? item.new_title : item.old_title;
    const sectionText = isNewAct ? item.new_text : item.old_text;

    const equivalentAct = isNewAct ? item.old_act : item.new_act;
    const equivalentSec = isNewAct ? item.old_section : item.new_section;
    const equivalentTitle = isNewAct ? item.old_title : item.new_title;

    return (
      <Card style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => toggleExpand(item.id)}
          style={styles.cardHeader}
        >
          <View style={styles.headerTextContainer}>
            <Text style={[styles.sectionNumber, { color: colors.primary }]}>
              Section {sectionNum}
            </Text>
            {sectionTitle && (
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {sectionTitle}
              </Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textLight}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.expandedContent, { borderTopColor: colors.border }]}>
            {/* Section Text */}
            <Text style={[styles.sectionText, { color: colors.text }]}>
              {sectionText || 'Section text not available.'}
            </Text>

            {/* Equivalence Link */}
            {equivalentSec && (
              <View style={[styles.equivalenceBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.equivalenceHeader}>
                  <Ionicons name="swap-horizontal" size={16} color={colors.secondary} />
                  <Text style={[styles.equivalenceLabel, { color: colors.textSecondary }]}>
                    Equivalent provision in {equivalentAct}:
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    // Navigate to Sanhita Converter pre-filled with this search
                    router.push({
                      pathname: '/(tabs)/converter',
                      params: { q: sectionNum },
                    });
                  }}
                  style={styles.equivalenceButton}
                >
                  <Text style={[styles.equivalenceText, { color: colors.secondary }]}>
                    Section {equivalentSec} {equivalentTitle ? `— ${equivalentTitle}` : ''}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header
        title={actCode}
        subtitle={actFullName}
        showBack
        onBack={() => router.back()}
      />

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Input
          placeholder={`Search sections in ${actCode}...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<Ionicons name="search" size={18} color={colors.textLight} />}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading {actCode} sections...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Failed to Load"
            message={`An error occurred while loading sections for ${actCode}. Please try again.`}
          />
        </View>
      ) : (
        <FlatList
          data={filteredSections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderSectionItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No Sections Found"
              message={`No sections match "${searchQuery}" in ${actCode}.`}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
  },
  listContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  sectionCard: {
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  sectionNumber: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  expandedContent: {
    padding: Spacing.xl,
    borderTopWidth: 1,
  },
  sectionText: {
    fontSize: FontSize.md,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  equivalenceBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  equivalenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  equivalenceLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  equivalenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  equivalenceText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
});
