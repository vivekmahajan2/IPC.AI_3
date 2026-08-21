import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import api from '../../../lib/api';
import Card from '../../../components/ui/Card';
import StatusBadge from '../../../components/ui/StatusBadge';
import EmptyState from '../../../components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import { useTheme } from '../../../context/ThemeContext';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import { FIRDraft } from '../../../types';

const STATUS_FILTERS = ['all', 'draft', 'submitted', 'under_review', 'approved', 'rejected', 'finalized'];

export default function FIRListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const { data: firs, isLoading, refetch } = useQuery({
    queryKey: ['firs', selectedFilter],
    queryFn: async () => {
      const params = selectedFilter !== 'all' ? `?status=${selectedFilter}` : '';
      const res = await api.get(`/fir${params}`);
      return res.data as FIRDraft[];
    },
  });

  const renderFIRItem = ({ item }: { item: FIRDraft }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/fir/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <Card style={[styles.firCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.firTop}>
          <View style={styles.firInfo}>
            <Text style={[styles.firTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            {item.fir_number && (
              <Text style={[styles.firNumber, { color: colors.textSecondary }]}>{item.fir_number}</Text>
            )}
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.firDetails}>
          {item.incident_details?.incident_place && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.incident_details.incident_place}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {new Date(item.updated_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {item.sections_applied && item.sections_applied.length > 0 && (
          <View style={styles.sectionsRow}>
            {item.sections_applied.slice(0, 3).map((s, i) => (
              <View key={i} style={[styles.sectionChip, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.sectionText, { color: colors.primary }]}>{s}</Text>
              </View>
            ))}
            {item.sections_applied.length > 3 && (
              <Text style={[styles.moreSections, { color: colors.textLight }]}>+{item.sections_applied.length - 3}</Text>
            )}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>FIR Drafts</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/fir/new')}
        >
          <Ionicons name="add" size={24} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={[styles.filterRow, { alignItems: 'center' }]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedFilter === item && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedFilter(item)}
          >
            <Text
              style={[
                styles.filterText,
                { color: colors.textSecondary },
                selectedFilter === item && { color: colors.textOnPrimary, fontWeight: '700' },
              ]}
            >
              {item === 'all' ? 'All' : item.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* FIR List */}
      <FlatList
        data={firs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFIRItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="document-text-outline"
              title="No FIRs Found"
              message={selectedFilter !== 'all'
                ? `No FIRs with status "${selectedFilter.replace('_', ' ')}"`
                : 'Create your first FIR to get started'}
              action={
                <Button
                  title="Create New FIR"
                  onPress={() => router.push('/(tabs)/fir/new')}
                  icon={<Ionicons name="add" size={18} color={colors.textOnPrimary} />}
                />
              }
            />
          ) : null
        }
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filters
  filterRow: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: Colors.textOnPrimary,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // FIR Card
  firCard: {
    marginBottom: Spacing.md,
  },
  firTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  firInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  firTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  firNumber: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  firDetails: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  sectionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  sectionChip: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  sectionText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '500',
  },
  moreSections: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    alignSelf: 'center',
  },
});
