const prisma = require('../lib/prisma');

const tableMap = {
  farm_projects: 'farmProject',
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
  employee_project_assignments: 'employeeProject',
};

// Order matters for push to avoid foreign key violations
const SYNC_ORDER = [
  'payees',
  'farm_projects',
  'employees',
  'employee_project_assignments',
  'budget_items',
  'inventory_items',
  'expenses',
  'work_entries',
  'payments',
  'harvests',
  'sales',
  'sale_payments',
];

// Models that have a direct userId field
const modelsWithDirectUserId = ['farmProject', 'employee', 'payee'];

// Mapping of Prisma fields (camelCase) to Watermelon fields (snake_case)
const fieldMapping = {
  userId: 'user_id',
  seasonId: 'season_id',
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
  receiptUrl: 'receipt_url',
  unitCost: 'unit_cost',
  usedQty: 'used_qty',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
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
  const dateFields = ['date', 'startDate', 'endDate', 'createdAt', 'updatedAt'];
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
  const idFields = ['projectId', 'employeeId', 'payeeId', 'seasonId', 'saleId'];
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

    for (const [watermelonTable, prismaModel] of Object.entries(tableMap)) {
      try {
        let where = {
          updatedAt: { gt: lastPulledAtDate },
        };

        // Apply security scoping using the pre-fetched IDs
        if (prismaModel === 'user') {
          where.id = req.user.id;
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
          if (['budgetItem', 'expense', 'harvest', 'sale', 'inventoryItem', 'employeeProject'].includes(prismaModel)) {
            where.projectId = { in: accessibleProjectIds };
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
          } else if (record.createdAt > lastPulledAtDate) {
            created.push(toWatermelon(record));
          } else {
            updated.push(toWatermelon(record));
          }
        });

        changes[watermelonTable] = { created, updated, deleted };
      } catch (tableError) {
        console.error(`[sync] Pull failed for table ${watermelonTable} (${prismaModel}):`, tableError.message);
        throw tableError;
      }
    }

    res.json({
      timestamp: currentTimestamp,
      changes,
    });
  } catch (error) {
    console.error('Pull Error:', error);
    res.status(500).json({ error: 'Failed to pull changes' });
  }
};

exports.push = async (req, res) => {
  const { changes } = req.body;
  if (!changes) return res.status(400).json({ error: 'Missing changes' });

  console.log(`[sync] Push started for user ${req.user.id}`);

  try {
    await prisma.$transaction(async (tx) => {
      for (const watermelonTable of SYNC_ORDER) {
        const prismaModel = tableMap[watermelonTable];
        const tableChanges = changes[watermelonTable];
        if (!tableChanges || (!tableChanges.created.length && !tableChanges.updated.length && !tableChanges.deleted.length)) continue;

        console.log(`[sync] Processing ${watermelonTable} (${prismaModel}): +${tableChanges.created.length} ~${tableChanges.updated.length} -${tableChanges.deleted.length}`);

        const { created, updated, deleted } = tableChanges;

        // Handle Created & Updated (Upsert for both to be safe and handle conflicts)
        const allChanges = [...created, ...updated];
        for (const record of allChanges) {
          const data = fromWatermelon(record);
          
          // Ensure userId is set for models that have it
          if (modelsWithDirectUserId.includes(prismaModel)) {
            data.userId = req.user.id;
          } else if (prismaModel === 'user') {
            data.id = req.user.id; // Don't let them change other users' IDs
          }
          
          // Safety Check: If payeeId is provided, verify it exists. If not, set to null.
          if (data.payeeId) {
            const payeeExists = await tx.payee.findUnique({ where: { id: data.payeeId } });
            if (!payeeExists) {
              console.warn(`[sync] Skipping non-existent payeeId ${data.payeeId} for ${prismaModel} ${data.id}`);
              data.payeeId = null;
            }
          }

          try {
            await tx[prismaModel].upsert({
              where: { id: data.id },
              create: data,
              update: data, // Client Wins
            });

            if (prismaModel === 'farmProject' && tx.projectAccess) {
              await tx.projectAccess.upsert({
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
          } catch (upsertError) {
            console.error(`[sync] Upsert failed for ${prismaModel} ${data.id}:`, upsertError.message);
            console.error('[sync] Data payload:', JSON.stringify(data, null, 2));
            throw upsertError; // Re-throw to fail the transaction
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
            } else if (['budgetItem', 'expense', 'harvest', 'sale', 'inventoryItem', 'employeeProject'].includes(prismaModel)) {
              where.project = { projectAccess: { some: { userId: req.user.id, role: { in: ['OWNER', 'MANAGER'] } } } };
            } else if (prismaModel === 'payment') {
              where.employee = { userId: req.user.id }; // Simplified: creator can delete
            } else if (prismaModel === 'employee' || prismaModel === 'payee') {
              where.userId = req.user.id;
            }

            try {
              await tx[prismaModel].updateMany({
                where,
                data: { isDeleted: true },
              });
            } catch (deleteError) {
              console.error(`[sync] Delete failed for ${prismaModel} ${id}:`, deleteError.message);
              throw deleteError;
            }
          }
        }
      }
    }, {
      timeout: 15000 // Increase timeout
    });

    console.log('[sync] Push completed successfully');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[sync] Global Push Error:', error.message);
    if (error.code) console.error('[sync] Error Code:', error.code);
    if (error.meta) console.error('[sync] Error Meta:', JSON.stringify(error.meta));
    res.status(500).json({ error: 'Failed to push changes' });
  }
};
