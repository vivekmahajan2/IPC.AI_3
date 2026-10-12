import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius, Spacing, FontSize } from '../../constants/theme';

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Badge({
  label,
  color = Colors.primary,
  backgroundColor = Colors.primaryLight,
  size = 'sm',
  style,
}: BadgeProps) {
  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.sizeMd,
        { backgroundColor },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'md' && styles.textMd,
          { color },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  sizeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  textMd: {
    fontSize: FontSize.sm,
  },
});
