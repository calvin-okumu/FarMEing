import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

const syncColumns = [
  { name: 'sync_status', type: 'string' },
  { name: 'last_synced_at', type: 'number', isOptional: true },
  { name: 'last_error', type: 'string', isOptional: true },
];

export default schemaMigrations({
  migrations: [
    {
      toVersion: 6,
      steps: [
        addColumns({ table: 'farm_projects', columns: syncColumns }),
        addColumns({ table: 'budget_items', columns: syncColumns }),
        addColumns({ table: 'expenses', columns: syncColumns }),
        addColumns({ table: 'work_entries', columns: syncColumns }),
        addColumns({ table: 'employees', columns: syncColumns }),
        addColumns({ table: 'payments', columns: syncColumns }),
        addColumns({ table: 'harvests', columns: syncColumns }),
        addColumns({ table: 'sales', columns: syncColumns }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        createTable({
          name: 'inventory_items',
          columns: [
            { name: 'remote_id', type: 'string' },
            { name: 'project_id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'category', type: 'string' },
            { name: 'quantity', type: 'number' },
            { name: 'unit', type: 'string' },
            { name: 'unit_cost', type: 'number' },
            { name: 'total_cost', type: 'number' },
            { name: 'used_qty', type: 'number' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'is_deleted', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
            { name: 'sync_status', type: 'string' },
            { name: 'last_synced_at', type: 'number', isOptional: true },
            { name: 'last_error', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        addColumns({ table: 'farm_projects', columns: [{ name: 'contract_url', type: 'string', isOptional: true }] }),
        addColumns({ table: 'expenses', columns: [{ name: 'payee', type: 'string', isOptional: true }] }),
        addColumns({ table: 'inventory_items', columns: [{ name: 'payee', type: 'string', isOptional: true }] }),
      ],
    },
    {
      toVersion: 9,
      steps: [],
    },
    {
      toVersion: 10,
      steps: [
        addColumns({ table: 'employees', columns: [{ name: 'project_id', type: 'string', isOptional: true }] }),
      ],
    },
    {
      toVersion: 11,
      steps: [],
    },
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'budget_items',
          columns: [
            { name: 'total', type: 'number' },
            { name: 'notes', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 13,
      steps: [
        createTable({
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
        addColumns({ table: 'expenses', columns: [{ name: 'payee_id', type: 'string', isOptional: true }] }),
        addColumns({ table: 'inventory_items', columns: [{ name: 'payee_id', type: 'string', isOptional: true }] }),
      ],
    },
    {
      toVersion: 14,
      steps: [
        createTable({
          name: 'employee_project_assignments',
          columns: [
            { name: 'employee_id', type: 'string' },
            { name: 'project_id',  type: 'string' },
            { name: 'is_deleted',  type: 'boolean' },
            { name: 'created_at',  type: 'number' },
            { name: 'updated_at',  type: 'number' },
          ],
        }),
        // project_id remains in SQLite for existing users but will be ignored by the model
      ],
    },
    {
      toVersion: 15,
      steps: [
        addColumns({
          table: 'employee_project_assignments',
          columns: [
            { name: 'is_deleted', type: 'boolean' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'sales',
          columns: [
            { name: 'payment_status', type: 'string', isOptional: true },
            { name: 'balance_due', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 17,
      steps: [
        addColumns({
          table: 'sales',
          columns: [
            { name: 'receipt_url', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 18,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 19,
      steps: [
        addColumns({
          table: 'sale_payments',
          columns: [
            { name: 'sync_status', type: 'string', isOptional: true },
            { name: 'last_synced_at', type: 'number', isOptional: true },
            { name: 'last_error', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 20,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 21,
      steps: [
        createTable({
          name: 'project_blocks',
          columns: [
            { name: 'project_id', type: 'string' },
            { name: 'name',       type: 'string' },
            { name: 'is_deleted', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        addColumns({ table: 'budget_items', columns: [{ name: 'block_id', type: 'string', isOptional: true }] }),
        addColumns({ table: 'expenses',     columns: [{ name: 'block_id', type: 'string', isOptional: true }] }),
        addColumns({ table: 'work_entries', columns: [{ name: 'block_id', type: 'string', isOptional: true }] }),
        addColumns({ table: 'harvests',     columns: [{ name: 'block_id', type: 'string', isOptional: true }] }),
      ],
    },
    {
      toVersion: 22,
      steps: [
        addColumns({
          table: 'project_blocks',
          columns: [
            { name: 'land_size', type: 'number', isOptional: true },
            { name: 'land_unit', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 23,
      steps: [
        addColumns({
          table: 'project_blocks',
          columns: [
            { name: 'crop', type: 'string', isOptional: true },
            { name: 'expected_yield', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 24,
      steps: [
        createTable({
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
        createTable({
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
      ],
    },
    {
      toVersion: 25,
      steps: [
        addColumns({
          table: 'farm_projects',
          columns: [{ name: 'crop_variety', type: 'string', isOptional: true }],
        }),
        addColumns({
          table: 'project_blocks',
          columns: [{ name: 'crop_variety', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 26,
      steps: [
        addColumns({
          table: 'harvests',
          columns: [
            { name: 'rejected_weight', type: 'number', isOptional: true },
            { name: 'rejected_reason', type: 'string', isOptional: true },
          ],
        }),
        createTable({
          name: 'sale_harvests',
          columns: [
            { name: 'sale_id',    type: 'string' },
            { name: 'harvest_id', type: 'string' },
            { name: 'is_deleted', type: 'boolean' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 27,
      steps: [
        addColumns({
          table: 'sales',
          columns: [{ name: 'block_id', type: 'string', isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 28,
      steps: [
        addColumns({
          table: 'project_access',
          columns: [
            { name: 'user_name', type: 'string', isOptional: true },
            { name: 'user_phone', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'farm_projects',
          columns: [
            { name: 'user_name', type: 'string', isOptional: true },
            { name: 'user_phone', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 29,
      steps: [
        createTable({
          name: 'equipments',
          columns: [
            { name: 'project_id',     type: 'string' },
            { name: 'name',           type: 'string' },
            { name: 'type',           type: 'string' },
            { name: 'model',          type: 'string', isOptional: true },
            { name: 'serial_number',  type: 'string', isOptional: true },
            { name: 'purchase_date',  type: 'number', isOptional: true },
            { name: 'purchase_price', type: 'number', isOptional: true },
            { name: 'status',         type: 'string' },
            { name: 'notes',          type: 'string', isOptional: true },
            { name: 'is_deleted',     type: 'boolean' },
            { name: 'created_at',     type: 'number' },
            { name: 'updated_at',     type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 30,
      steps: [
        addColumns({
          table: 'sales',
          columns: [
            { name: 'due_date', type: 'number', isOptional: true },
            { name: 'invoice_url', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'sale_payments',
          columns: [
            { name: 'method', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});


