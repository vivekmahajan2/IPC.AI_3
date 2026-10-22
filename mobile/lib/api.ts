import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from './auth';

const getBaseUrl = (): string => {
  // Explicit deployment API URL takes first priority
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // When running on Web in a deployed browser (e.g. *.vercel.app or custom domains)
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !host.startsWith('192.168.') && !host.startsWith('10.')) {
      return 'https://ipc-ai-backend-j9fp.onrender.com';
    }
  }

  // In production builds (web export, standalone APK/AAB), default to live Render backend
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return 'https://ipc-ai-backend-j9fp.onrender.com';
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:8000';
  }
  
  // Dynamically resolve machine's LAN IP for Expo Go on physical devices
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.packagerOpts?.host || '';
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8000`;
  }

  // Fallback for Android emulator
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  
  return 'https://ipc-ai-backend-j9fp.onrender.com';
};

const BASE_URL = getBaseUrl();

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60s to accommodate Render free-tier cold boot
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await auth.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 (token refresh)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await auth.getRefreshToken();
        if (!refreshToken) {
          await auth.clearAll();
          return Promise.reject(error);
        }

        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token: newRefresh } = response.data;
        await auth.setTokens(access_token, newRefresh);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        await auth.clearAll();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
