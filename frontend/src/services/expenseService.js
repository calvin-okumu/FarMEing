import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

const normalizeExpense = (values) => ({
  projectId: values.projectId,
  category: values.category,
  amount: toNumber(values.amount),
  date: toDateOnly(values.date),
  note: values.note?.trim() || null,
  receiptUrl: values.receiptUrl || null,
});

export function listExpenses(projectId) { return getJson(`/expenses/${projectId}`); }
export function createExpense(values) { return postJson('/expenses', normalizeExpense(values)); }
export function updateExpense(id, values) { return putJson(`/expenses/${id}`, normalizeExpense(values)); }
export function deleteExpense(id) { return deleteJson(`/expenses/${id}`); }
