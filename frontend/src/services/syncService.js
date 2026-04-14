import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import api from '../lib/api';
import { SYNC_STATUS, markRecordFailed, markRecordSynced } from '../utils/localRecord';
import useSyncStore from '../store/useSyncStore';

const toMs = (value) => (value ? new Date(value).getTime() : null);

const TABLES = [
  {
    table: 'employees',
    endpoint: '/employees',
    responseKey: 'employee',
    payload: (record) => ({
      name: record.name,
      phone: record.phone,
      role: record.role,
    }),
  },
  {
    table: 'farm_projects',
    endpoint: '/projects',
    responseKey: 'project',
    payload: (record) => ({
      name: record.name,
      crop: record.crop,
      landSize: record.landSize,
      landUnit: record.landUnit,
      startDate: new Date(record.startDate).toISOString().split('T')[0],
      expectedYield: record.expectedYield,
      status: record.status,
      notes: record.notes,
      contractUrl: record.contractUrl,
    }),
  },
  {
    table: 'budget_items',
    endpoint: '/budget',
    responseKey: 'budgetItem',
    payload: async (record) => {
      const projectId = await resolveProjectRemoteId(record.projectId);
      if (!projectId) return null;
      return {
        projectId,
        category: record.category,
        name: record.name,
        quantity: record.quantity,
        unit: record.unit,
        unitPrice: record.unitPrice,
      };
    },
  },
  {
    table: 'expenses',
    endpoint: '/expenses',
    responseKey: 'expense',
    payload: async (record) => {
      const projectId = await resolveProjectRemoteId(record.projectId);
      if (!projectId) return null;
      return {
        projectId,
        category: record.category,
        expenseType: record.expenseType,
        amount: record.amount,
        date: new Date(record.date).toISOString().split('T')[0],
        isRecurring: record.isRecurring,
        frequency: record.frequency,
        note: record.note,
        receiptUrl: record.receiptUrl,
        payee: record.payee,
      };
    },
  },
  {
    table: 'work_entries',
    endpoint: '/work-entries',
    responseKey: 'workEntry',
    payload: async (record) => {
      const [projectId, employeeId] = await Promise.all([
        resolveProjectRemoteId(record.projectId),
        resolveEmployeeRemoteId(record.employeeId),
      ]);

      if (!projectId || !employeeId) return null;

      return {
        projectId,
        employeeId,
        activity: record.activity,
        date: new Date(record.date).toISOString().split('T')[0],
        daysWorked: record.daysWorked,
        ratePerDay: record.ratePerDay,
        hoursWorked: record.hoursWorked,
        imageUrl: record.imageUrl,
        locationLat: record.locationLat,
        locationLng: record.locationLng,
        status: record.status,
        isRecurring: record.isRecurring,
        frequency: record.frequency,
        notes: record.notes,
      };
    },
  },
  {
    table: 'payments',
    endpoint: '/payments',
    responseKey: 'payment',
    payload: async (record) => {
      const employeeId = await resolveEmployeeRemoteId(record.employeeId);
      if (!employeeId) return null;
      return {
        employeeId,
        amount: record.amount,
        date: new Date(record.date).toISOString().split('T')[0],
        note: record.note,
      };
    },
  },
  {
    table: 'harvests',
    endpoint: '/harvests',
    responseKey: 'harvest',
    payload: async (record) => {
      const projectId = await resolveProjectRemoteId(record.projectId);
      if (!projectId) return null;
      return {
        projectId,
        crop: record.crop,
        date: new Date(record.date).toISOString().split('T')[0],
        weight: record.weight,
        unit: record.unit,
        quality: record.quality,
        notes: record.notes,
      };
    },
  },
  {
    table: 'sales',
    endpoint: '/sales',
    responseKey: 'sale',
    payload: async (record) => {
      const projectId = await resolveProjectRemoteId(record.projectId);
      if (!projectId) return null;
      return {
        projectId,
        date: new Date(record.date).toISOString().split('T')[0],
        customer: record.customer,
        weightSold: record.weightSold,
        unitPrice: record.unitPrice,
        totalAmount: record.totalAmount,
        notes: record.notes,
      };
    },
  },
  {
    table: 'inventory_items',
    endpoint: '/inventory',
    responseKey: 'inventoryItem',
    payload: async (record) => {
      const projectId = await resolveProjectRemoteId(record.projectId);
      if (!projectId) return null;
      return {
        projectId,
        name: record.name,
        category: record.category,
        quantity: record.quantity,
        unit: record.unit,
        unitCost: record.unitCost,
        usedQty: record.usedQty,
        notes: record.notes,
        payee: record.payee,
      };
    },
  },
];

