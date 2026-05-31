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
    let url = (process.env.EXPO_PUBLIC_API_URL || '').trim();
    if (!url) {
        url = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
    }
    
    // Remove any trailing slashes from the base domain
    url = url.replace(/\/+$/, '');
    
    // Ensure the URL always ends with exactly /api/
    if (!url.endsWith('/api')) {
        url += '/api';
    }
    const finalUrl = url + '/';
    console.log(`[API] Base URL: ${finalUrl}`);
    return finalUrl;
}

export const BASE_URL = getDefaultBaseUrl();

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 20000, // Increased for stability
    headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36'
    },
    withCredentials: false
});

// ── Request interceptor — attach JWT from SecureStore on every request ────────
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // Ensure the URL ends with a trailing slash to avoid Nginx redirects
    if (config.url && !config.url.endsWith('/') && !config.url.includes('?')) {
        config.url += '/';
    }

    const fullUrl = `${config.baseURL}${config.url}`.replace(/([^:]\/)\/+/g, "$1");
    console.log(`[API Request] ${config.method.toUpperCase()} ${fullUrl}`);
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
            error.message === 'Network Error' ||
            error.message.includes('Network request failed') ||
            error.code === 'ERR_NETWORK'
        );

        if (isNetworkError) {
            const detail = error.code ? ` (${error.code})` : '';
            const configUrl = error.config ? `${error.config.baseURL}${error.config.url}` : BASE_URL;
            const wrappedError = new Error(
                `Cannot reach backend at ${configUrl}${detail}. ${error.message}`
            );
            wrappedError.isBackendUnavailable = true;
            wrappedError.statusCode = null;
            useBackendStore.getState().setOffline(wrappedError.message);
            console.error(`[API Error Detail] URL: ${configUrl} | Code: ${error.code} | Msg: ${error.message}`);
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
        console.error(`[API Error] ${statusCode} ${message}`, error.response?.data);
        return Promise.reject(wrappedError);
    }
);

export default api;
