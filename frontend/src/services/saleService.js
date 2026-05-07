import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

const compact = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const normalizeSale = (values) => {
  const weightSold = toNumber(values.weightSold);
  const unitPrice = toNumber(values.unitPrice);
  return compact({
    projectId: values.projectId,
    date: values.date !== undefined ? toDateOnly(values.date) : undefined,
    customer: values.customer !== undefined ? values.customer?.trim() || null : undefined,
    weightSold: values.weightSold !== undefined ? weightSold : undefined,
    unitPrice: values.unitPrice !== undefined ? unitPrice : undefined,
    totalAmount: values.weightSold !== undefined || values.unitPrice !== undefined ? parseFloat((weightSold * unitPrice).toFixed(2)) : undefined,
    notes: values.notes !== undefined ? values.notes?.trim() || null : undefined,
  });
};

export function listSales(projectId) { return getJson(`/sales/${projectId}`); }
export function createSale(values) { return postJson('/sales', normalizeSale(values)); }
export function updateSale(id, values) { return putJson(`/sales/${id}`, normalizeSale(values)); }
export function deleteSale(id) { return deleteJson(`/sales/${id}`); }
