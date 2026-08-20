import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, useColorScheme as useDeviceColorScheme } from 'react-native';
import { Colors, DarkColors } from '../constants/theme';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: typeof Colors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark', // Defaulting to dark theme as requested
  isDark: true,
  colors: DarkColors,
  toggleTheme: () => {},
});

// SecureStore key
const THEME_STORAGE_KEY = 'ipcai_theme_mode';

let SecureStore: any = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceColorScheme = useDeviceColorScheme();
  const [theme, setTheme] = useState<ThemeMode>('dark'); // Default to dark

  useEffect(() => {
    // Load stored theme preference
    async function loadTheme() {
      try {
        if (Platform.OS === 'web') {
          const stored = localStorage.getItem(THEME_STORAGE_KEY);
          if (stored === 'light' || stored === 'dark') {
            setTheme(stored);
          }
        } else if (SecureStore) {
          const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
          if (stored === 'light' || stored === 'dark') {
            setTheme(stored);
          }
        }
      } catch (err) {
        console.warn('Failed to load theme preference', err);
      }
    }
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } else if (SecureStore) {
        await SecureStore.setItemAsync(THEME_STORAGE_KEY, newTheme);
      }
    } catch (err) {
      console.warn('Failed to save theme preference', err);
    }
  };

  const isDark = theme === 'dark';
  const colors = isDark ? DarkColors : Colors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
