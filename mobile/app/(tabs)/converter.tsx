import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import api from '../../lib/api';
import { naturalCompareSections } from '../../lib/sort';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { SectionMapping } from '../../types';

type Direction = 'old_to_new' | 'new_to_old';
type LawPair = 'ALL' | 'IPC_BNS' | 'CRPC_BNSS' | 'IEA_BSA';

const LAW_PAIRS: { id: LawPair; label: string; oldAct: string; newAct: string }[] = [
  { id: 'ALL', label: 'All Laws', oldAct: '', newAct: '' },
  { id: 'IPC_BNS', label: 'IPC ↔ BNS', oldAct: 'IPC', newAct: 'BNS' },
  { id: 'CRPC_BNSS', label: 'CrPC ↔ BNSS', oldAct: 'CRPC', newAct: 'BNSS' },
  { id: 'IEA_BSA', label: 'IEA ↔ BSA', oldAct: 'IEA', newAct: 'BSA' },
];

export default function ConverterScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string;
    section?: string;
    act?: string;
    targetSec?: string;
    targetAct?: string;
    direction?: Direction;
    t?: string;
  }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [direction, setDirection] = useState<Direction>('old_to_new');
  const [selectedPair, setSelectedPair] = useState<LawPair>('ALL');
  const [activeExactSection, setActiveExactSection] = useState<string | null>(null);
  const [activeExactAct, setActiveExactAct] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout>();

  // Synchronize when routed with parameters (e.g. from Bare Act "Equivalent Provision" tap)
  useEffect(() => {
    const incomingSec = params.section || params.q;
    if (incomingSec) {
      const secTrimmed = incomingSec.trim();
      setSearchQuery(secTrimmed);
      setDebouncedQuery(secTrimmed);
      setActiveExactSection(secTrimmed);
    }

    if (params.direction === 'new_to_old' || params.direction === 'old_to_new') {
      setDirection(params.direction);
    }

    if (params.act) {
      const actUp = params.act.toUpperCase();
      setActiveExactAct(actUp);
      if (actUp === 'IPC' || actUp === 'BNS') setSelectedPair('IPC_BNS');
      else if (actUp === 'CRPC' || actUp === 'BNSS') setSelectedPair('CRPC_BNSS');
      else if (actUp === 'IEA' || actUp === 'BSA') setSelectedPair('IEA_BSA');
    }
  }, [params.q, params.section, params.act, params.direction, params.t]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() !== activeExactSection) {
      setActiveExactSection(null);
      setActiveExactAct(null);
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 350);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveExactSection(null);
    setActiveExactAct(null);
  };

  const toggleDirection = () => {
    setDirection((d) => (d === 'old_to_new' ? 'new_to_old' : 'old_to_new'));
  };

  const { data: mappings, isLoading, isFetching } = useQuery({
    queryKey: ['mappings', debouncedQuery, direction, selectedPair, activeExactSection, activeExactAct],
    queryFn: async () => {
      if (!debouncedQuery) return [];

      let actFilter: string | undefined = undefined;
      if (selectedPair !== 'ALL') {
        const pairObj = LAW_PAIRS.find((p) => p.id === selectedPair);
        if (pairObj) {
          actFilter = direction === 'old_to_new' ? pairObj.oldAct : pairObj.newAct;
        }
      }

      // If routed for a specific section, attempt exact section query first
      if (activeExactSection && debouncedQuery === activeExactSection) {
        const queryParams: Record<string, string> = {
          section: activeExactSection,
          direction,
        };
        const targetAct = activeExactAct || actFilter;
        if (targetAct) {
          queryParams.act = targetAct;
        }

        let res = await api.get('/compare', { params: queryParams });
        let data = res.data as SectionMapping[];

        // Fallback to fuzzy text search if exact lookup returned no records
        if (!data || data.length === 0) {
          const fallbackParams: Record<string, string> = {
            q: debouncedQuery,
            direction,
          };
          if (actFilter) fallbackParams.act = actFilter;
          res = await api.get('/compare', { params: fallbackParams });
          data = res.data as SectionMapping[];
        }

        return [...data].sort((a, b) => {
          const aSec = direction === 'old_to_new' ? a.old_section : a.new_section;
          const bSec = direction === 'old_to_new' ? b.old_section : b.new_section;
          return naturalCompareSections(aSec, bSec);
        });
      }

      // Standard user-driven query
      const queryParams: Record<string, string> = {
        q: debouncedQuery,
        direction,
      };
      if (actFilter) {
        queryParams.act = actFilter;
      }

      const res = await api.get('/compare', { params: queryParams });
      const data = res.data as SectionMapping[];
      return [...data].sort((a, b) => {
        const aSec = direction === 'old_to_new' ? a.old_section : a.new_section;
        const bSec = direction === 'old_to_new' ? b.old_section : b.new_section;
        return naturalCompareSections(aSec, bSec);
      });
    },
    enabled: debouncedQuery.length > 0,
  });

  const renderMapping = ({ item }: { item: SectionMapping }) => {
    const from = direction === 'old_to_new'
      ? { act: item.old_act, section: item.old_section, title: item.old_title, text: item.old_text }
      : { act: item.new_act, section: item.new_section, title: item.new_title, text: item.new_text };
    const to = direction === 'old_to_new'
      ? { act: item.new_act, section: item.new_section, title: item.new_title, text: item.new_text }
      : { act: item.old_act, section: item.old_section, title: item.old_title, text: item.old_text };

    return (
      <Card style={[styles.mappingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Source Provision Header */}
        <View style={styles.mappingSection}>
          <View style={styles.rowBetween}>
            <Badge
              label={`${from.act} (Current)`}
              color={colors.secondary}
              backgroundColor={colors.secondaryLight}
            />
            {item.is_identical && (
              <Badge label="Identical" color={colors.success} backgroundColor={colors.successLight} />
            )}
          </View>
          <Text style={[styles.sectionNumber, { color: colors.text }]}>Section {from.section}</Text>
          {from.title && <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{from.title}</Text>}

          {/* Source Provision Summary */}
          {from.text && from.text.trim().length > 0 && (
            <View style={[styles.sourceTextBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.boxLabel, { color: colors.textSecondary }]}>
                {from.act} Provision Information:
              </Text>
              <Text style={[styles.boxText, { color: colors.text }]}>
                {from.text}
              </Text>
            </View>
          )}
        </View>

        {/* Visual Conversion Bridge */}
        <View style={styles.arrowContainer}>
          <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
          <View style={[styles.arrowBadge, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
            <Ionicons name="swap-vertical" size={16} color={colors.primary} />
            <Text style={[styles.arrowBadgeText, { color: colors.primary }]}>
              Equivalent Law in {to.act}
            </Text>
          </View>
          <View style={[styles.arrowLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Equivalent Provision (Hero Section) */}
        <View style={[styles.equivalentContainer, { backgroundColor: colors.background, borderColor: colors.primary }]}>
          <View style={styles.rowBetween}>
            <Badge
              label={`${to.act} (Equivalent)`}
              color={colors.primary}
              backgroundColor={colors.primaryLight}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                router.push({
                  pathname: '/bare-act',
                  params: { act: to.act, section: to.section },
                });
              }}
              style={styles.bareActLink}
            >
              <Text style={[styles.bareActLinkText, { color: colors.primary }]}>Open in Bare Act</Text>
              <Ionicons name="arrow-forward-circle" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionNumber, { color: colors.primary, marginTop: Spacing.xs }]}>
            Section {to.section}
          </Text>
          {to.title && (
            <Text style={[styles.sectionTitle, { color: colors.text, fontWeight: '600' }]}>
              {to.title}
            </Text>
          )}

          {/* Substantive Equivalent Provision Information */}
          <View style={[styles.equivalentInfoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.infoLabelRow}>
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={[styles.equivalentInfoTitle, { color: colors.primary }]}>
                Equivalent Provision Information ({to.act} Sec {to.section}):
              </Text>
            </View>
            <Text style={[styles.equivalentInfoText, { color: colors.text }]}>
              {to.text && to.text.trim().length > 0
                ? to.text
                : 'Substantive section information is being synchronized.'}
            </Text>
          </View>
        </View>

        {/* Transition & Comparative Analysis */}
        {item.mapping_notes && item.mapping_notes.trim().length > 0 && (
          <View style={[styles.notesContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.notesHeaderRow}>
              <Ionicons name="information-circle" size={16} color={colors.secondary} />
              <Text style={[styles.notesHeaderLabel, { color: colors.secondary }]}>
                Transition & Comparative Analysis:
              </Text>
            </View>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>
              {item.mapping_notes}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sanhita Converter</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          IPC ↔ BNS · CrPC ↔ BNSS · IEA ↔ BSA
        </Text>
      </View>

      {/* Direction Toggle */}
      <TouchableOpacity
        style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={toggleDirection}
        activeOpacity={0.7}
      >
        <View style={styles.toggleSide}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            {direction === 'old_to_new' ? 'IPC / CrPC / IEA' : 'BNS / BNSS / BSA'}
          </Text>
          <Text style={[styles.toggleSubLabel, { color: colors.textLight }]}>
            {direction === 'old_to_new' ? 'Old Acts' : 'New Sanhitas'}
          </Text>
        </View>
        <View style={[styles.toggleButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="swap-horizontal" size={20} color={colors.textOnPrimary} />
        </View>
        <View style={styles.toggleSide}>
          <Text style={[styles.toggleLabel, { color: colors.text }]}>
            {direction === 'old_to_new' ? 'BNS / BNSS / BSA' : 'IPC / CrPC / IEA'}
          </Text>
          <Text style={[styles.toggleSubLabel, { color: colors.textLight }]}>
            {direction === 'old_to_new' ? 'New Sanhitas' : 'Old Acts'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Law Pair Selector Tabs */}
      <View style={styles.pairSelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pairScroll}>
          {LAW_PAIRS.map((pair) => {
            const isSelected = selectedPair === pair.id;
            return (
              <TouchableOpacity
                key={pair.id}
                onPress={() => setSelectedPair(pair.id)}
                activeOpacity={0.7}
                style={[
                  styles.pairPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pairPillText,
                    { color: isSelected ? colors.textOnPrimary : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {pair.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Input
          placeholder="Search by section number (e.g. 154, 302) or title..."
          value={searchQuery}
          onChangeText={handleSearch}
          icon={<Ionicons name="search-outline" size={20} color={colors.textLight} />}
          rightIcon={
            searchQuery.length > 0 ? (
              <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={colors.textLight} />
              </TouchableOpacity>
            ) : undefined
          }
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Results List */}
      {isLoading || isFetching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Fetching law equivalence...</Text>
        </View>
      ) : (
        <FlatList
          data={mappings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMapping}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            debouncedQuery ? (
              <EmptyState
                icon="search-outline"
                title="No Equivalent Found"
                message={`No statutory mapping found for "${debouncedQuery}" in selected filters.`}
              />
            ) : (
              <EmptyState
                icon="swap-horizontal-outline"
                title="Search Section Mappings"
                message="Enter a section number (e.g. 154 or 302) or tap an equivalent provision in any Bare Act to view comparative information."
              />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  toggleSide: {
    flex: 1,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  toggleSubLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.xs,
  },
  pairSelectorContainer: {
    marginVertical: Spacing.xs,
  },
  pairScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  pairPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pairPillText: {
    fontSize: FontSize.xs,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  mappingCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  mappingSection: {
    gap: Spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sourceTextBox: {
    marginTop: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  boxText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  arrowContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  arrowLine: {
    width: 2,
    height: 10,
    backgroundColor: Colors.border,
  },
  arrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginVertical: 2,
  },
  arrowBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  equivalentContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  bareActLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bareActLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  equivalentInfoBox: {
    marginTop: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  equivalentInfoTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  equivalentInfoText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  notesContainer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  notesText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
});
