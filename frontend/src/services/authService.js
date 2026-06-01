import { getJson, postJson, patchJson } from './http';

function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';

  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

export function registerUser(payload) {
  return postJson('auth/register', {
    ...payload,
    phone: normalizePhone(payload?.phone),
  });
}

export function loginUser(payload) {
  return postJson('auth/login', {
    ...payload,
    phone: normalizePhone(payload?.phone),
  });
}

export function getCurrentUser() {
  return getJson('me');
}

export function updateProfile(payload) {
  return patchJson('me', payload);
}
