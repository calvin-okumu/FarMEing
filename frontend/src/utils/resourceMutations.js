import { Q } from '@nozbe/watermelondb';
import { markRecordDeleted, markRecordUpdated } from './localRecord';

const PROJECT_BOUND_TABLES = [
  'budget_items',
  'expenses',
  'work_entries',
  'harvests',
  'sales',
  'inventory_items',
  'equipments',
  'project_access',
  'project_invitations',
];

export async function updateLocalModel(record, applyChanges) {
  await record.update((draft) => {
    applyChanges(draft);
    markRecordUpdated(draft);
  });
}

/**
 * Re-calculates a sale's total weight, amount, and balance based on linked harvests and payments.
 * Should be called within a database.write block.
 * @param {Sale} sale 
 * @param {Harvest} [updatedHarvest] - Optional freshly updated harvest to use instead of fetching
 */
export async function recalculateSale(sale, updatedHarvest = null) {
  const linkedHarvestLinks = await sale.saleHarvests.fetch();
  const payments = await sale.salePayments.fetch();

  let totalWeight = 0;
  for (const sh of linkedHarvestLinks) {
    if (sh.isDeleted) continue;
    
    let h;
    if (updatedHarvest && sh.harvestId === updatedHarvest.id) {
      h = updatedHarvest;
    } else {
      h = await sh.harvest.fetch();
    }

    if (h && !h.isDeleted) {
      totalWeight += (h.weight - (h.rejectedWeight || 0));
    }
  }

  const totalCollected = payments
    .filter(p => !p.isDeleted)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalAmount = totalWeight * (sale.unitPrice || 0);
  const balanceDue = Math.max(0, totalAmount - totalCollected);
  const paymentStatus = totalCollected <= 0 ? 'pending' : balanceDue <= 0 ? 'paid' : 'partial';

  await sale.update(draft => {
    draft.weightSold = totalWeight;
    draft.totalAmount = totalAmount;
    draft.balanceDue = balanceDue;
    draft.paymentStatus = paymentStatus;
    markRecordUpdated(draft);
  });
}

/**
 * Finds all sales linked to a harvest and recalculates them.
 * Should be called within a database.write block.
 * @param {Database} database
 * @param {string} harvestId
 * @param {Harvest} [harvestRecord] - Optional freshly updated harvest record
 */
export async function updateLinkedSalesWeights(database, harvestId, harvestRecord = null) {
  const saleHarvestLinks = await database.get('sale_harvests').query(
    Q.where('harvest_id', harvestId),
    Q.where('is_deleted', false)
  ).fetch();

  for (const sh of saleHarvestLinks) {
    const sale = await sh.sale.fetch();
    if (sale && !sale.isDeleted) {
      await recalculateSale(sale, harvestRecord);
    }
  }
}

export async function deleteLocalModel(record) {
  await record.update((draft) => {
    markRecordDeleted(draft);
  });
}

export async function deleteSaleCascade(sale) {
  const database = sale.database;
  const harvests = await sale.saleHarvests.fetch();
  const payments = await sale.salePayments.fetch();

  for (const sh of harvests) {
    await deleteLocalModel(sh);
  }
  for (const p of payments) {
    await deleteLocalModel(p);
  }
  await deleteLocalModel(sale);
}

export async function deleteProjectCascade(database, projectId) {
  await database.write(async () => {
    const projectRecord = await database.get('farm_projects').find(projectId);
    
    // Child records with project_id
    for (const table of PROJECT_BOUND_TABLES) {
      const related = await database.get(table).query(
        Q.where('project_id', projectId),
        Q.where('is_deleted', false)
      ).fetch();

      for (const record of related) {
        if (table === 'sales') {
          await deleteSaleCascade(record);
        } else {
          await deleteLocalModel(record);
        }
      }
    }

    await deleteLocalModel(projectRecord);
  });
}
