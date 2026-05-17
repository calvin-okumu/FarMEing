# Data Aggregation Patterns

Common metrics used in farm reports.

## Financials

### Total Revenue
```javascript
const totalRevenue = project.sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
```

### Total Cost
```javascript
const totalExpenses = project.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
const totalLabor = project.workEntries.reduce((sum, w) => sum + (w.totalCost || 0), 0);
const totalCost = totalExpenses + totalLabor + (totalInventory || 0);
```

### Net Profit
```javascript
const netProfit = totalRevenue - totalCost;
```

## Production

### Total Harvest
```javascript
const totalHarvest = project.harvests.reduce((sum, h) => sum + (h.weight || 0), 0);
```

### Harvest by Crop
```javascript
const harvestByCrop = {};
project.harvests.forEach(h => {
  harvestByCrop[h.crop] = (harvestByCrop[h.crop] || 0) + (h.weight || 0);
});
```

## Tips
- Always use `|| 0` when reducing to avoid `NaN` if data is missing.
- Perform aggregations BEFORE starting document generation to keep the logic clean.
- Filter for `isDeleted: false` in your Prisma queries or during aggregation.
