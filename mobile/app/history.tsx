import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import api from '../lib/api';
import Header from '../components/ui/Header';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';
import { SearchHistoryItem } from '../types';

const MODULE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  assistant: { icon: 'chatbubble-ellipses', color: Colors.secondary, label: 'AI Assistant' },
  converter: { icon: 'swap-horizontal', color: '#7C3AED', label: 'Converter' },
  judgments: { icon: 'book', color: Colors.primary, label: 'Judgments' },
  fir: { icon: 'document-text', color: Colors.success, label: 'FIR' },
  lawyers: { icon: 'people', color: Colors.warning, label: 'Lawyers' },
};

const getModuleConfig = (module: string) => {
  return MODULE_CONFIG[module] || { icon: 'search' as const, color: Colors.textSecondary, label: module };
};

export default function HistoryScreen() {
  const router = useRouter();

  const { data: history, isLoading, isError, refetch } = useQuery({
    queryKey: ['search-history'],
    queryFn: async () => {
      const res = await api.get('/history');
      return res.data as SearchHistoryItem[];
    },
  });

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Group history items by date
  const groupedHistory = React.useMemo(() => {
    if (!history) return [];

    const groups: { date: string; items: SearchHistoryItem[] }[] = [];
    let currentDate = '';

    // Assumes items are sorted by created_at descending
    for (const item of history) {
      const itemDate = formatDate(item.created_at);
      if (itemDate !== currentDate) {
        currentDate = itemDate;
        groups.push({ date: itemDate, items: [item] });
      } else {
        groups[groups.length - 1].items.push(item);
      }
    }

    return groups;
  }, [history]);

  return (
    <SafeAreaView style={styles.safe}>
      <Header
        title="History"
        subtitle="Your search history"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {isLoading && !history && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading history...</Text>
          </View>
        )}

        {isError && (
          <Card style={styles.errorCard}>
            <Ionicons name="warning-outline" size={24} color={Colors.error} />
            <Text style={styles.errorText}>
              Failed to load history. Pull down to retry.
            </Text>
          </Card>
        )}

        {!isLoading && !isError && (!history || history.length === 0) && (
          <EmptyState
            icon="time-outline"
            title="No History Yet"
            message="Your search and query history will appear here as you use the app."
          />
        )}

        {groupedHistory.map((group) => (
          <View key={group.date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{group.date}</Text>

            <Card style={styles.groupCard}>
              {group.items.map((item, idx) => {
                const config = getModuleConfig(item.module);
                const isLast = idx === group.items.length - 1;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.historyItem,
                      !isLast && styles.historyItemBorder,
                    ]}
                  >
                    <View style={[styles.moduleIcon, { backgroundColor: config.color + '15' }]}>
                      <Ionicons name={config.icon} size={16} color={config.color} />
                    </View>

                    <View style={styles.historyContent}>
                      <View style={styles.historyTopRow}>
                        <Text style={styles.moduleLabel}>{config.label}</Text>
                        <Text style={styles.timeText}>
                          {formatTime(item.created_at)}
                        </Text>
                      </View>
                      <Text style={styles.queryText} numberOfLines={2}>
                        {item.query}
                      </Text>
                      {item.response_summary && (
                        <Text style={styles.summaryText} numberOfLines={1}>
                          {item.response_summary}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
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

  // Date groups
  dateGroup: {
    marginBottom: Spacing.xl,
  },
  dateLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.xs,
  },
  groupCard: {
    padding: 0,
  },

  // History item
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  historyItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  moduleIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  historyContent: {
    flex: 1,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  moduleLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  queryText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
    lineHeight: 20,
  },
  summaryText: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },
});
