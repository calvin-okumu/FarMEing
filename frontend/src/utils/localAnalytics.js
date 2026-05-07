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

export function computeProjectSummary({ budgetItems = [], expenses = [], workEntries = [], harvests = [], sales = [] } = {}) {
  const totalBudget = budgetItems.filter((item) => !item.isDeleted).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const totalExpenses = expenses.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalLaborCost = workEntries
    .filter((item) => !item.isDeleted)
    .reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const totalHarvest = harvests.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.weight || 0), 0);
  const totalRevenue = sales.filter((item) => !item.isDeleted).reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const totalCost = totalExpenses + totalLaborCost;

  return {
    totalBudget: parseFloat(totalBudget.toFixed(2)),
    totalExpenses: parseFloat(totalExpenses.toFixed(2)),
    totalLaborCost: parseFloat(totalLaborCost.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    totalHarvest: parseFloat(totalHarvest.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    netProfit: parseFloat((totalRevenue - totalCost).toFixed(2)),
  };
}
