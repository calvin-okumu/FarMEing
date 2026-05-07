import api from '../lib/api';

export function extractValidation(error) {
  return error?.details || [];
}

export function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().split('T')[0];
}

export function toNumber(value, fallback = 0) {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getJson(url, config) {
  const { data } = await api.get(url, config);
  return data;
}

export async function postJson(url, body, config) {
  const { data } = await api.post(url, body, config);
  return data;
}

export async function putJson(url, body, config) {
  const { data } = await api.put(url, body, config);
  return data;
}

export async function patchJson(url, body, config) {
  const { data } = await api.patch(url, body, config);
  return data;
}

export async function deleteJson(url, config) {
  const { data } = await api.delete(url, config);
  return data;
}
