import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

const normalizeHarvest = (values) => ({
  projectId: values.projectId,
  crop: values.crop?.trim(),
  date: toDateOnly(values.date),
  weight: toNumber(values.weight),
  unit: values.unit || 'kg',
  quality: values.quality || null,
  notes: values.notes?.trim() || null,
});

export function listHarvests(projectId) { return getJson(`/harvests/${projectId}`); }
export function createHarvest(values) { return postJson('/harvests', normalizeHarvest(values)); }
export function updateHarvest(id, values) { return putJson(`/harvests/${id}`, normalizeHarvest(values)); }
export function deleteHarvest(id) { return deleteJson(`/harvests/${id}`); }
