import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

const normalizeSale = (values) => {
  const weightSold = toNumber(values.weightSold);
  const unitPrice = toNumber(values.unitPrice);
  return {
    projectId: values.projectId,
    date: toDateOnly(values.date),
    customer: values.customer?.trim() || null,
    weightSold,
    unitPrice,
    totalAmount: parseFloat((weightSold * unitPrice).toFixed(2)),
    notes: values.notes?.trim() || null,
  };
};

export function listSales(projectId) { return getJson(`/sales/${projectId}`); }
export function createSale(values) { return postJson('/sales', normalizeSale(values)); }
export function updateSale(id, values) { return putJson(`/sales/${id}`, normalizeSale(values)); }
export function deleteSale(id) { return deleteJson(`/sales/${id}`); }
