import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

const compact = (payload) => Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));

const normalizeExpense = (values) => compact({
  projectId: values.projectId,
  category: values.category,
  amount: values.amount !== undefined ? toNumber(values.amount) : undefined,
  date: values.date !== undefined ? toDateOnly(values.date) : undefined,
  note: values.note !== undefined ? values.note?.trim() || null : undefined,
  receiptUrl: values.receiptUrl !== undefined ? values.receiptUrl || null : undefined,
});

export function listExpenses(projectId) { return getJson(`/expenses/${projectId}`); }
export function createExpense(values) { return postJson('/expenses', normalizeExpense(values)); }
export function updateExpense(id, values) { return putJson(`/expenses/${id}`, normalizeExpense(values)); }
export function deleteExpense(id) { return deleteJson(`/expenses/${id}`); }
