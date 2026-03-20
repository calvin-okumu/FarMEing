import { deleteJson, getJson, postJson, putJson, toNumber } from './http';

const normalizeBudget = (values) => ({
  projectId: values.projectId,
  category: values.category,
  name: values.name?.trim(),
  quantity: toNumber(values.quantity),
  unit: values.unit?.trim() || '',
  unitPrice: toNumber(values.unitPrice),
  notes: values.notes?.trim() || null,
});

export function listBudgetItems(projectId) { return getJson(`/budget/${projectId}`); }
export function createBudgetItem(values) { return postJson('/budget', normalizeBudget(values)); }
export function updateBudgetItem(id, values) { return putJson(`/budget/${id}`, normalizeBudget(values)); }
export function deleteBudgetItem(id) { return deleteJson(`/budget/${id}`); }
