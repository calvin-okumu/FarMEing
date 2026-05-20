import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 27, // Incremented version
  tables: [
    // ── ProjectAccess ────────────────────────────────────────────────────────
    tableSchema({
      name: 'project_access',
      columns: [
        { name: 'user_id',    type: 'string' },
        { name: 'project_id', type: 'string' },
        { name: 'role',       type: 'string' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── ProjectInvitation ────────────────────────────────────────────────────
    tableSchema({
      name: 'project_invitations',
      columns: [
        { name: 'project_id',  type: 'string' },
        { name: 'role',        type: 'string' },
        { name: 'invite_code', type: 'string' },
        { name: 'expires_at',  type: 'number' },
        { name: 'is_used',     type: 'boolean' },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
      ],
    }),

    // ── ProjectBlock ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'project_blocks',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'name',       type: 'string' },
        { name: 'land_size',  type: 'number', isOptional: true },
        { name: 'land_unit',  type: 'string', isOptional: true },
        { name: 'crop',       type: 'string', isOptional: true },
        { name: 'crop_variety', type: 'string', isOptional: true },
        { name: 'expected_yield', type: 'number', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ── Season ───────────────────────────────────────────────────────────────

    tableSchema({
      name: 'seasons',
      columns: [
        { name: 'user_id',    type: 'string' },
        { name: 'name',       type: 'string' },
        { name: 'start_date', type: 'number' },
        { name: 'end_date',   type: 'number', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    // ── EmployeeProjectAssignment ───────────────────────────────────────────

    tableSchema({
      name: 'employee_project_assignments',
      columns: [
        { name: 'employee_id', type: 'string' },
        { name: 'project_id',  type: 'string' },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
      ],
    }),

    // ── Payee ───────────────────────────────────────────────────────────────
    tableSchema({
      name: 'payees',
      columns: [
        { name: 'user_id',    type: 'string' },
        { name: 'name',       type: 'string' },
        { name: 'phone',      type: 'string', isOptional: true },
        { name: 'email',      type: 'string', isOptional: true },
        { name: 'address',    type: 'string', isOptional: true },
        { name: 'category',   type: 'string', isOptional: true },
        { name: 'notes',      type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── FarmProject ─────────────────────────────────────────────────────────
    tableSchema({
      name: 'farm_projects',
      columns: [
        { name: 'user_id',        type: 'string' },
        { name: 'season_id',      type: 'string', isOptional: true },
        { name: 'name',           type: 'string' },
        { name: 'crop',           type: 'string' },
        { name: 'crop_variety',   type: 'string', isOptional: true },
        { name: 'land_size',      type: 'number' },
        { name: 'land_unit',      type: 'string' },
        { name: 'start_date',     type: 'number' },          // Unix ms timestamp
        { name: 'end_date',       type: 'number', isOptional: true },
        { name: 'expected_yield', type: 'number', isOptional: true },
        { name: 'status',         type: 'string' },          // PLANNING, ACTIVE, HARVESTED, CLOSED
        { name: 'notes',          type: 'string', isOptional: true },
        { name: 'contract_url',   type: 'string', isOptional: true },
        { name: 'is_deleted',     type: 'boolean' },
        { name: 'created_at',     type: 'number' },
        { name: 'updated_at',  type: 'number' },
      ],
    }),

    // ── Sale Payment ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'sale_payments',
      columns: [
        { name: 'sale_id',     type: 'string' },
        { name: 'amount',      type: 'number' },
        { name: 'date',        type: 'number' },
        { name: 'note',        type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
        { name: 'sync_status', type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
        { name: 'last_error', type: 'string', isOptional: true },
      ],
    }),

    // ── BudgetItem ──────────────────────────────────────────────────────────
    tableSchema({
      name: 'budget_items',
      columns: [
        { name: 'project_id',  type: 'string' },
        { name: 'block_id',    type: 'string', isOptional: true },
        { name: 'category',    type: 'string' },
        { name: 'name',        type: 'string' },
        { name: 'quantity',    type: 'number' },
        { name: 'unit',        type: 'string' },
        { name: 'unit_price',  type: 'number' },
        { name: 'total',       type: 'number' },
        { name: 'notes',       type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
      ],
    }),

    // ── Expense ──────────────────────────────────────────────────────────────
    tableSchema({
      name: 'expenses',
      columns: [
        { name: 'project_id',   type: 'string' },          // remote project id
        { name: 'block_id',     type: 'string', isOptional: true },
        { name: 'category',     type: 'string' },
        { name: 'expense_type', type: 'string' },          // CAPEX, OPEX
        { name: 'amount',       type: 'number' },
        { name: 'date',         type: 'number' },
        { name: 'is_recurring', type: 'boolean' },
        { name: 'frequency',    type: 'string', isOptional: true }, // DAILY, WEEKLY, MONTHLY
        { name: 'note',         type: 'string', isOptional: true },
        { name: 'receipt_url',  type: 'string', isOptional: true },
        { name: 'payee',        type: 'string', isOptional: true },
        { name: 'payee_id',     type: 'string', isOptional: true },
        { name: 'is_deleted',   type: 'boolean' },
        { name: 'created_at',   type: 'number' },
        { name: 'updated_at',   type: 'number' },
      ],
    }),

    // ── WorkEntry ────────────────────────────────────────────────────────────
    tableSchema({
      name: 'work_entries',
      columns: [
        { name: 'project_id',   type: 'string' },
        { name: 'block_id',     type: 'string', isOptional: true },
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
      ],
    }),


    // ── Employee ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'employees',
      columns: [
        { name: 'user_id',    type: 'string' },
        { name: 'name',       type: 'string' },
        { name: 'phone',      type: 'string', isOptional: true },
        { name: 'role',       type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ── Payment ─────────────────────────────────────────────────────────────
    tableSchema({
      name: 'payments',
      columns: [
        { name: 'employee_id', type: 'string' },
        { name: 'amount',      type: 'number' },
        { name: 'date',        type: 'number' },
        { name: 'note',        type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
      ],
    }),

    // ── Harvest ──────────────────────────────────────────────────────────────
    tableSchema({
      name: 'harvests',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'block_id',   type: 'string', isOptional: true },
        { name: 'crop',       type: 'string' },
        { name: 'date',       type: 'number' },
        { name: 'weight',     type: 'number' },
        { name: 'rejected_weight', type: 'number', isOptional: true },
        { name: 'rejected_reason', type: 'string', isOptional: true },
        { name: 'unit',       type: 'string' },
        { name: 'quality',    type: 'string', isOptional: true },
        { name: 'notes',      type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),


    // ── Sale ─────────────────────────────────────────────────────────────────
    tableSchema({
      name: 'sales',
      columns: [
        { name: 'project_id',  type: 'string' },
        { name: 'block_id',    type: 'string', isOptional: true },
        { name: 'date',        type: 'number' },
        { name: 'customer',    type: 'string', isOptional: true },
        { name: 'weight_sold', type: 'number' },
        { name: 'unit_price',  type: 'number' },
        { name: 'total_amount',type: 'number' },
        { name: 'payment_status', type: 'string', isOptional: true },
        { name: 'balance_due', type: 'number', isOptional: true },
        { name: 'receipt_url', type: 'string', isOptional: true },
        { name: 'notes',       type: 'string', isOptional: true },
        { name: 'is_deleted',  type: 'boolean' },
        { name: 'created_at',  type: 'number' },
        { name: 'updated_at',  type: 'number' },
      ],
    }),

    // ── SaleHarvest (Many-to-Many Join Table) ───────────────────────────────────
    tableSchema({
      name: 'sale_harvests',
      columns: [
        { name: 'sale_id',    type: 'string' },
        { name: 'harvest_id', type: 'string' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    tableSchema({
      name: 'inventory_items',
      columns: [
        { name: 'project_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'unit_cost', type: 'number' },
        { name: 'total_cost', type: 'number' },
        { name: 'used_qty', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'payee', type: 'string', isOptional: true },
        { name: 'payee_id', type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
