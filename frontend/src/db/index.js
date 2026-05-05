import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema      from './schema';
import migrations from './migrations';
import FarmProject from './models/FarmProject';
import BudgetItem  from './models/BudgetItem';
import Expense     from './models/Expense';
import WorkEntry   from './models/WorkEntry';
import Employee    from './models/Employee';
import Payment     from './models/Payment';
import Harvest     from './models/Harvest';
import Sale        from './models/Sale';
import InventoryItem from './models/InventoryItem';

// SQLiteAdapter uses expo-sqlite under the hood on Expo Go
const adapter = new SQLiteAdapter({
  schema,
  dbName: 'farmtrack',
  migrations,
  jsi: false,   // JSI off for Expo Go compatibility
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [FarmProject, BudgetItem, Expense, WorkEntry, Employee, Payment, Harvest, Sale, InventoryItem],
});

export async function resetLocalDatabase() {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
}

// Convenience collection getters
export const projectsCollection  = database.get('farm_projects');
export const budgetItemsCollection = database.get('budget_items');
export const expensesCollection  = database.get('expenses');
export const workEntriesCollection = database.get('work_entries');
export const employeesCollection = database.get('employees');
export const paymentsCollection = database.get('payments');
export const harvestsCollection = database.get('harvests');
export const salesCollection = database.get('sales');
export const inventoryCollection = database.get('inventory_items');
