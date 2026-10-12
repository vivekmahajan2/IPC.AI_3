import { Platform } from 'react-native';

// expo-secure-store only works on native (iOS/Android).
// On web, we fall back to localStorage.
let SecureStore: any = null;

if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const ACCESS_TOKEN_KEY = 'ipcai_access_token';
const REFRESH_TOKEN_KEY = 'ipcai_refresh_token';
const USER_KEY = 'ipcai_user';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const auth = {
  async getAccessToken(): Promise<string | null> {
    return await getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return await getItem(REFRESH_TOKEN_KEY);
  },

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await setItem(ACCESS_TOKEN_KEY, accessToken);
    await setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  async getUser(): Promise<any | null> {
    const json = await getItem(USER_KEY);
    return json ? JSON.parse(json) : null;
  },

  async setUser(user: any): Promise<void> {
    await setItem(USER_KEY, JSON.stringify(user));
  },

  async clearAll(): Promise<void> {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(USER_KEY);
  },
};

export const storage = {
  getItem,
  setItem,
  deleteItem,
};

