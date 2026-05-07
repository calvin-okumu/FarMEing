import { deleteJson, getJson, postJson, putJson, toDateOnly, toNumber } from './http';

function normalizeProjectPayload(values) {
  return {
    name: values.name?.trim(),
    crop: values.crop?.trim(),
    landSize: toNumber(values.landSize),
    landUnit: values.landUnit || 'acres',
    startDate: toDateOnly(values.startDate),
    endDate: values.endDate ? toDateOnly(values.endDate) : null,
    expectedYield: toNumber(values.expectedYield),
    status: values.status || 'ACTIVE',
    notes: values.notes?.trim() || null,
    seasonId: values.seasonId || null,
  };
}

export function listProjects() { return getJson('/projects'); }
export function getProject(id) { return getJson(`/projects/${id}`); }
export function getProjectSummary(id) { return getJson(`/projects/${id}/summary`); }
export function createProject(values) { return postJson('/projects', normalizeProjectPayload(values)); }
export function updateProject(id, values) { return putJson(`/projects/${id}`, normalizeProjectPayload(values)); }
export function deleteProject(id) { return deleteJson(`/projects/${id}`); }
