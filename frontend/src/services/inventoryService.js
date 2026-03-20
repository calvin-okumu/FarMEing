import { deleteJson, getJson, postJson, putJson, toNumber } from './http';

const normalizeInventory = (values) => ({
  projectId: values.projectId,
  name: values.name?.trim(),
  category: values.category?.trim(),
  quantity: toNumber(values.quantity),
  unit: values.unit?.trim() || '',
  unitCost: toNumber(values.unitCost),
  usedQty: toNumber(values.usedQty),
  notes: values.notes?.trim() || null,
});

export function listInventory(projectId) { return getJson(`/inventory/${projectId}`); }
export function createInventoryItem(values) { return postJson('/inventory', normalizeInventory(values)); }
export function updateInventoryItem(id, values) { return putJson(`/inventory/${id}`, normalizeInventory(values)); }
export function deleteInventoryItem(id) { return deleteJson(`/inventory/${id}`); }
