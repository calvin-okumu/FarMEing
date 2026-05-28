import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import useBackendStore from '../store/useBackendStore';

// ── Base URL ──────────────────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL for your environment.
// Use an https:// URL for tunneled or production deployments.
// The local defaults below are only meant for emulator and simulator development.
// Android emulator: http://10.0.2.2:3000
// iOS simulator:    http://localhost:3000
// Physical device:  http://<your-lan-ip>:3000
function getDefaultBaseUrl() {
    let url = process.env.EXPO_PUBLIC_API_URL;
    if (!url) {
        url = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
    }
    
    // Remove any trailing slashes from the base domain
    url = url.replace(/\/+$/, '');
    
    // Ensure the URL always ends with exactly /api/
    if (!url.endsWith('/api')) {
        url += '/api';
    }
    return url + '/';
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
    (response) => {
        useBackendStore.getState().setOnline();
        return response;
    },
    (error) => {
        const isNetworkError = !error.response && (
            error.code === 'ECONNABORTED' ||
            error.message === 'Network Error'
        );

        if (isNetworkError) {
            const wrappedError = new Error(
                `Cannot reach backend at ${BASE_URL}. Set EXPO_PUBLIC_API_URL for your device/emulator.`
            );
            wrappedError.isBackendUnavailable = true;
            wrappedError.statusCode = null;
            useBackendStore.getState().setOffline(wrappedError.message);
            return Promise.reject(wrappedError);
        }

        const statusCode = error.response?.status ?? null;
        const message =
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            'Something went wrong';
        const wrappedError = new Error(message);
        wrappedError.statusCode = statusCode;
        wrappedError.details = error.response?.data?.details || [];
        wrappedError.isBackendUnavailable = false;
        return Promise.reject(wrappedError);
    }
);

export default api;