function isRemoteId(value) {
  return typeof value === 'string' && value.length > 20 && !value.startsWith('pending_');
}

async function resolveRemoteId(table, localOrRemoteId) {
  if (!localOrRemoteId) return null;
  if (isRemoteId(localOrRemoteId)) return localOrRemoteId;

  try {
    const record = await database.get(table).find(localOrRemoteId);
    return record.remoteId || null;
  } catch {
    const matches = await database.get(table).query(Q.where('remote_id', localOrRemoteId)).fetch();
    return matches[0]?.remoteId || localOrRemoteId;
  }
}

const resolveProjectRemoteId = (id) => resolveRemoteId('farm_projects', id);
const resolveEmployeeRemoteId = (id) => resolveRemoteId('employees', id);

async function findByRemoteId(table, remoteId) {
  const matches = await database.get(table).query(Q.where('remote_id', remoteId)).fetch();
  return matches[0] || null;
}

async function buildRemoteMaps() {
  const [projects, employees] = await Promise.all([
    database.get('farm_projects').query().fetch(),
    database.get('employees').query().fetch(),
  ]);

  return {
    projects: new Map(projects.filter((item) => item.remoteId).map((item) => [item.remoteId, item.id])),
    employees: new Map(employees.filter((item) => item.remoteId).map((item) => [item.remoteId, item.id])),
  };
}

function applySyncMetadata(record, item, remoteId = item.id) {
  markRecordSynced(record, remoteId);
  record.createdAt = toMs(item.createdAt) ?? record.createdAt ?? Date.now();
  record.updatedAt = toMs(item.updatedAt) ?? Date.now();
}

async function upsertSimpleCollection(table, remoteItems, mapRecord) {
  if (!remoteItems?.length) return 0;
  const collection = database.get(table);
  let count = 0;

  for (const item of remoteItems) {
    const existing = await findByRemoteId(table, item.id);

    await database.write(async () => {
      if (existing) {
        await existing.update((record) => {
          mapRecord(record, item);
          applySyncMetadata(record, item);
        });
      } else {
        await collection.create((record) => {
          mapRecord(record, item);
          applySyncMetadata(record, item);
        });
      }
    });

    count += 1;
  }

  return count;
}

async function syncProjects(projects) {
  return upsertSimpleCollection('farm_projects', projects, (record, item) => {
    record.userId = item.userId ?? '';
    record.seasonId = item.seasonId ?? '';
    record.name = item.name ?? '';
    record.crop = item.crop ?? '';
    record.landSize = item.landSize ?? 0;
    record.landUnit = item.landUnit ?? 'acres';
    record.startDate = toMs(item.startDate) ?? Date.now();
    record.endDate = toMs(item.endDate) ?? null;
    record.expectedYield = item.expectedYield ?? 0;
    record.status = item.status ?? 'ACTIVE';
    record.notes = item.notes ?? '';
    record.contractUrl = item.contractUrl ?? '';
    record.isDeleted = item.isDeleted ?? false;
  });
}

async function syncEmployees(remoteItems) {
  return upsertSimpleCollection('employees', remoteItems, (record, item) => {
    record.userId = item.userId ?? '';
    record.name = item.name ?? '';
    record.phone = item.phone ?? '';
    record.role = item.role ?? '';
    record.isDeleted = item.isDeleted ?? false;
  });
}

async function syncProjectBoundCollection(table, remoteItems, projectMap, mapper) {
  return upsertSimpleCollection(table, remoteItems, (record, item) => {
    mapper(record, item, projectMap);
  });
}

async function syncPayments(remoteItems, employeeMap) {
  return upsertSimpleCollection('payments', remoteItems, (record, item) => {
    record.employeeId = employeeMap.get(item.employeeId) || item.employeeId || '';
    record.amount = item.amount ?? 0;
    record.date = toMs(item.date) ?? Date.now();
    record.note = item.note ?? '';
    record.isDeleted = item.isDeleted ?? false;
  });
}

