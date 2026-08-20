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
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import api from '../../lib/api';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { SectionMapping } from '../../types';

type Direction = 'old_to_new' | 'new_to_old';

export default function ConverterScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [direction, setDirection] = useState<Direction>('old_to_new');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = React.useRef<NodeJS.Timeout>();

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 400);
  };

  const { data: mappings, isLoading } = useQuery({
    queryKey: ['mappings', debouncedQuery, direction],
    queryFn: async () => {
      if (!debouncedQuery) return [];
      const res = await api.get('/compare', {
        params: { q: debouncedQuery, direction },
      });
      return res.data as SectionMapping[];
    },
    enabled: debouncedQuery.length > 0,
  });

  const toggleDirection = () => {
    setDirection((d) => (d === 'old_to_new' ? 'new_to_old' : 'old_to_new'));
  };

  const oldLabel = direction === 'old_to_new' ? 'Old Law' : 'New Law';
  const newLabel = direction === 'old_to_new' ? 'New Law' : 'Old Law';

  const renderMapping = ({ item }: { item: SectionMapping }) => {
    const from = direction === 'old_to_new'
      ? { act: item.old_act, section: item.old_section, title: item.old_title }
      : { act: item.new_act, section: item.new_section, title: item.new_title };
    const to = direction === 'old_to_new'
      ? { act: item.new_act, section: item.new_section, title: item.new_title }
      : { act: item.old_act, section: item.old_section, title: item.old_title };

    return (
      <Card style={styles.mappingCard}>
        {/* From */}
        <View style={styles.mappingSection}>
          <Badge
            label={from.act}
            color={Colors.secondary}
            backgroundColor={Colors.secondaryLight}
          />
          <Text style={styles.sectionNumber}>Section {from.section}</Text>
          {from.title && <Text style={styles.sectionTitle}>{from.title}</Text>}
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <View style={styles.arrowLine} />
          <Ionicons name="arrow-down" size={18} color={Colors.primary} />
          <View style={styles.arrowLine} />
        </View>

        {/* To */}
        <View style={styles.mappingSection}>
          <Badge
            label={to.act}
            color={Colors.primary}
            backgroundColor={Colors.primaryLight}
          />
          <Text style={styles.sectionNumber}>Section {to.section}</Text>
          {to.title && <Text style={styles.sectionTitle}>{to.title}</Text>}
        </View>

        {/* Notes */}
        {item.mapping_notes && (
          <View style={styles.notesContainer}>
            <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.notesText}>{item.mapping_notes}</Text>
          </View>
        )}

        {item.is_identical && (
          <Badge label="Identical" color={Colors.success} backgroundColor={Colors.successLight} style={styles.identicalBadge} />
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sanhita Converter</Text>
        <Text style={styles.headerSubtitle}>IPC ↔ BNS · CrPC ↔ BNSS · IEA ↔ BSA</Text>
      </View>

      {/* Direction Toggle */}
      <TouchableOpacity style={styles.toggleContainer} onPress={toggleDirection} activeOpacity={0.7}>
        <View style={styles.toggleSide}>
          <Text style={styles.toggleLabel}>
            {direction === 'old_to_new' ? 'IPC / CrPC / IEA' : 'BNS / BNSS / BSA'}
          </Text>
        </View>
        <View style={styles.toggleButton}>
          <Ionicons name="swap-horizontal" size={20} color={Colors.textOnPrimary} />
        </View>
        <View style={styles.toggleSide}>
          <Text style={styles.toggleLabel}>
            {direction === 'old_to_new' ? 'BNS / BNSS / BSA' : 'IPC / CrPC / IEA'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by section number or keyword..."
          value={searchQuery}
          onChangeText={handleSearch}
          icon={<Ionicons name="search-outline" size={20} color={Colors.textLight} />}
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={mappings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMapping}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            debouncedQuery ? (
              <EmptyState
                icon="search-outline"
                title="No Results"
                message={`No mappings found for "${debouncedQuery}"`}
              />
            ) : (
              <EmptyState
                icon="swap-horizontal-outline"
                title="Search Sections"
                message="Enter a section number (e.g. 302) or keyword (e.g. murder) to find the equivalent in the new law"
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

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  toggleSide: {
    flex: 1,
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  toggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.sm,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mapping card
  mappingCard: {
    marginBottom: Spacing.md,
  },
  mappingSection: {
    gap: Spacing.xs,
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
  arrowContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  arrowLine: {
    width: 1,
    height: 8,
    backgroundColor: Colors.border,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  notesText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  identicalBadge: {
    marginTop: Spacing.sm,
  },
});
