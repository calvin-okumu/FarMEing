const prisma = require('../lib/prisma');

const tableMap = {
  seasons: 'season',
  farm_projects: 'farmProject',
  project_blocks: 'projectBlock',
  budget_items: 'budgetItem',
  expenses: 'expense',
  employees: 'employee',
  work_entries: 'workEntry',
  payments: 'payment',
  harvests: 'harvest',
  sales: 'sale',
  sale_payments: 'salePayment',
  inventory_items: 'inventoryItem',
  payees: 'payee',
  equipments: 'equipment',
  employee_project_assignments: 'employeeProject',
  project_access: 'projectAccess',
  project_invitations: 'projectInvitation',
  sale_harvests: 'saleHarvest',
};

// Order matters for push to avoid foreign key violations
const SYNC_ORDER = [
  'seasons',
  'payees',
  'farm_projects',
  'project_access',
  'project_invitations',
  'project_blocks',
  'equipments',
  'employees',
  'employee_project_assignments',
  'budget_items',
  'inventory_items',
  'expenses',
  'work_entries',
  'payments',
  'harvests',
  'sales',
  'sale_harvests',
  'sale_payments',
];

// Models that have a direct userId field
const modelsWithDirectUserId = ['farmProject', 'employee', 'payee', 'season'];


// Mapping of Prisma fields (camelCase) to Watermelon fields (snake_case)
const fieldMapping = {
  userId: 'user_id',
  seasonId: 'season_id',
  blockId: 'block_id',
  harvestId: 'harvest_id',
  rejectedWeight: 'rejected_weight',
  rejectedReason: 'rejected_reason',
  cropVariety: 'crop_variety',
  landSize: 'land_size',
  landUnit: 'land_unit',
  startDate: 'start_date',

  endDate: 'end_date',
  expectedYield: 'expected_yield',
  contractUrl: 'contract_url',
  payeeId: 'payee_id',
  isDeleted: 'is_deleted',
  projectId: 'project_id',
  unitPrice: 'unit_price',
  expenseType: 'expense_type',
  isRecurring: 'is_recurring',
  receiptUrl: 'receipt_url',
  employeeId: 'employee_id',
  daysWorked: 'days_worked',
  ratePerDay: 'rate_per_day',
  totalCost: 'total_cost',
  hoursWorked: 'hours_worked',
  imageUrl: 'image_url',
  locationLat: 'location_lat',
  locationLng: 'location_lng',
  isPaid: 'is_paid',
  weightSold: 'weight_sold',
  totalAmount: 'total_amount',
  saleId: 'sale_id',
  paymentStatus: 'payment_status',
  balanceDue: 'balance_due',
  unitCost: 'unit_cost',
  usedQty: 'used_qty',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  syncStatus: 'sync_status',
  lastSyncedAt: 'last_synced_at',
  lastError: 'last_error',
  inviteCode: 'invite_code',
  expiresAt: 'expires_at',
  isUsed: 'is_used',
  userName: 'user_name',
  userPhone: 'user_phone',
  serialNumber: 'serial_number',
  purchaseDate: 'purchase_date',
  purchasePrice: 'purchase_price',
  cropVariety: 'crop_variety',
};

const reverseMapping = Object.fromEntries(
  Object.entries(fieldMapping).map(([k, v]) => [v, k])
);

const getAccessibleProjectIdsForUser = async (userId) => {
  const projectIds = new Set();

  const ownedProjects = await prisma.farmProject.findMany({
    where: { userId, isDeleted: false },
    select: { id: true },
  });

  ownedProjects.forEach((project) => projectIds.add(project.id));

  if (!prisma.projectAccess) {
    console.warn('[sync] prisma.projectAccess is unavailable; falling back to owned projects only');
    return Array.from(projectIds);
  }

  const accessRecords = await prisma.projectAccess.findMany({
    where: { userId },
    select: { projectId: true },
  });

  accessRecords.forEach((access) => projectIds.add(access.projectId));
  return Array.from(projectIds);
};

// Helper to convert Prisma record to WatermelonDB format
const toWatermelon = (record) => {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    const watermelonKey = fieldMapping[key] || key;
    if (value instanceof Date) {
      result[watermelonKey] = value.getTime();
    } else {
      result[watermelonKey] = value;
    }
  }
  return result;
};