async function processRecord(config, record) {
  const { endpoint, responseKey } = config;
  const desiredStatus = record.syncStatus;

  try {
    if (desiredStatus === SYNC_STATUS.PENDING_DELETE) {
      if (!record.remoteId) {
        await database.write(async () => {
          await record.destroyPermanently();
        });
        return 1;
      }

      await api.delete(`${endpoint}/${record.remoteId}`);
      await database.write(async () => {
        await record.destroyPermanently();
      });
      return 1;
    }

    const payload = await config.payload(record);
    if (!payload) return 0;

    const response = desiredStatus === SYNC_STATUS.PENDING_CREATE || !record.remoteId
      ? await api.post(endpoint, payload)
      : await api.put(`${endpoint}/${record.remoteId}`, payload);

    const remoteItem = response.data?.[responseKey];
    if (!remoteItem) return 0;

    await database.write(async () => {
      await record.update((draft) => {
        markRecordSynced(draft, remoteItem.id);
        draft.createdAt = toMs(remoteItem.createdAt) ?? draft.createdAt;
        draft.updatedAt = toMs(remoteItem.updatedAt) ?? Date.now();
      });
    });

    return 1;
  } catch (error) {
    await database.write(async () => {
      await record.update((draft) => {
        markRecordFailed(draft, error.message, desiredStatus);
      });
    });
    return 0;
  }
}

async function pushChanges() {
  let pushed = 0;

  for (const config of TABLES) {
    const collection = database.get(config.table);
    const records = await collection
      .query(Q.where('sync_status', Q.oneOf([
        SYNC_STATUS.PENDING_CREATE,
        SYNC_STATUS.PENDING_UPDATE,
        SYNC_STATUS.PENDING_DELETE,
        SYNC_STATUS.FAILED,
      ])))
      .fetch();

    for (const record of records) {
      pushed += await processRecord(config, record);
    }
  }

  return pushed;
}

async function countFailedRecords() {
  const counts = await Promise.all(
    TABLES.map(({ table }) => database.get(table).query(Q.where('sync_status', SYNC_STATUS.FAILED)).fetchCount())
  );

  return counts.reduce((sum, count) => sum + count, 0);
}

