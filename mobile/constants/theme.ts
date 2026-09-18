// IPC.ai Light Theme Design System
export const Colors = {
  primary: '#1A56DB',        // Royal Blue — trust, authority
  primaryLight: '#E1EFFE',   // Light blue background
  primaryDark: '#1E40AF',    // Darker blue for pressed states
  secondary: '#E8590C',      // Saffron — Indian identity
  secondaryLight: '#FFF4E6', // Light saffron background

  background: '#FAFBFC',     // Main background
  surface: '#FFFFFF',        // Cards, modals
  surfaceAlt: '#F3F4F6',     // Alternate surface

  text: '#1F2937',           // Primary text
  textSecondary: '#6B7280',  // Secondary text
  textLight: '#9CA3AF',      // Placeholder, disabled
  textOnPrimary: '#FFFFFF',  // Text on primary bg

  border: '#E5E7EB',         // Default border
  borderLight: '#F3F4F6',    // Subtle border
  divider: '#E5E7EB',        // Dividers

  success: '#059669',        // Green
  successLight: '#D1FAE5',
  warning: '#D97706',        // Amber
  warningLight: '#FEF3C7',
  error: '#DC2626',          // Red
  errorLight: '#FEE2E2',
  info: '#2563EB',           // Blue
  infoLight: '#DBEAFE',

  // Status colors for FIR workflow
  statusDraft: '#6B7280',
  statusSubmitted: '#2563EB',
  statusUnderReview: '#D97706',
  statusApproved: '#059669',
  statusRejected: '#DC2626',
  statusFinalized: '#7C3AED',

  // Tab bar
  tabActive: '#1A56DB',
  tabInactive: '#9CA3AF',
  tabBackground: '#FFFFFF',
};

// IPC.ai Dark Theme Design System (matches Law4u dark aesthetics)
export const DarkColors = {
  primary: '#5C93FC',        // Vibrant blue accent
  primaryLight: '#1E293B',   // Dark blue background for highlights
  primaryDark: '#2563EB',    // Pressed states
  secondary: '#FF8A4D',      // Saffron/orange accent
  secondaryLight: '#2C1D11', // Saffron highlight

  background: '#0F0F11',     // Premium dark mode near-black background
  surface: '#1E1E22',        // Slate/card surface
  surfaceAlt: '#2A2A30',     // Lighter surface

  text: '#F3F4F6',           // Light gray primary text
  textSecondary: '#9CA3AF',  // Gray secondary text
  textLight: '#6B7280',      // Darker gray placeholder/disabled
  textOnPrimary: '#FFFFFF',  // Text on primary bg

  border: '#2E2E34',         // Borders
  borderLight: '#252529',
  divider: '#2E2E34',

  success: '#10B981',
  successLight: '#064E3B',
  warning: '#F59E0B',
  warningLight: '#451A03',
  error: '#EF4444',
  errorLight: '#4C1D1D',
  info: '#3B82F6',
  infoLight: '#1E3A8A',

  // Status colors
  statusDraft: '#9CA3AF',
  statusSubmitted: '#3B82F6',
  statusUnderReview: '#F59E0B',
  statusApproved: '#10B981',
  statusRejected: '#EF4444',
  statusFinalized: '#8B5CF6',

  // Tab bar
  tabActive: '#5C93FC',
  tabInactive: '#6B7280',
  tabBackground: '#1E1E22',
};


export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xxs: 10,
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  title: 34,
};

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
};
