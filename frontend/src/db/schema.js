import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 6,
  tables: [
    // ── FarmProject ─────────────────────────────────────────────────────────
    tableSchema({
      name: 'farm_projects',
      columns: [
        { name: 'remote_id',      type: 'string' },
        { name: 'user_id',        type: 'string' },
        { name: 'season_id',      type: 'string', isOptional: true },
        { name: 'name',           type: 'string' },
        { name: 'crop',           type: 'string' },
        { name: 'land_size',      type: 'number' },
        { name: 'land_unit',      type: 'string' },
        { name: 'start_date',     type: 'number' },          // Unix ms timestamp
        { name: 'end_date',       type: 'number', isOptional: true },
        { name: 'expected_yield', type: 'number', isOptional: true },
        { name: 'status',         type: 'string' },          // PLANNING, ACTIVE, HARVESTED, CLOSED
        { name: 'notes',          type: 'string', isOptional: true },
        { name: 'is_deleted',     type: 'boolean' },
        { name: 'created_at',     type: 'number' },
        { name: 'updated_at',     type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── BudgetItem ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'budget_items',
      columns: [
        { name: 'remote_id',   type: 'string' },
        { name: 'project_id',  type: 'string' },
        { name: 'category',    type: 'string' },
        { name: 'name',        type: 'string' },
        { name: 'quantity',    type: 'number' },
        { name: 'unit',        type: 'string' },
        { name: 'unit_price',  type: 'number' },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── Expense ──────────────────────────────────────────────────────────────
    tableSchema({
      name: 'expenses',
      columns: [
        { name: 'remote_id',    type: 'string' },
        { name: 'project_id',   type: 'string' },          // remote project id
        { name: 'category',     type: 'string' },
        { name: 'expense_type', type: 'string' },          // CAPEX, OPEX
        { name: 'amount',       type: 'number' },
        { name: 'date',         type: 'number' },
        { name: 'is_recurring', type: 'boolean' },
        { name: 'frequency',    type: 'string', isOptional: true }, // DAILY, WEEKLY, MONTHLY
        { name: 'note',         type: 'string', isOptional: true },
        { name: 'receipt_url',  type: 'string', isOptional: true },
        { name: 'is_deleted',   type: 'boolean' },
        { name: 'created_at',   type: 'number' },
        { name: 'updated_at',   type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── WorkEntry ────────────────────────────────────────────────────────────
    tableSchema({
      name: 'work_entries',
      columns: [
        { name: 'remote_id',    type: 'string' },
        { name: 'project_id',   type: 'string' },
        { name: 'employee_id',  type: 'string' },
        { name: 'activity',     type: 'string' },
        { name: 'date',         type: 'number' },
        { name: 'days_worked',  type: 'number' },
        { name: 'rate_per_day', type: 'number' },
        { name: 'total_cost',   type: 'number' },
        { name: 'hours_worked', type: 'number', isOptional: true },
        { name: 'image_url',    type: 'string', isOptional: true },
        { name: 'location_lat', type: 'number', isOptional: true },
        { name: 'location_lng', type: 'number', isOptional: true },
        { name: 'status',       type: 'string' },          // PENDING, APPROVED, REJECTED
        { name: 'is_recurring', type: 'boolean' },
        { name: 'frequency',    type: 'string', isOptional: true }, // DAILY, WEEKLY, MONTHLY
        { name: 'notes',        type: 'string', isOptional: true },
        { name: 'is_paid',      type: 'boolean' },
        { name: 'is_deleted',   type: 'boolean' },
        { name: 'created_at',   type: 'number' },
        { name: 'updated_at',   type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── Employee ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'employees',
      columns: [
        { name: 'remote_id',  type: 'string' },
        { name: 'user_id',    type: 'string' },
        { name: 'name',       type: 'string' },
        { name: 'phone',      type: 'string', isOptional: true },
        { name: 'role',       type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── Payment ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'payments',
      columns: [
        { name: 'remote_id',   type: 'string' },
        { name: 'employee_id', type: 'string' },
        { name: 'amount',      type: 'number' },
        { name: 'date',        type: 'number' },
        { name: 'note',        type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── Harvest ──────────────────────────────────────────────────────────────
    tableSchema({
      name: 'harvests',
      columns: [
        { name: 'remote_id',   type: 'string' },
        { name: 'project_id',  type: 'string' },
        { name: 'crop',        type: 'string' },
        { name: 'date',        type: 'number' },
        { name: 'weight',      type: 'number' },
        { name: 'unit',        type: 'string' },
        { name: 'quality',     type: 'string', isOptional: true },
        { name: 'notes',       type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),

    // ── Sale ─────────────────────────────────────────────────────────────────
    tableSchema({
      name: 'sales',
      columns: [
        { name: 'remote_id',   type: 'string' },
        { name: 'project_id',  type: 'string' },
        { name: 'date',        type: 'number' },
        { name: 'customer',    type: 'string', isOptional: true },
        { name: 'weight_sold', type: 'number' },
        { name: 'unit_price',  type: 'number' },
        { name: 'total_amount',type: 'number' },
        { name: 'notes',       type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
        { name: 'sync_status',    type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error',     type: 'string', isOptional: true },
      ],
    }),
  ],
});