async function pullChanges() {
  let pulled = 0;
  const { data: { projects = [] } } = await api.get('/projects', { params: { includeDeleted: true } });
  pulled += await syncProjects(projects);

  const activeProjects = projects.filter((project) => !project.isDeleted);
  const { projects: projectMap, employees: employeeMapBefore } = await buildRemoteMaps();

  const { data: { employees = [] } } = await api.get('/employees', { params: { includeDeleted: true } });
  pulled += await syncEmployees(employees);

  const { employees: employeeMap } = await buildRemoteMaps();
  const { data: { payments = [] } } = await api.get('/payments', { params: { includeDeleted: true } });
  pulled += await syncPayments(payments, employeeMap);

  for (const project of activeProjects) {
    const localProjectId = projectMap.get(project.id) || project.id;

    try {
      const [budgetRes, expenseRes, workRes, harvestRes, saleRes, inventoryRes] = await Promise.all([
        api.get(`/budget/${project.id}`, { params: { includeDeleted: true } }),
        api.get(`/expenses/${project.id}`, { params: { includeDeleted: true } }),
        api.get(`/work-entries/${project.id}`, { params: { includeDeleted: true } }),
        api.get(`/harvests/${project.id}`, { params: { includeDeleted: true } }),
        api.get(`/sales/${project.id}`, { params: { includeDeleted: true } }),
        api.get(`/inventory/${project.id}`, { params: { includeDeleted: true } }),
      ]);

      pulled += await syncProjectBoundCollection(
        'budget_items',
        budgetRes.data.budgetItems || [],
        projectMap,
        (record, item) => {
          record.projectId = projectMap.get(item.projectId) || localProjectId;
          record.category = item.category ?? '';
          record.name = item.name ?? '';
          record.quantity = item.quantity ?? 0;
          record.unit = item.unit ?? '';
          record.unitPrice = item.unitPrice ?? 0;
          record.isDeleted = item.isDeleted ?? false;
        }
      );

      pulled += await syncProjectBoundCollection(
        'expenses',
        expenseRes.data.expenses || [],
        projectMap,
        (record, item) => {
          record.projectId = projectMap.get(item.projectId) || localProjectId;
          record.category = item.category ?? '';
          record.expenseType = item.expenseType ?? 'OPEX';
          record.amount = item.amount ?? 0;
          record.date = toMs(item.date) ?? Date.now();
          record.isRecurring = item.isRecurring ?? false;
          record.frequency = item.frequency ?? null;
          record.note = item.note ?? '';
          record.receiptUrl = item.receiptUrl ?? '';
          record.payee = item.payee ?? '';
          record.isDeleted = item.isDeleted ?? false;
        }
      );

      pulled += await syncProjectBoundCollection(
        'work_entries',
        workRes.data.workEntries || [],
        projectMap,
        (record, item) => {
          record.projectId = projectMap.get(item.projectId) || localProjectId;
          record.employeeId = employeeMap.get(item.employeeId) || employeeMapBefore.get(item.employeeId) || item.employeeId || '';
          record.activity = item.activity ?? '';
          record.date = toMs(item.date) ?? Date.now();
          record.daysWorked = item.daysWorked ?? 0;
          record.ratePerDay = item.ratePerDay ?? 0;
          record.totalCost = item.totalCost ?? 0;
          record.hoursWorked = item.hoursWorked ?? 0;
          record.imageUrl = item.imageUrl ?? '';
          record.locationLat = item.locationLat ?? 0;
          record.locationLng = item.locationLng ?? 0;
          record.status = item.status ?? 'PENDING';
          record.isRecurring = item.isRecurring ?? false;
          record.frequency = item.frequency ?? null;
          record.notes = item.notes ?? '';
          record.isPaid = item.isPaid ?? false;
          record.isDeleted = item.isDeleted ?? false;
        }
      );

      pulled += await syncProjectBoundCollection(
        'harvests',
        harvestRes.data.harvests || [],
        projectMap,
        (record, item) => {
          record.projectId = projectMap.get(item.projectId) || localProjectId;
          record.crop = item.crop ?? '';
          record.date = toMs(item.date) ?? Date.now();
          record.weight = item.weight ?? 0;
          record.unit = item.unit ?? 'kg';
          record.quality = item.quality ?? '';
          record.notes = item.notes ?? '';
          record.isDeleted = item.isDeleted ?? false;
        }
      );

      pulled += await syncProjectBoundCollection(
        'sales',
        saleRes.data.sales || [],
        projectMap,
        (record, item) => {
          record.projectId = projectMap.get(item.projectId) || localProjectId;
          record.date = toMs(item.date) ?? Date.now();
          record.customer = item.customer ?? '';
          record.weightSold = item.weightSold ?? 0;
          record.unitPrice = item.unitPrice ?? 0;
          record.totalAmount = item.totalAmount ?? 0;
          record.notes = item.notes ?? '';
          record.isDeleted = item.isDeleted ?? false;
        }
      );

      pulled += await syncProjectBoundCollection(
        'inventory_items',
        inventoryRes.data.inventoryItems || [],
        projectMap,
        (record, item) => {
          record.projectId = projectMap.get(item.projectId) || localProjectId;
          record.name = item.name ?? '';
          record.category = item.category ?? '';
          record.quantity = item.quantity ?? 0;
          record.unit = item.unit ?? '';
          record.unitCost = item.unitCost ?? 0;
          record.totalCost = item.totalCost ?? 0;
          record.usedQty = item.usedQty ?? 0;
          record.notes = item.notes ?? '';
          record.payee = item.payee ?? '';
          record.isDeleted = item.isDeleted ?? false;
        }
      );
    } catch {
      // Skip missing or deleted projects.
    }
  }

  return pulled;
}

let _syncing = false;

export async function syncAll() {
  if (_syncing) {
    return { pushed: 0, pulled: 0, skipped: true };
  }

  _syncing = true;
  useSyncStore.getState().setSyncing();

  try {
    const pushed = await pushChanges();
    const pulled = await pullChanges();
    const failedCount = await countFailedRecords();
    useSyncStore.getState().setSuccess({ failedCount });
    return { pushed, pulled, failedCount, skipped: false };
  } catch (error) {
    console.warn('[sync] failed:', error.message);
    useSyncStore.getState().setError(error.message);
    return { pushed: 0, pulled: 0, skipped: false, error: error.message };
  } finally {
    _syncing = false;
  }
}
