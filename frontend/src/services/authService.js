import { getJson, postJson } from './http';

export function registerUser(payload) {
  return postJson('/auth/register', payload);
}

export function loginUser(payload) {
  return postJson('/auth/login', payload);
}

export function getCurrentUser() {
  return getJson('/api/me');
}
