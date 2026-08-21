import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import Header from '../components/ui/Header';
import Card from '../components/ui/Card';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../constants/theme';

interface InfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  color?: string;
  textColor?: string;
  labelColor?: string;
}

function InfoRow({ icon, label, value, color = Colors.primary, textColor, labelColor }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
        <Text style={[styles.infoValue, textColor ? { color: textColor } : null]}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'police':
        return { label: 'Police Officer', color: colors.primary, icon: 'shield-checkmark' as const };
      case 'superior':
        return { label: 'Superior Officer', color: colors.secondary, icon: 'star' as const };
      case 'student':
        return { label: 'Law Student', color: '#7C3AED', icon: 'school' as const };
      case 'admin':
        return { label: 'Administrator', color: colors.error, icon: 'settings' as const };
      default:
        return { label: 'User', color: colors.textSecondary, icon: 'person' as const };
    }
  };

  const roleBadge = getRoleBadge(user?.role);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header
        title="Profile"
        showBack
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(user?.full_name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.full_name || 'User'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleBadge.color + '15' }]}>
            <Ionicons name={roleBadge.icon} size={14} color={roleBadge.color} />
            <Text style={[styles.roleText, { color: roleBadge.color }]}>
              {roleBadge.label}
            </Text>
          </View>
        </View>

        {/* Account Information */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
        <Card style={styles.infoCard}>
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={user?.email}
            color={colors.primary}
            textColor={colors.text}
            labelColor={colors.textSecondary}
          />
          <InfoRow
            icon="call-outline"
            label="Phone"
            value={user?.phone}
            color={colors.success}
            textColor={colors.text}
            labelColor={colors.textSecondary}
          />
          {user?.verified !== undefined && (
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: (user.verified ? colors.success : colors.warning) + '15' }]}>
                <Ionicons
                  name={user.verified ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={user.verified ? colors.success : colors.warning}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Verification Status</Text>
                <Text style={[styles.infoValue, { color: user.verified ? colors.success : colors.warning }]}>
                  {user.verified ? 'Verified' : 'Pending Verification'}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Official Details (for police/superior roles) */}
        {(user?.badge_number || user?.station) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Official Details</Text>
            <Card style={styles.infoCard}>
              <InfoRow
                icon="id-card-outline"
                label="Badge Number"
                value={user?.badge_number}
                color={colors.secondary}
                textColor={colors.text}
                labelColor={colors.textSecondary}
              />
              <InfoRow
                icon="location-outline"
                label="Station"
                value={user?.station}
                color="#7C3AED"
                textColor={colors.text}
                labelColor={colors.textSecondary}
              />
            </Card>
          </>
        )}

        {/* Member since */}
        {user?.created_at && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Membership</Text>
            <Card style={styles.infoCard}>
              <InfoRow
                icon="calendar-outline"
                label="Member Since"
                value={formatDate(user.created_at)}
                color={colors.info}
                textColor={colors.text}
                labelColor={colors.textSecondary}
              />
            </Card>
          </>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.errorLight }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>IPC.ai v1.0.0</Text>
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

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  avatarText: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.primary,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Sections
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingLeft: Spacing.xs,
  },

  // Info card
  infoCard: {
    padding: 0,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '500',
    color: Colors.text,
  },

  // Actions
  actionsSection: {
    marginTop: Spacing.xxl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },

  // Version
  version: {
    fontSize: FontSize.sm,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
