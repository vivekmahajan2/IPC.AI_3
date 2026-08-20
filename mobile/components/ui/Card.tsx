import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BorderRadius, Shadow, Spacing } from '../../constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: keyof typeof Spacing;
}

export default function Card({ children, style, variant = 'default', padding = 'lg' }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.surface },
        variant === 'outlined' && [styles.outlined, { borderColor: colors.border }],
        variant === 'elevated' && styles.elevated,
        { padding: Spacing[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    ...Shadow.sm,
  },
  outlined: {
    ...Shadow.sm,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
  },
  elevated: {
    ...Shadow.md,
  },
});

