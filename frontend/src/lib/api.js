import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Base URL ──────────────────────────────────────────────────────────────────
// For Expo Go on a physical device, replace with your machine's LAN IP:
//   e.g. http://192.168.1.100:3000
// For Android emulator use: http://10.0.2.2:3000
// For iOS simulator use:    http://localhost:3000
export const BASE_URL = 'http://192.168.0.171:3000';

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
        const message =
            error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            'Something went wrong';
        return Promise.reject(new Error(message));
    }
);

export default api;
