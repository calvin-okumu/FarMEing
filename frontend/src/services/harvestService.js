import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

const compact = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const normalizeHarvest = (values) => compact({
  projectId: values.projectId,
  crop: values.crop?.trim(),
  date: values.date !== undefined ? toDateOnly(values.date) : undefined,
  weight: values.weight !== undefined ? toNumber(values.weight) : undefined,
  unit: values.unit !== undefined ? values.unit || 'kg' : undefined,
  quality: values.quality !== undefined ? values.quality || null : undefined,
  notes: values.notes !== undefined ? values.notes?.trim() || null : undefined,
});

export function listHarvests(projectId) { return getJson(`/harvests/${projectId}`); }
export function createHarvest(values) { return postJson('/harvests', normalizeHarvest(values)); }
export function updateHarvest(id, values) { return putJson(`/harvests/${id}`, normalizeHarvest(values)); }
export function deleteHarvest(id) { return deleteJson(`/harvests/${id}`); }
