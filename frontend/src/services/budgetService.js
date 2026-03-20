import { deleteJson, getJson, postJson, putJson, toNumber } from './http';

const compact = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const normalizeBudget = (values) => compact({
  projectId: values.projectId,
  category: values.category,
  name: values.name?.trim(),
  quantity: values.quantity !== undefined ? toNumber(values.quantity) : undefined,
  unit: values.unit !== undefined ? values.unit?.trim() || '' : undefined,
  unitPrice: values.unitPrice !== undefined ? toNumber(values.unitPrice) : undefined,
  notes: values.notes !== undefined ? values.notes?.trim() || null : undefined,
});

export function listBudgetItems(projectId) { return getJson(`/budget/${projectId}`); }
export function createBudgetItem(values) { return postJson('/budget', normalizeBudget(values)); }
export function updateBudgetItem(id, values) { return putJson(`/budget/${id}`, normalizeBudget(values)); }
export function deleteBudgetItem(id) { return deleteJson(`/budget/${id}`); }
