import api from '../lib/api';

export function extractValidation(error) {
  return error?.details || [];
}

export function formatErrorMessage(error) {
  if (!error) return 'An unknown error occurred';
  
  let message = error.message || 'Something went wrong';
  const statusCode = error.statusCode;
  
  // Try to extract more specific info from details
  if (error.details) {
    if (Array.isArray(error.details) && error.details.length > 0) {
      const details = error.details.map((d) => {
        if (typeof d === 'string') return d;
        return d.message || d.msg || JSON.stringify(d);
      }).join(', ');
      message = `${message}: ${details}`;
    } else if (typeof error.details === 'object' && Object.keys(error.details).length > 0) {
      // Handle object details (e.g., { field: 'error message' })
      const details = Object.entries(error.details)
        .map(([key, val]) => `${key}: ${val}`)
        .join(', ');
      message = `${message} (${details})`;
    }
  }

  return statusCode ? `[${statusCode}] ${message}` : message;
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
