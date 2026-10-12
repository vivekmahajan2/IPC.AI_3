import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../constants/theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

type RoleOption = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const ROLES: RoleOption[] = [
  { key: 'public', label: 'Citizen', icon: 'person-outline', description: 'Public citizen' },
  { key: 'lawyer', label: 'Advocate', icon: 'briefcase-outline', description: 'Practicing lawyer' },
  { key: 'student', label: 'Student', icon: 'school-outline', description: 'Law student' },
  { key: 'police', label: 'Police', icon: 'shield-outline', description: 'Police officer' },
];

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('public');
  const [phone, setPhone] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [station, setStation] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (isRegisterMode) {
      if (!fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (role === 'police') {
        if (!badgeNumber.trim()) newErrors.badgeNumber = 'Badge number is required for police';
        if (!station.trim()) newErrors.station = 'Police station name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuthAction = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isRegisterMode) {
        await register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
          phone: phone.trim() || undefined,
          badge_number: role === 'police' ? badgeNumber.trim() : undefined,
          station: role === 'police' ? station.trim() : undefined,
        });
        Alert.alert('Registration Successful', 'Welcome to IPC.ai! Your account has been created.');
      } else {
        await login(email.trim(), password);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        (isRegisterMode
          ? 'Registration failed. Please check your details and try again.'
          : 'Login failed. Check your credentials and try again.');
      Alert.alert(isRegisterMode ? 'Registration Failed' : 'Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setErrors({});
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>IPC.ai</Text>
            <Text style={styles.tagline}>AI-Powered Legal Assistant</Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Mode Selector Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, !isRegisterMode && styles.activeTabButton]}
                onPress={() => { setIsRegisterMode(false); setErrors({}); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, !isRegisterMode && styles.activeTabText]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, isRegisterMode && styles.activeTabButton]}
                onPress={() => { setIsRegisterMode(true); setErrors({}); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isRegisterMode && styles.activeTabText]}>
                  New Registration
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formTitle}>
              {isRegisterMode ? 'Create Account' : 'Sign In'}
            </Text>
            <Text style={styles.formSubtitle}>
              {isRegisterMode
                ? 'Register to access Bare Acts, FIR drafts & Sanhita Converter'
                : 'Enter your credentials to continue'}
            </Text>

            {/* Registration Specific Fields */}
            {isRegisterMode && (
              <>
                <Input
                  label="Full Name"
                  placeholder="e.g. Adv. Rajesh Sharma"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  error={errors.fullName}
                  icon={<Ionicons name="person-outline" size={20} color={Colors.textLight} />}
                />

                {/* Role Selection */}
                <Text style={styles.inputGroupLabel}>Select Your Role</Text>
                <View style={styles.roleGrid}>
                  {ROLES.map((r) => {
                    const isSelected = role === r.key;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        style={[styles.roleCard, isSelected && styles.activeRoleCard]}
                        onPress={() => setRole(r.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={r.icon}
                          size={18}
                          color={isSelected ? Colors.primary : Colors.textSecondary}
                        />
                        <Text style={[styles.roleLabel, isSelected && styles.activeRoleLabel]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {role === 'police' && (
                  <>
                    <Input
                      label="Badge Number"
                      placeholder="e.g. MH-POL-10842"
                      value={badgeNumber}
                      onChangeText={setBadgeNumber}
                      autoCapitalize="characters"
                      error={errors.badgeNumber}
                      icon={<Ionicons name="id-card-outline" size={20} color={Colors.textLight} />}
                    />
                    <Input
                      label="Police Station"
                      placeholder="e.g. Central City Police Station"
                      value={station}
                      onChangeText={setStation}
                      error={errors.station}
                      icon={<Ionicons name="business-outline" size={20} color={Colors.textLight} />}
                    />
                  </>
                )}

                <Input
                  label="Phone Number (Optional)"
                  placeholder="+91 9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  icon={<Ionicons name="call-outline" size={20} color={Colors.textLight} />}
                />
              </>
            )}

            {/* Email Field */}
            <Input
              label="Email"
              placeholder={isRegisterMode ? "your.email@domain.com" : "officer@police.gov.in"}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              icon={<Ionicons name="mail-outline" size={20} color={Colors.textLight} />}
            />

            {/* Password Field */}
            <Input
              label="Password"
              placeholder={isRegisterMode ? "Create a strong password (min 6 chars)" : "Enter your password"}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              error={errors.password}
              icon={<Ionicons name="lock-closed-outline" size={20} color={Colors.textLight} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textLight}
                  />
                </TouchableOpacity>
              }
            />

            {/* Confirm Password for Registration */}
            {isRegisterMode && (
              <Input
                label="Confirm Password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                error={errors.confirmPassword}
                icon={<Ionicons name="checkmark-circle-outline" size={20} color={Colors.textLight} />}
              />
            )}

            {/* Submit Button */}
            <Button
              title={
                loading
                  ? (isRegisterMode ? 'Registering Account...' : 'Signing in...')
                  : (isRegisterMode ? 'Register & Sign In' : 'Sign In')
              }
              onPress={handleAuthAction}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submitButton}
            />

            {/* Toggle Mode Link */}
            <TouchableOpacity onPress={toggleMode} style={styles.toggleModeButton} activeOpacity={0.7}>
              <Text style={styles.toggleModeText}>
                {isRegisterMode ? (
                  <>Already have an account? <Text style={styles.toggleModeHighlight}>Sign In</Text></>
                ) : (
                  <>Don't have an account? <Text style={styles.toggleModeHighlight}>Register here</Text></>
                )}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by Indian Legal AI</Text>
            <Text style={styles.versionText}>v1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },

  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // Form Card
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadow.md,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  activeTabButton: {
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  tabText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '700',
  },
  formTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  formSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  inputGroupLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  roleCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  activeRoleCard: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  roleLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  activeRoleLabel: {
    color: Colors.primary,
    fontWeight: '700',
  },
  submitButton: {
    marginTop: Spacing.sm,
  },
  toggleModeButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  toggleModeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  toggleModeHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  versionText: {
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 2,
  },
});
