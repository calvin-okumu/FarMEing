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
  ],
});
