const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const prisma = require('../lib/prisma');
const { verifyProjectAccess } = require('../lib/project-access');
const { t } = require('../lib/i18n');

const getProjectData = async (id, userId, res) => {
  const access = await verifyProjectAccess(id, userId, res);
  if (!access) return null;

  return await prisma.farmProject.findUnique({
    where: { id },
    include: {
      budgetItems: { where: { isDeleted: false } },
      expenses: { where: { isDeleted: false }, include: { payeeRecord: true } },
      workEntries: { where: { isDeleted: false }, include: { employee: true } },
      harvests: { where: { isDeleted: false }, include: { block: true } },
      sales: { where: { isDeleted: false }, include: { salePayments: { where: { isDeleted: false } } } },
      inventoryItems: { where: { isDeleted: false } },
      equipment: { where: { isDeleted: false } },
    },
  });
};

const generateProjectReport = async (req, res) => {
  const { id } = req.params;
  const lang = req.query.lang || 'en';

  try {
    const project = await getProjectData(id, req.user.id, res);
    if (!project) return;

    const doc = new PDFDocument({ margin: 50 });

    // Set filename
    const filename = `Report_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fontSize(24).text(t(lang, 'report_title'), { align: 'center' });
    doc.fontSize(10).text(t(lang, 'generated_by'), { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // ── Project Info ─────────────────────────────────────────────────────────
    doc.fontSize(16).text(project.name, { underline: true });
    doc.fontSize(12).text(`${t(lang, 'crop')}: ${project.crop || t(lang, 'n_a')}`);
    doc.text(`${t(lang, 'land_size')}: ${project.landSize} ${project.landUnit}`);
    doc.text(`${t(lang, 'status')}: ${project.status || 'Active'}`);
    doc.text(`${t(lang, 'date')}: ${project.startDate.toLocaleDateString()} - ${project.endDate ? project.endDate.toLocaleDateString() : t(lang, 'present')}`);
    doc.moveDown();

    // ── Financial Summary ────────────────────────────────────────────────────
    const totalBudget = project.budgetItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalExpenses = project.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalLabor = project.workEntries.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const totalInventory = project.inventoryItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const totalEquipment = project.equipment.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const totalRevenue = project.sales.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const totalCost = totalExpenses + totalLabor + totalInventory + totalEquipment;
    const netProfit = totalRevenue - totalCost;
    const collectedRevenue = project.sales.reduce((sum, item) => sum + ((item.totalAmount || 0) - (item.balanceDue || 0)), 0);
    const pendingRevenue = project.sales.reduce((sum, item) => sum + (item.balanceDue || 0), 0);

    doc.fontSize(16).text(t(lang, 'financial_summary'), { underline: true });
    doc.fontSize(12);
    doc.text(`${t(lang, 'total_revenue')}: ${totalRevenue.toLocaleString()}`);
    doc.text(`${t(lang, 'collected_revenue')}: ${collectedRevenue.toLocaleString()}${pendingRevenue > 0 ? ` (${pendingRevenue.toLocaleString()} ${t(lang, 'pending')})` : ''}`);
    doc.text(`${t(lang, 'total_spending')}: ${totalCost.toLocaleString()}`);
    doc.text(`${t(lang, 'net_profit_loss')}: ${netProfit.toLocaleString()}`, { 
      color: netProfit >= 0 ? 'green' : 'red' 
    });
    doc.moveDown();

    // ── Breakdown ────────────────────────────────────────────────────────────
    doc.text(`- ${t(lang, 'operational_expenses')}: ${totalExpenses.toLocaleString()}`);
    doc.text(`- ${t(lang, 'labor_costs')}: ${totalLabor.toLocaleString()}`);
    doc.text(`- ${t(lang, 'inventory_purchases')}: ${totalInventory.toLocaleString()}`);
    doc.text(`- ${t(lang, 'equipment_investments')}: ${totalEquipment.toLocaleString()}`);
    doc.moveDown();

    // ── Production & Yield Analysis ──────────────────────────────────────────
    const netHarvest = project.harvests.reduce((sum, item) => sum + (item.weight - (item.rejectedWeight || 0)), 0);
    const totalRejected = project.harvests.reduce((sum, item) => sum + (item.rejectedWeight || 0), 0);
    const expectedYield = project.expectedYield || 0;
    const yieldPerformance = expectedYield > 0 ? (netHarvest / expectedYield) * 100 : null;

    doc.fontSize(16).text(t(lang, 'production'), { underline: true });
    doc.fontSize(12).text(`${t(lang, 'approved_harvest')}: ${netHarvest.toLocaleString()} kg`);
    doc.text(`${t(lang, 'rejected')}: ${totalRejected.toLocaleString()} kg`);
    
    if (expectedYield > 0) {
      doc.moveDown(0.5);
      doc.fontSize(14).text(t(lang, 'actual_vs_expected'), { underline: true });
      doc.fontSize(12);
      doc.text(`${t(lang, 'expected_yield')}: ${expectedYield.toLocaleString()} kg`);
      doc.text(`Performance: ${yieldPerformance.toFixed(1)}% of target`);
    }
    
    // Labor Efficiency
    if (netHarvest > 0 && totalLabor > 0) {
      const laborEff = totalLabor / netHarvest;
      doc.moveDown(0.5);
      doc.text(`${t(lang, 'labor_efficiency')}: ${laborEff.toFixed(2)} / kg`);
    }
    doc.moveDown();

    // ── Top Suppliers (Vendor Analysis) ──────────────────────────────────────
    const supplierMap = {};
    project.expenses.forEach(e => {
      const name = e.payee || e.payeeRecord?.name || t(lang, 'n_a');
      supplierMap[name] = (supplierMap[name] || 0) + (e.amount || 0);
    });
    project.inventoryItems.forEach(i => {
      const name = i.payee || t(lang, 'n_a');
      supplierMap[name] = (supplierMap[name] || 0) + (i.totalCost || 0);
    });

    const topSuppliers = Object.entries(supplierMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topSuppliers.length > 0) {
      doc.fontSize(16).text(t(lang, 'top_suppliers'), { underline: true });
      doc.fontSize(12);
      topSuppliers.forEach(([name, amount]) => {
        doc.text(`- ${name}: ${amount.toLocaleString()}`);
      });
      doc.moveDown();
    }

    // ── Budget Breakdown ────────────────────────────────────────────────
    if (project.budgetItems.length > 0) {
      doc.fontSize(16).text(t(lang, 'budget_breakdown'), { underline: true });
      doc.fontSize(12);
      project.budgetItems.forEach(item => {
        doc.text(`- ${item.name} (${item.category}): ${item.quantity} ${item.unit} × ${item.unitPrice} = ${item.total}`);
      });
      doc.text(`Total Budget: ${totalBudget.toLocaleString()}`);
      doc.moveDown();
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.fontSize(10).text(t(lang, 'end_of_report'), doc.page.width - 100, doc.page.height - 50, { align: 'right' });

    doc.end();

  } catch (error) {
    console.error('PDF Export Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF report' });
    }
  }
};

const generateProjectExcelReport = async (req, res) => {
  const { id } = req.params;
  const lang = req.query.lang || 'en';

  try {
    const project = await getProjectData(id, req.user.id, res);
    if (!project) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shamba Mkononi';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: t(lang, 'property'), key: 'prop', width: 25 },
      { header: t(lang, 'value'), key: 'val', width: 30 },
    ];

    summarySheet.addRow({ prop: 'Project Name', val: project.name });
    summarySheet.addRow({ prop: t(lang, 'crop'), val: project.crop || t(lang, 'n_a') });
    summarySheet.addRow({ prop: t(lang, 'status'), val: project.status });
    summarySheet.addRow({ prop: t(lang, 'land_size'), val: `${project.landSize} ${project.landUnit}` });
    summarySheet.addRow({});

    // Financials
    const totalExpenses = project.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalLabor = project.workEntries.reduce((sum, w) => sum + (w.totalCost || 0), 0);
    const totalInventory = project.inventoryItems.reduce((sum, i) => sum + (i.totalCost || 0), 0);
    const totalEquipment = project.equipment.reduce((sum, eq) => sum + (eq.purchasePrice || 0), 0);
    const totalRevenue = project.sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalCost = totalExpenses + totalLabor + totalInventory + totalEquipment;
    const collectedRevenue = project.sales.reduce((sum, s) => sum + ((s.totalAmount || 0) - (s.balanceDue || 0)), 0);
    const pendingRevenue = project.sales.reduce((sum, s) => sum + (s.balanceDue || 0), 0);

    summarySheet.addRow({ prop: t(lang, 'total_revenue'), val: totalRevenue });
    summarySheet.addRow({ prop: t(lang, 'collected_revenue'), val: collectedRevenue });
    if (pendingRevenue > 0) summarySheet.addRow({ prop: `${t(lang, 'pending')} Revenue`, val: pendingRevenue });
    summarySheet.addRow({ prop: t(lang, 'total_spending'), val: totalCost });
    summarySheet.addRow({ prop: t(lang, 'net_profit_loss'), val: totalRevenue - totalCost });
    summarySheet.addRow({});

    // Yield Analysis
    if (project.expectedYield > 0) {
      summarySheet.addRow({ prop: t(lang, 'expected_yield'), val: `${project.expectedYield} kg` });
      summarySheet.addRow({ prop: t(lang, 'approved_harvest'), val: `${netHarvest} kg` });
      summarySheet.addRow({ prop: 'Yield Performance', val: `${((netHarvest / project.expectedYield) * 100).toFixed(1)}%` });
    }

    // Efficiency
    if (netHarvest > 0 && totalLabor > 0) {
      summarySheet.addRow({ prop: t(lang, 'labor_efficiency'), val: `${(totalLabor / netHarvest).toFixed(2)} / kg` });
    }

    // Expenses Sheet
    const expenseSheet = workbook.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: t(lang, 'date'), key: 'date', width: 15 },
      { header: t(lang, 'category'), key: 'category', width: 20 },
      { header: t(lang, 'payee'), key: 'payee', width: 25 },
      { header: t(lang, 'amount'), key: 'amount', width: 15 },
      { header: t(lang, 'note'), key: 'note', width: 40 },
    ];
    project.expenses.forEach(e => {
      expenseSheet.addRow({
        date: e.date.toLocaleDateString(),
        category: e.category,
        payee: e.payee || e.payeeRecord?.name || t(lang, 'n_a'),
        amount: e.amount,
        note: e.note
      });
    });
    expenseSheet.autoFilter = { from: 'A1', to: 'E1' };

    // Labor Sheet
    const laborSheet = workbook.addWorksheet('Labor');
    laborSheet.columns = [
      { header: t(lang, 'date'), key: 'date', width: 15 },
      { header: t(lang, 'worker'), key: 'name', width: 25 },
      { header: t(lang, 'activity'), key: 'activity', width: 25 },
      { header: t(lang, 'days'), key: 'days', width: 10 },
      { header: t(lang, 'cost'), key: 'cost', width: 15 },
    ];
    project.workEntries.forEach(w => {
      laborSheet.addRow({
        date: w.date.toLocaleDateString(),
        name: w.employee.name,
        activity: w.activity,
        days: w.daysWorked,
        cost: w.totalCost
      });
    });
    laborSheet.autoFilter = { from: 'A1', to: 'E1' };

    // Harvest Sheet
    if (project.harvests.length > 0) {
      const harvestSheet = workbook.addWorksheet('Harvest');
      harvestSheet.columns = [
        { header: t(lang, 'date'), key: 'date', width: 15 },
        { header: t(lang, 'block'), key: 'block', width: 20 },
        { header: t(lang, 'crop'), key: 'crop', width: 20 },
        { header: `${t(lang, 'approved')} ${t(lang, 'weight_kg')}`, key: 'weight', width: 20 },
        { header: `${t(lang, 'rejected')} ${t(lang, 'weight_kg')}`, key: 'rejected', width: 20 },
        { header: t(lang, 'notes'), key: 'notes', width: 40 },
      ];
      project.harvests.forEach(h => {
        const netWeight = h.weight - (h.rejectedWeight || 0);
        const rejWeight = h.rejectedWeight || 0;
        harvestSheet.addRow({
          date: h.date.toLocaleDateString(),
          block: h.block?.name || 'Overall',
          crop: h.crop,
          weight: netWeight,
          rejected: rejWeight,
          notes: h.notes
        });
      });
      harvestSheet.autoFilter = { from: 'A1', to: 'F1' };
    }

    // Sales Sheet
    if (project.sales.length > 0) {
      const salesSheet = workbook.addWorksheet('Sales');
      salesSheet.columns = [
        { header: t(lang, 'date'), key: 'date', width: 15 },
        { header: t(lang, 'customer'), key: 'customer', width: 25 },
        { header: t(lang, 'weight_kg'), key: 'weight', width: 15 },
        { header: t(lang, 'price'), key: 'price', width: 15 },
        { header: t(lang, 'amount'), key: 'total', width: 15 },
        { header: `${t(lang, 'status')} (Payment)`, key: 'status', width: 15 },
        { header: t(lang, 'due'), key: 'balance', width: 15 },
        { header: t(lang, 'notes'), key: 'notes', width: 40 },
      ];
      project.sales.forEach(s => {
        salesSheet.addRow({
          date: s.date.toLocaleDateString(),
          customer: s.customer || 'Cash',
          weight: s.weightSold,
          price: s.unitPrice,
          total: s.totalAmount,
          status: s.paymentStatus ? s.paymentStatus.charAt(0).toUpperCase() + s.paymentStatus.slice(1) : 'Paid',
          balance: s.balanceDue || 0,
          notes: s.notes
        });
      });
      salesSheet.autoFilter = { from: 'A1', to: 'H1' };
    }

    // Sale Payments Sheet
    const allPayments = project.sales.flatMap(s => (s.salePayments || []).map(p => ({ ...p, customer: s.customer || 'Cash' })));
    if (allPayments.length > 0) {
      const paymentsSheet = workbook.addWorksheet('Sale Payments');
      paymentsSheet.columns = [
        { header: t(lang, 'date'), key: 'date', width: 15 },
        { header: t(lang, 'customer'), key: 'customer', width: 25 },
        { header: t(lang, 'amount'), key: 'amount', width: 15 },
        { header: t(lang, 'note'), key: 'note', width: 40 },
      ];
      allPayments.forEach(p => {
        paymentsSheet.addRow({
          date: p.date.toLocaleDateString(),
          customer: p.customer,
          amount: p.amount,
          note: p.note || ''
        });
      });
      paymentsSheet.autoFilter = { from: 'A1', to: 'D1' };
    }

    // Budget Sheet
    if (project.budgetItems.length > 0) {
      const budgetSheet = workbook.addWorksheet('Budget');
      budgetSheet.columns = [
        { header: t(lang, 'category'), key: 'category', width: 20 },
        { header: t(lang, 'item'), key: 'item', width: 30 },
        { header: t(lang, 'quantity'), key: 'qty', width: 12 },
        { header: t(lang, 'unit'), key: 'unit', width: 10 },
        { header: t(lang, 'price'), key: 'price', width: 15 },
        { header: t(lang, 'total'), key: 'total', width: 15 },
      ];
      project.budgetItems.forEach(b => {
        budgetSheet.addRow({
          category: b.category,
          item: b.name,
          qty: b.quantity,
          unit: b.unit,
          price: b.unitPrice,
          total: b.total
        });
      });
      budgetSheet.autoFilter = { from: 'A1', to: 'F1' };
    }

    // Inventory Sheet
    if (project.inventoryItems.length > 0) {
      const inventorySheet = workbook.addWorksheet('Inventory');
      inventorySheet.columns = [
        { header: t(lang, 'item'), key: 'name', width: 25 },
        { header: t(lang, 'category'), key: 'category', width: 20 },
        { header: t(lang, 'quantity'), key: 'qty', width: 12 },
        { header: t(lang, 'unit'), key: 'unit', width: 10 },
        { header: t(lang, 'unit_cost'), key: 'cost', width: 15 },
        { header: t(lang, 'used_qty'), key: 'used', width: 12 },
        { header: t(lang, 'notes'), key: 'notes', width: 40 },
      ];
      project.inventoryItems.forEach(i => {
        inventorySheet.addRow({
          name: i.name,
          category: i.category,
          qty: i.quantity,
          unit: i.unit,
          cost: i.unitCost,
          used: i.usedQty,
          notes: i.notes
        });
      });
      inventorySheet.autoFilter = { from: 'A1', to: 'G1' };
    }

    // Equipment Sheet
    if (project.equipment.length > 0) {
      const equipSheet = workbook.addWorksheet('Equipment');
      equipSheet.columns = [
        { header: t(lang, 'item'), key: 'name', width: 25 },
        { header: t(lang, 'type'), key: 'type', width: 20 },
        { header: t(lang, 'model'), key: 'model', width: 20 },
        { header: t(lang, 'serial'), key: 'serial', width: 25 },
        { header: t(lang, 'date'), key: 'date', width: 15 },
        { header: t(lang, 'price'), key: 'price', width: 15 },
        { header: t(lang, 'status'), key: 'status', width: 15 },
      ];
      project.equipment.forEach(e => {
        equipSheet.addRow({
          name: e.name,
          type: e.type,
          model: e.model,
          serial: e.serialNumber,
          date: e.purchaseDate ? e.purchaseDate.toLocaleDateString() : t(lang, 'n_a'),
          price: e.purchasePrice,
          status: e.status
        });
      });
      equipSheet.autoFilter = { from: 'A1', to: 'G1' };
    }

    const filename = `Report_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel Export Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  }
};

module.exports = {
  generateProjectReport,
  generateProjectExcelReport,
};
