import { deleteJson, getJson, postJson, putJson } from './http';

const normalizeEmployee = (values) => ({
  name: values.name?.trim(),
  phone: values.phone?.trim() || null,
  role: values.role?.trim() || null,
});

export function listEmployees() { return getJson('/employees'); }
export function createEmployee(values) { return postJson('/employees', normalizeEmployee(values)); }
export function updateEmployee(id, values) { return putJson(`/employees/${id}`, normalizeEmployee(values)); }
export function deleteEmployee(id) { return deleteJson(`/employees/${id}`); }
export function getEmployeeBalance(id) { return getJson(`/employees/${id}/balance`); }
