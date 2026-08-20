import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Spacing, FontSize } from '../../constants/theme';
import { FIRStatus } from '../../types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: Colors.statusDraft, bg: Colors.surfaceAlt },
  submitted: { label: 'Submitted', color: Colors.statusSubmitted, bg: Colors.infoLight },
  under_review: { label: 'Under Review', color: Colors.statusUnderReview, bg: Colors.warningLight },
  approved: { label: 'Approved', color: Colors.statusApproved, bg: Colors.successLight },
  rejected: { label: 'Rejected', color: Colors.statusRejected, bg: Colors.errorLight },
  finalized: { label: 'Finalized', color: Colors.statusFinalized, bg: '#F3E8FF' },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

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