// Helper to convert WatermelonDB record to Prisma format
const fromWatermelon = (record) => {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    // Skip internal Watermelon fields (like _status, _changed)
    if (key.startsWith('_')) continue;
    
    const prismaKey = reverseMapping[key] || key;
    result[prismaKey] = value;
  }

  // Date fields in the schema that might come as timestamps
  const dateFields = ['date', 'startDate', 'endDate', 'expiresAt', 'createdAt', 'updatedAt', 'purchaseDate'];
  dateFields.forEach(field => {
    if (result[field] !== undefined && result[field] !== null) {
      if (typeof result[field] === 'number') {
        result[field] = new Date(result[field]);
      } else if (typeof result[field] === 'string' && result[field].length > 0) {
        result[field] = new Date(result[field]);
      }
    }
  });

  // Foreign keys or IDs should be null if they are empty strings
  const idFields = ['projectId', 'employeeId', 'payeeId', 'seasonId', 'saleId', 'blockId', 'harvestId', 'userId'];
  idFields.forEach(field => {
    if (result[field] === '') {
      result[field] = null;
    }
  });

  return result;
};

exports.pull = async (req, res) => {
  try {
    const { last_pulled_at } = req.query;
    const lastPulledAtDate = last_pulled_at && last_pulled_at !== 'null' && last_pulled_at !== '0'
      ? new Date(parseInt(last_pulled_at))
      : new Date(0);
    
    const currentTimestamp = Date.now();
    const changes = {};

    // 1. Get all project IDs this user has access to
    const accessibleProjectIds = await getAccessibleProjectIdsForUser(req.user.id);

    // 2. Fetch changes for all tables in parallel
    const tablePromises = Object.entries(tableMap).map(async ([watermelonTable, prismaModel]) => {
      try {
        let where = {
          updatedAt: { gt: lastPulledAtDate },
        };

      // Apply security scoping
      if (prismaModel === 'user' || prismaModel === 'season') {
        where.id = req.user.id;
        if (prismaModel === 'season') {
          where = { userId: req.user.id, updatedAt: { gt: lastPulledAtDate } };
        }
      } else if (prismaModel === 'employee') {
        where.OR = [
          { userId: req.user.id },
          { assignments: { some: { projectId: { in: accessibleProjectIds } } } }
        ];
      } else if (prismaModel === 'payee') {
        where.OR = [
          { userId: req.user.id },
          { expenses: { some: { projectId: { in: accessibleProjectIds } } } },
          { inventoryItems: { some: { projectId: { in: accessibleProjectIds } } } }
        ];
      } else if (prismaModel === 'farmProject') {
        where.id = { in: accessibleProjectIds };
      } else {
        // All other models are directly linked to a project
        if (['budgetItem', 'expense', 'harvest', 'sale', 'inventoryItem', 'employeeProject', 'projectBlock', 'projectAccess', 'projectInvitation', 'equipment'].includes(prismaModel)) {
          where.projectId = { in: accessibleProjectIds };
        } else if (prismaModel === 'saleHarvest') {
          where.sale = { projectId: { in: accessibleProjectIds } };
        } else if (prismaModel === 'salePayment') {
          where.sale = { projectId: { in: accessibleProjectIds } };
        } else if (prismaModel === 'payment') {

          where.employee = { 
            OR: [
              { userId: req.user.id },
              { assignments: { some: { projectId: { in: accessibleProjectIds } } } }
            ]
          };
        } else if (prismaModel === 'workEntry') {
          where.OR = [
            { projectId: { in: accessibleProjectIds } },
            { employee: { userId: req.user.id } }
          ];
        }
      }

      const records = await prisma[prismaModel].findMany({ where });

      const created = [];
      const updated = [];
      const deleted = [];

      records.forEach(record => {
        if (record.isDeleted) {
          deleted.push(record.id);
        } else {
          updated.push(toWatermelon(record));
        }
      });

      return { watermelonTable, created, updated, deleted };
    } catch (err) {
      console.error(`[sync] Error pulling table ${watermelonTable} (${prismaModel}):`, err);
      throw err;
    }
    });

    const results = await Promise.all(tablePromises);
    results.forEach(({ watermelonTable, created, updated, deleted }) => {
      changes[watermelonTable] = { created, updated, deleted };
    });

    res.json({
      timestamp: currentTimestamp,
      changes,
    });
  } catch (error) {
    console.error('[sync] Pull Error:', error);
    res.status(500).json({ error: 'Failed to pull changes' });
  }
};


