import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import api from '../../lib/api';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';
import { FIRDraft } from '../../types';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { fullSync, isSyncing, mappingsCached, downloadMappings } = useOfflineSync();

  // Trigger offline sync on mount
  useEffect(() => {
    fullSync().catch(console.warn);
    // Download mappings for offline use if not cached yet
    if (!mappingsCached) {
      downloadMappings().catch(console.warn);
    }
  }, []);

  const { data: firs, isLoading, refetch } = useQuery({
    queryKey: ['firs-recent'],
    queryFn: async () => {
      const res = await api.get('/fir?limit=5');
      return res.data as FIRDraft[];
    },
  });

  const stats = React.useMemo(() => {
    if (!firs) return { total: 0, drafts: 0, submitted: 0, approved: 0 };
    return {
      total: firs.length,
      drafts: firs.filter((f) => f.status === 'draft').length,
      submitted: firs.filter((f) => ['submitted', 'under_review'].includes(f.status)).length,
      approved: firs.filter((f) => ['approved', 'finalized'].includes(f.status)).length,
    };
  }, [firs]);

  const quickActions = [
    { icon: 'add-circle' as const, label: 'New FIR', color: Colors.primary, route: '/(tabs)/fir/new' },
    { icon: 'chatbubble-ellipses' as const, label: 'Ask AI', color: Colors.secondary, route: '/(tabs)/assistant' },
    { icon: 'swap-horizontal' as const, label: 'Converter', color: '#7C3AED', route: '/(tabs)/converter' },
    { icon: 'search' as const, label: 'Judgments', color: Colors.success, route: '/judgments' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.full_name || 'Officer'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person-circle" size={40} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: Colors.primaryLight }]}>
            <Text style={[styles.statNumber, { color: Colors.primary }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total FIRs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.statNumber, { color: Colors.warning }]}>{stats.drafts}</Text>
            <Text style={styles.statLabel}>Drafts</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.infoLight }]}>
            <Text style={[styles.statNumber, { color: Colors.info }]}>{stats.submitted}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent FIRs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent FIRs</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/fir')}>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {firs && firs.length > 0 ? (
          firs.slice(0, 3).map((fir) => (
            <TouchableOpacity
              key={fir.id}
              onPress={() => router.push(`/(tabs)/fir/${fir.id}` as any)}
              activeOpacity={0.7}
            >
              <Card style={styles.firCard}>
                <View style={styles.firHeader}>
                  <Text style={styles.firTitle} numberOfLines={1}>
                    {fir.title}
                  </Text>
                  <StatusBadge status={fir.status} />
                </View>
                <Text style={styles.firDate}>
                  {new Date(fir.updated_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={32} color={Colors.textLight} />
            <Text style={styles.emptyText}>No FIRs yet. Create your first one!</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  greeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  profileButton: {
    padding: Spacing.xs,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Quick Actions
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadow.sm,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  viewAll: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },

  // FIR cards
  firCard: {
    marginBottom: Spacing.sm,
  },
  firHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  firTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  firDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});
