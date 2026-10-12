import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BorderRadius, Spacing, FontSize } from '../../constants/theme';
import { FIRStatus } from '../../types';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { colors } = useTheme();

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: 'Draft', color: colors.statusDraft, bg: colors.surfaceAlt },
    submitted: { label: 'Submitted', color: colors.statusSubmitted, bg: colors.infoLight },
    under_review: { label: 'Under Review', color: colors.statusUnderReview, bg: colors.warningLight },
    approved: { label: 'Approved', color: colors.statusApproved, bg: colors.successLight },
    rejected: { label: 'Rejected', color: colors.statusRejected, bg: colors.errorLight },
    finalized: { label: 'Finalized', color: colors.statusFinalized, bg: colors.statusFinalized + '15' },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: Spacing.xs,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
