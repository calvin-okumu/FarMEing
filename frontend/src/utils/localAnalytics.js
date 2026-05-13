export function computeEmployeeBalance(workEntries = [], payments = []) {
  const totalEarned = workEntries
    .filter((item) => !item.isDeleted)
    .reduce((sum, item) => sum + (item.totalCost || 0), 0);

  const totalPaid = payments
    .filter((item) => !item.isDeleted)
    .reduce((sum, item) => sum + (item.amount || 0), 0);

  return {
    totalEarned: parseFloat(totalEarned.toFixed(2)),
    totalPaid: parseFloat(totalPaid.toFixed(2)),
    outstanding: parseFloat((totalEarned - totalPaid).toFixed(2)),
  };
}

export function computeProjectSummary({ budgetItems = [], expenses = [], workEntries = [], harvests = [], sales = [], inventoryItems = [], salePayments = [] } = {}) {
  const totalBudget = budgetItems.filter((item) => !item.isDeleted).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const totalExpenses = expenses.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalLaborCost = workEntries
    .filter((item) => !item.isDeleted)
    .reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const totalInventoryCost = inventoryItems.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const totalHarvest = harvests.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.weight || 0), 0);
  const totalRevenue = sales.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const collectedFromPayments = salePayments.length > 0
    ? salePayments.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.amount || 0), 0)
    : 0;
  const collectedRevenue = collectedFromPayments > 0
    ? collectedFromPayments
    : sales.filter((item) => !item.isDeleted).reduce((sum, item) => sum + ((item.totalAmount || 0) - (item.balanceDue || 0)), 0);
  const pendingRevenue = Math.max(0, totalRevenue - collectedRevenue);
  const totalCost = totalExpenses + totalLaborCost + totalInventoryCost;

  return {
    totalBudget: parseFloat(totalBudget.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    totalLaborCost: parseFloat(totalLaborCost.toFixed(2)),
    totalInventoryCost: parseFloat(totalInventoryCost.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    totalHarvest: parseFloat(totalHarvest.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    collectedRevenue: parseFloat(collectedRevenue.toFixed(2)),
    pendingRevenue: parseFloat(pendingRevenue.toFixed(2)),
    netProfit: parseFloat((totalRevenue - totalCost).toFixed(2)),
  };
}

export function computePortfolioSummary(projectsData = []) {
  // projectsData is an array of summaries returned by computeProjectSummary
  const initial = {
    totalBudget: 0,
    totalExpenses: 0,
    totalLaborCost: 0,
    totalInventoryCost: 0,
    totalCost: 0,
    totalHarvest: 0,
    totalRevenue: 0,
    collectedRevenue: 0,
    pendingRevenue: 0,
    netProfit: 0,
    projectCount: projectsData.length,
  };

  return projectsData.reduce((acc, curr) => ({
    totalBudget: acc.totalBudget + curr.totalBudget,
    totalExpenses: acc.totalExpenses + curr.totalExpenses,
    totalLaborCost: acc.totalLaborCost + curr.totalLaborCost,
    totalInventoryCost: acc.totalInventoryCost + curr.totalInventoryCost,
    totalCost: acc.totalCost + curr.totalCost,
    totalHarvest: acc.totalHarvest + curr.totalHarvest,
    totalRevenue: acc.totalRevenue + curr.totalRevenue,
    collectedRevenue: acc.collectedRevenue + (curr.collectedRevenue || 0),
    pendingRevenue: acc.pendingRevenue + (curr.pendingRevenue || 0),
    netProfit: acc.netProfit + curr.netProfit,
    projectCount: acc.projectCount,
  }), initial);
}
