import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ── Base URL ──────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL for your environment.
// Android emulator: http://10.0.2.2:3000
// iOS simulator:    http://localhost:3000
// Physical device:  http://<your-lan-ip>:3000
function getDefaultBaseUrl() {
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
}

export const BASE_URL = getDefaultBaseUrl();

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach JWT from SecureStore on every request ────────
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response interceptor — normalise error messages ───────────────────────────
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const isNetworkError = !error.response && (
            error.code === 'ECONNABORTED' ||
            error.message === 'Network Error'
        );

        if (isNetworkError) {
            return Promise.reject(new Error(
                `Cannot reach backend at ${BASE_URL}. Set EXPO_PUBLIC_API_URL for your device/emulator.`
            ));
        }

        const message =
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            'Something went wrong';
        return Promise.reject(new Error(message));
    }
);

export default api;
