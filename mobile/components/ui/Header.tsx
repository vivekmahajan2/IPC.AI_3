<<<<<<< HEAD
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, Shadow, BorderRadius } from '../../constants/theme';
=======
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Spacing, FontSize, Shadow } from '../../constants/theme';
>>>>>>> eb40714a35edb46ec36b4f02cd5aa214cae0f975
import { Ionicons } from '@expo/vector-icons';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export default function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  style,
}: HeaderProps) {
  const { colors } = useTheme();
<<<<<<< HEAD
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  useEffect(() => {
    if (!showBack) return;
    const onHardwareBack = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [showBack, onBack]);
=======
>>>>>>> eb40714a35edb46ec36b4f02cd5aa214cae0f975

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }, style]}>
      <View style={styles.leftSection}>
        {showBack && (
<<<<<<< HEAD
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>}
=======
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
>>>>>>> eb40714a35edb46ec36b4f02cd5aa214cae0f975
        </View>
      </View>
      {rightAction && <View style={styles.rightSection}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
<<<<<<< HEAD
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 56,
=======
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingTop: Spacing.lg,
>>>>>>> eb40714a35edb46ec36b4f02cd5aa214cae0f975
    ...Shadow.sm,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
<<<<<<< HEAD
    marginRight: Spacing.sm,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.xs,
=======
    marginRight: Spacing.md,
    padding: Spacing.xs,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: FontSize.sm,
>>>>>>> eb40714a35edb46ec36b4f02cd5aa214cae0f975
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