exports.push = async (req, res) => {
  const { changes } = req.body;
  if (!changes) return res.status(400).json({ error: 'Missing changes' });

  console.log(`[sync] Push started for user ${req.user.id}`);
  const accessibleProjectIds = await getAccessibleProjectIdsForUser(req.user.id);

  const results = {
    success: true,
    processed: {},
    errors: [],
  };

  try {
    for (const watermelonTable of SYNC_ORDER) {
      const prismaModel = tableMap[watermelonTable];
      const tableChanges = changes[watermelonTable];
      if (!tableChanges || (!tableChanges.created.length && !tableChanges.updated.length && !tableChanges.deleted.length)) continue;

      console.log(`[sync] Processing ${watermelonTable} (${prismaModel}): +${tableChanges.created.length} ~${tableChanges.updated.length} -${tableChanges.deleted.length}`);

      results.processed[watermelonTable] = { created: 0, updated: 0, deleted: 0, errors: 0 };
      const { created, updated, deleted } = tableChanges;

      // Handle Created & Updated
      const allChanges = [...created, ...updated];
      for (const record of allChanges) {
        const data = fromWatermelon(record);
        
        // Ensure userId is set for models that have it
        if (modelsWithDirectUserId.includes(prismaModel)) {
          data.userId = req.user.id;
        } else if (prismaModel === 'user') {
          data.id = req.user.id;
        }
        
        try {
          // Conflict Resolution: Server Delete Wins
          // If the record exists and isDeleted is true on server, skip the client update
          const existing = await prisma[prismaModel].findUnique({
            where: { id: data.id },
            select: { isDeleted: true }
          });

          if (existing && existing.isDeleted) {
            console.warn(`[sync] Skipping update for soft-deleted ${prismaModel} ${data.id}`);
            continue;
          }

          // Authorization Check for project-linked records
          if (data.projectId && prismaModel !== 'farmProject') {
            if (!accessibleProjectIds.includes(data.projectId)) {
              console.warn(`[sync] Unauthorized project access for ${prismaModel} ${data.id} (projectId: ${data.projectId})`);
              throw new Error('Unauthorized project access');
            }
          }

          // Safety Check: If payeeId is provided, verify it exists.
          if (data.payeeId) {
            const payeeExists = await prisma.payee.findUnique({ where: { id: data.payeeId } });
            if (!payeeExists) {
              console.warn(`[sync] Skipping non-existent payeeId ${data.payeeId} for ${prismaModel} ${data.id}`);
              data.payeeId = null;
            }
          }

          await prisma[prismaModel].upsert({
            where: { id: data.id },
            create: data,
            update: data,
          });

          if (prismaModel === 'farmProject' && prisma.projectAccess) {
            await prisma.projectAccess.upsert({
              where: {
                userId_projectId: {
                  userId: req.user.id,
                  projectId: data.id,
                },
              },
              create: {
                userId: req.user.id,
                projectId: data.id,
                role: 'OWNER',
              },
              update: {
                role: 'OWNER',
              },
            });
          }
          
          if (created.find(c => c.id === record.id)) {
            results.processed[watermelonTable].created++;
          } else {
            results.processed[watermelonTable].updated++;
          }
        } catch (recordError) {
          console.error(`[sync] Record failed for ${prismaModel} ${data.id}:`, recordError.message);
          results.processed[watermelonTable].errors++;
          results.errors.push({
            table: watermelonTable,
            id: data.id,
            error: recordError.message,
          });
          // Continue to next record instead of failing everything
        }
      }

      // Handle Deleted
      if (deleted && deleted.length > 0) {
        for (const id of deleted) {
          let where = { id };
          
          // Security scoping for deletion
          if (prismaModel === 'user') {
            where.id = req.user.id;
          } else if (prismaModel === 'farmProject') {
            where.projectAccess = { some: { userId: req.user.id, role: 'OWNER' } };
          } else if (['projectAccess', 'projectInvitation'].includes(prismaModel)) {
            where.project = { projectAccess: { some: { userId: req.user.id, role: 'OWNER' } } };
          } else if (['budgetItem', 'expense', 'harvest', 'sale', 'inventoryItem', 'employeeProject', 'projectBlock', 'equipment'].includes(prismaModel)) {
            where.project = { projectAccess: { some: { userId: req.user.id, role: { in: ['OWNER', 'MANAGER'] } } } };
          } else if (prismaModel === 'saleHarvest') {
            where.sale = { project: { projectAccess: { some: { userId: req.user.id, role: { in: ['OWNER', 'MANAGER'] } } } } };
          } else if (prismaModel === 'payment') {

            where.employee = { userId: req.user.id };
          } else if (prismaModel === 'employee' || prismaModel === 'payee') {
            where.userId = req.user.id;
          }

          try {
            const updateCount = await prisma[prismaModel].updateMany({
              where,
              data: { isDeleted: true },
            });
            if (updateCount.count > 0) {
              results.processed[watermelonTable].deleted++;
            }
          } catch (deleteError) {
            console.error(`[sync] Delete failed for ${prismaModel} ${id}:`, deleteError.message);
            results.errors.push({
              table: watermelonTable,
              id,
              error: deleteError.message,
            });
          }
        }
      }
    }

    console.log('[sync] Push completed');
    res.status(200).json({ status: 'ok', results });
  } catch (error) {
    console.error('[sync] Global Push Error:', error.message);
    res.status(500).json({ error: 'Failed to push changes', details: error.message });
  }
};

