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
      expenses: {
        where: { isDeleted: false },
        include: { payeeRecord: true, block: { select: { id: true, name: true } } },
      },
      workEntries: {
        where: { isDeleted: false },
        include: { employee: true, block: { select: { id: true, name: true } } },
      },
      harvests: {
        where: { isDeleted: false },
        include: { block: { select: { id: true, name: true } } },
      },
      sales: {
        where: { isDeleted: false },
        include: { salePayments: { where: { isDeleted: false } }, block: { select: { id: true, name: true } } },
      },
      inventoryItems: { where: { isDeleted: false } },
      equipment: { where: { isDeleted: false } },
      blocks: { where: { isDeleted: false } },
      season: true,
      projectAccess: {
        where: { isDeleted: false },
        include: { user: { select: { id: true, name: true, phone: true } } },
      },
      employees: {
        where: { isDeleted: false },
        include: {
          employee: {
            include: { payments: { where: { isDeleted: false } } },
          },
        },
      },
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

    const filename = `Report_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // ── Computed values ──────────────────────────────────────────────────────
    const totalBudget = project.budgetItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalExpenses = project.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const capex = project.expenses.filter(e => e.expenseType === 'CAPEX').reduce((s, e) => s + (e.amount || 0), 0);
    const opex = totalExpenses - capex;
    const approvedLabor = project.workEntries.filter(w => w.status === 'APPROVED').reduce((s, w) => s + (w.totalCost || 0), 0);
    const pendingLabor = project.workEntries.filter(w => w.status === 'PENDING').reduce((s, w) => s + (w.totalCost || 0), 0);
    const totalLabor = approvedLabor + pendingLabor;
    const totalInventory = project.inventoryItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
    const totalEquipment = project.equipment.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const totalRevenue = project.sales.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const totalCost = totalExpenses + totalLabor + totalInventory + totalEquipment;
    const netProfit = totalRevenue - totalCost;
    const collectedRevenue = project.sales.reduce((sum, item) => sum + ((item.totalAmount || 0) - (item.balanceDue || 0)), 0);
    const pendingRevenue = project.sales.reduce((sum, item) => sum + (item.balanceDue || 0), 0);
    const totalRejected = project.harvests.reduce((sum, item) => sum + (item.rejectedWeight || 0), 0);
    const netHarvest = project.harvests.reduce((sum, item) => sum + (item.weight - (item.rejectedWeight || 0)), 0);
    const expectedYield = project.expectedYield || 0;
    const yieldPerformance = expectedYield > 0 ? (netHarvest / expectedYield) * 100 : null;

    // Employee payments
    const empPaymentMap = {};
    project.employees.forEach(ep => {
      const emp = ep.employee;
      if (!empPaymentMap[emp.id]) {
        empPaymentMap[emp.id] = { name: emp.name, earned: 0, paid: 0 };
      }
      emp.payments.forEach(p => {
        empPaymentMap[emp.id].paid += p.amount || 0;
      });
    });
    project.workEntries.forEach(w => {
      if (empPaymentMap[w.employee?.id]) {
        empPaymentMap[w.employee.id].earned += w.totalCost || 0;
      }
    });
    const totalEarned = Object.values(empPaymentMap).reduce((s, e) => s + e.earned, 0);
    const totalPaid = Object.values(empPaymentMap).reduce((s, e) => s + e.paid, 0);
    const outstandingPay = totalEarned - totalPaid;

    // Budget vs Actual by category
    const budgetCatMap = {};
    project.budgetItems.forEach(b => {
      budgetCatMap[b.category] = budgetCatMap[b.category] || { planned: 0, spent: 0 };
      budgetCatMap[b.category].planned += b.total || 0;
    });
    project.expenses.forEach(e => {
      budgetCatMap[e.category] = budgetCatMap[e.category] || { planned: 0, spent: 0 };
      budgetCatMap[e.category].spent += e.amount || 0;
    });

    // Rejection reasons
    const rejectionReasons = {};
    project.harvests.forEach(h => {
      if (h.rejectedReason && h.rejectedWeight) {
        rejectionReasons[h.rejectedReason] = (rejectionReasons[h.rejectedReason] || 0) + h.rejectedWeight;
      }
    });

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fontSize(24).text(t(lang, 'report_title'), { align: 'center' });
    doc.fontSize(10).text(t(lang, 'generated_by'), { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // ── Project Info ─────────────────────────────────────────────────────────
    doc.fontSize(16).text(project.name, { underline: true });
    doc.fontSize(12);
    doc.text(`${t(lang, 'crop')}: ${project.crop || t(lang, 'n_a')}${project.cropVariety ? ` (${project.cropVariety})` : ''}`);
    doc.text(`${t(lang, 'land_size')}: ${project.landSize} ${project.landUnit}`);
    doc.text(`${t(lang, 'status')}: ${project.status || 'Active'}`);
    doc.text(`${t(lang, 'date')}: ${project.startDate.toLocaleDateString()} - ${project.endDate ? project.endDate.toLocaleDateString() : t(lang, 'present')}`);
    if (project.season) {
      doc.text(`${t(lang, 'season')}: ${project.season.name}`);
    }
    doc.moveDown();

    // ── Financial Summary ────────────────────────────────────────────────────
    doc.fontSize(16).text(t(lang, 'financial_summary'), { underline: true });
    doc.fontSize(12);
    doc.text(`${t(lang, 'total_revenue')}: ${totalRevenue.toLocaleString()}`);
    doc.text(`${t(lang, 'collected_revenue')}: ${collectedRevenue.toLocaleString()}${pendingRevenue > 0 ? ` (${pendingRevenue.toLocaleString()} ${t(lang, 'pending')})` : ''}`);
    doc.text(`${t(lang, 'total_spending')}: ${totalCost.toLocaleString()}`);
    doc.text(`${t(lang, 'net_profit_loss')}: ${netProfit.toLocaleString()}`, {
      color: netProfit >= 0 ? 'green' : 'red'
    });
    doc.moveDown();

    doc.text(`- ${t(lang, 'operational_expenses')} (OPEX): ${opex.toLocaleString()}`);
    doc.text(`- ${t(lang, 'capital_expenses')} (CAPEX): ${capex.toLocaleString()}`);
    doc.text(`- ${t(lang, 'approved_labor')}: ${approvedLabor.toLocaleString()}`);
    if (pendingLabor > 0) {
      doc.text(`- ${t(lang, 'pending_labor')}: ${pendingLabor.toLocaleString()}`);
    }
    doc.text(`- ${t(lang, 'inventory_purchases')}: ${totalInventory.toLocaleString()}`);
    doc.text(`- ${t(lang, 'equipment_investments')}: ${totalEquipment.toLocaleString()}`);
    doc.moveDown();

    // ── Employee Payments Summary ────────────────────────────────────────────
    if (outstandingPay > 0 || totalPaid > 0) {
      doc.fontSize(16).text(t(lang, 'employee_payments'), { underline: true });
      doc.fontSize(12);
      doc.text(`${t(lang, 'total_earned')}: ${totalEarned.toLocaleString()}`);
      doc.text(`${t(lang, 'total_paid')}: ${totalPaid.toLocaleString()}`);
      doc.text(`${t(lang, 'outstanding')}: ${outstandingPay.toLocaleString()}`, {
        color: outstandingPay > 0 ? 'red' : 'green'
      });
      doc.moveDown();
    }

    // ── Production & Yield Analysis ──────────────────────────────────────────
    doc.fontSize(16).text(t(lang, 'production'), { underline: true });
    doc.fontSize(12).text(`${t(lang, 'approved_harvest')}: ${netHarvest.toLocaleString()} kg`);
    doc.text(`${t(lang, 'rejected')}: ${totalRejected.toLocaleString()} kg`);
    if (netHarvest > 0 && totalRejected > 0) {
      doc.text(`Rejection Rate: ${((totalRejected / (netHarvest + totalRejected)) * 100).toFixed(1)}%`);
    }

    if (expectedYield > 0) {
      doc.moveDown(0.5);
      doc.fontSize(14).text(t(lang, 'actual_vs_expected'), { underline: true });
      doc.fontSize(12);
      doc.text(`${t(lang, 'expected_yield')}: ${expectedYield.toLocaleString()} kg`);
      doc.text(`Performance: ${yieldPerformance.toFixed(1)}% of target`);
    }

    if (netHarvest > 0 && totalCost > 0) {
      doc.moveDown(0.5);
      doc.text(`Cost per kg: ${(totalCost / netHarvest).toFixed(2)}`);
    }

    if (netHarvest > 0 && totalLabor > 0) {
      doc.text(`${t(lang, 'labor_efficiency')}: ${(totalLabor / netHarvest).toFixed(2)} / kg`);
    }
    doc.moveDown();

    // ── Rejection Reasons ────────────────────────────────────────────────────
    const rejectionEntries = Object.entries(rejectionReasons).sort((a, b) => b[1] - a[1]);
    if (rejectionEntries.length > 0) {
      doc.fontSize(16).text(t(lang, 'rejected'), { underline: true });
      doc.fontSize(12);
      rejectionEntries.forEach(([reason, weight]) => {
        doc.text(`- ${reason}: ${weight.toLocaleString()} kg`);
      });
      doc.moveDown();
    }

    // ── Budget vs Actual by Category ─────────────────────────────────────────
    const budgetCatEntries = Object.entries(budgetCatMap).sort((a, b) => b[1].planned - a[1].planned);
    if (budgetCatEntries.length > 0) {
      doc.fontSize(16).text(t(lang, 'budget_vs_actual'), { underline: true });
      doc.fontSize(12);
      budgetCatEntries.forEach(([cat, vals]) => {
        const variance = vals.planned - vals.spent;
        const pct = vals.planned > 0 ? ((vals.spent / vals.planned) * 100).toFixed(0) : '-';
        doc.text(`- ${cat}: ${t(lang, 'planned')} ${vals.planned.toLocaleString()} | ${t(lang, 'spent')} ${vals.spent.toLocaleString()} (${pct}%) | ${t(lang, 'variance')} ${variance.toLocaleString()}`);
      });
      doc.moveDown();
    }

    // ── Top Suppliers ────────────────────────────────────────────────────────
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

    // ── Budget Breakdown ─────────────────────────────────────────────────────
    if (project.budgetItems.length > 0) {
      doc.fontSize(16).text(t(lang, 'budget_breakdown'), { underline: true });
      doc.fontSize(12);
      project.budgetItems.forEach(item => {
        doc.text(`- ${item.name} (${item.category}): ${item.quantity} ${item.unit} × ${item.unitPrice} = ${item.total}`);
      });
      doc.text(`Total ${t(lang, 'budget_breakdown')}: ${totalBudget.toLocaleString()}`);
      doc.moveDown();
    }

    // ── Team Members ─────────────────────────────────────────────────────────
    if (project.projectAccess.length > 0) {
      doc.fontSize(16).text(t(lang, 'team_members'), { underline: true });
      doc.fontSize(12);
      project.projectAccess.forEach(pa => {
        doc.text(`- ${pa.user?.name || pa.userName || t(lang, 'n_a')} (${pa.role})${pa.user?.phone ? ` - ${pa.user.phone}` : ''}`);
      });
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

    // ── Computed values ──────────────────────────────────────────────────────
    const totalExpenses = project.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const capex = project.expenses.filter(e => e.expenseType === 'CAPEX').reduce((s, e) => s + (e.amount || 0), 0);
    const opex = totalExpenses - capex;
    const approvedLabor = project.workEntries.filter(w => w.status === 'APPROVED').reduce((s, w) => s + (w.totalCost || 0), 0);
    const pendingLabor = project.workEntries.filter(w => w.status === 'PENDING').reduce((s, w) => s + (w.totalCost || 0), 0);
    const totalLabor = approvedLabor + pendingLabor;
    const totalInventory = project.inventoryItems.reduce((sum, i) => sum + (i.totalCost || 0), 0);
    const totalEquipment = project.equipment.reduce((sum, eq) => sum + (eq.purchasePrice || 0), 0);
    const totalRevenue = project.sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalCost = totalExpenses + totalLabor + totalInventory + totalEquipment;
    const collectedRevenue = project.sales.reduce((sum, s) => sum + ((s.totalAmount || 0) - (s.balanceDue || 0)), 0);
    const pendingRevenue = project.sales.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
    const netHarvest = project.harvests.reduce((sum, item) => sum + (item.weight - (item.rejectedWeight || 0)), 0);
    const totalRejected = project.harvests.reduce((sum, item) => sum + (item.rejectedWeight || 0), 0);

    // Employee payments
    const empPaymentMap = {};
    project.employees.forEach(ep => {
      const emp = ep.employee;
      if (!empPaymentMap[emp.id]) {
        empPaymentMap[emp.id] = { name: emp.name, earned: 0, paid: 0 };
      }
      emp.payments.forEach(p => {
        empPaymentMap[emp.id].paid += p.amount || 0;
      });
    });
    project.workEntries.forEach(w => {
      if (empPaymentMap[w.employee?.id]) {
        empPaymentMap[w.employee.id].earned += w.totalCost || 0;
      }
    });
    const totalEarned = Object.values(empPaymentMap).reduce((s, e) => s + e.earned, 0);
    const totalPaid = Object.values(empPaymentMap).reduce((s, e) => s + e.paid, 0);

    // Budget vs Actual by category
    const budgetCatMap = {};
    project.budgetItems.forEach(b => {
      budgetCatMap[b.category] = budgetCatMap[b.category] || { planned: 0, spent: 0 };
      budgetCatMap[b.category].planned += b.total || 0;
    });
    project.expenses.forEach(e => {
      budgetCatMap[e.category] = budgetCatMap[e.category] || { planned: 0, spent: 0 };
      budgetCatMap[e.category].spent += e.amount || 0;
    });

    // Block-level aggregation
    const blockData = {};
    (project.blocks || []).forEach(b => { blockData[b.id] = { name: b.name, expenses: 0, labor: 0, harvest: 0, revenue: 0 }; });
    blockData['_none'] = { name: 'Overall', expenses: 0, labor: 0, harvest: 0, revenue: 0 };
    project.expenses.forEach(e => {
      const key = e.blockId || '_none';
      if (!blockData[key]) blockData[key] = { name: e.block?.name || 'Overall', expenses: 0, labor: 0, harvest: 0, revenue: 0 };
      blockData[key].expenses += e.amount || 0;
    });
    project.workEntries.forEach(w => {
      const key = w.blockId || '_none';
      if (!blockData[key]) blockData[key] = { name: w.block?.name || 'Overall', expenses: 0, labor: 0, harvest: 0, revenue: 0 };
      blockData[key].labor += w.totalCost || 0;
    });
    project.harvests.forEach(h => {
      const key = h.blockId || '_none';
      if (!blockData[key]) blockData[key] = { name: h.block?.name || 'Overall', expenses: 0, labor: 0, harvest: 0, revenue: 0 };
      blockData[key].harvest += (h.weight - (h.rejectedWeight || 0)) || 0;
    });
    project.sales.forEach(s => {
      const key = s.blockId || '_none';
      if (!blockData[key]) blockData[key] = { name: s.block?.name || 'Overall', expenses: 0, labor: 0, harvest: 0, revenue: 0 };
      blockData[key].revenue += s.totalAmount || 0;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Shamba Mkononi';
    workbook.created = new Date();

    // ── Summary Sheet ────────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet(t(lang, 'report_summary'));
    summarySheet.columns = [
      { header: t(lang, 'property'), key: 'prop', width: 30 },
      { header: t(lang, 'value'), key: 'val', width: 35 },
    ];

    summarySheet.addRow({ prop: 'Project Name', val: project.name });
    summarySheet.addRow({ prop: t(lang, 'crop'), val: project.crop || t(lang, 'n_a') });
    if (project.cropVariety) summarySheet.addRow({ prop: 'Crop Variety', val: project.cropVariety });
    summarySheet.addRow({ prop: t(lang, 'status'), val: project.status });
    summarySheet.addRow({ prop: t(lang, 'land_size'), val: `${project.landSize} ${project.landUnit}` });
    if (project.season) summarySheet.addRow({ prop: t(lang, 'season'), val: project.season.name });
    summarySheet.addRow({});
    summarySheet.addRow({ prop: t(lang, 'financial_summary'), val: '' });

    summarySheet.addRow({ prop: t(lang, 'total_revenue'), val: totalRevenue });
    summarySheet.addRow({ prop: t(lang, 'collected_revenue'), val: collectedRevenue });
    if (pendingRevenue > 0) summarySheet.addRow({ prop: `${t(lang, 'pending')} Revenue`, val: pendingRevenue });
    summarySheet.addRow({ prop: t(lang, 'operational_expenses') + ' (OPEX)', val: opex });
    summarySheet.addRow({ prop: t(lang, 'capital_expenses') + ' (CAPEX)', val: capex });
    summarySheet.addRow({ prop: t(lang, 'approved_labor'), val: approvedLabor });
    if (pendingLabor > 0) summarySheet.addRow({ prop: t(lang, 'pending_labor'), val: pendingLabor });
    summarySheet.addRow({ prop: t(lang, 'inventory_purchases'), val: totalInventory });
    summarySheet.addRow({ prop: t(lang, 'equipment_investments'), val: totalEquipment });
    summarySheet.addRow({ prop: t(lang, 'total_spending'), val: totalCost });
    summarySheet.addRow({ prop: t(lang, 'net_profit_loss'), val: totalRevenue - totalCost });
    summarySheet.addRow({});

    // Employee payment summary on summary sheet
    summarySheet.addRow({ prop: t(lang, 'employee_payments'), val: '' });
    summarySheet.addRow({ prop: t(lang, 'total_earned'), val: totalEarned });
    summarySheet.addRow({ prop: t(lang, 'total_paid'), val: totalPaid });
    summarySheet.addRow({ prop: t(lang, 'outstanding'), val: totalEarned - totalPaid });
    summarySheet.addRow({});

    // Yield on summary sheet
    summarySheet.addRow({ prop: t(lang, 'production'), val: '' });
    summarySheet.addRow({ prop: t(lang, 'approved_harvest'), val: `${netHarvest} kg` });
    summarySheet.addRow({ prop: t(lang, 'rejected'), val: `${totalRejected} kg` });
    if (netHarvest > 0 && totalRejected > 0) {
      summarySheet.addRow({ prop: 'Rejection Rate', val: `${((totalRejected / (netHarvest + totalRejected)) * 100).toFixed(1)}%` });
    }
    if (project.expectedYield > 0) {
      summarySheet.addRow({ prop: t(lang, 'expected_yield'), val: `${project.expectedYield} kg` });
      summarySheet.addRow({ prop: 'Yield Performance', val: `${((netHarvest / project.expectedYield) * 100).toFixed(1)}%` });
    }
    if (netHarvest > 0 && totalCost > 0) {
      summarySheet.addRow({ prop: 'Cost per kg', val: (totalCost / netHarvest).toFixed(2) });
    }
    if (netHarvest > 0 && totalLabor > 0) {
      summarySheet.addRow({ prop: t(lang, 'labor_efficiency'), val: `${(totalLabor / netHarvest).toFixed(2)} / kg` });
    }

    // ── Expenses Sheet ───────────────────────────────────────────────────────
    const expenseSheet = workbook.addWorksheet('Expenses');
    expenseSheet.columns = [
      { header: t(lang, 'date'), key: 'date', width: 15 },
      { header: t(lang, 'category'), key: 'category', width: 20 },
      { header: t(lang, 'expense_type'), key: 'expenseType', width: 12 },
      { header: t(lang, 'payee'), key: 'payee', width: 25 },
      { header: t(lang, 'amount'), key: 'amount', width: 15 },
      { header: t(lang, 'recurring'), key: 'recurring', width: 12 },
      { header: t(lang, 'note'), key: 'note', width: 40 },
    ];
    project.expenses.forEach(e => {
      expenseSheet.addRow({
        date: e.date.toLocaleDateString(),
        category: e.category,
        expenseType: e.expenseType,
        payee: e.payee || e.payeeRecord?.name || t(lang, 'n_a'),
        amount: e.amount,
        recurring: e.isRecurring ? t(lang, 'yes') : '',
        note: e.note
      });
    });
    expenseSheet.autoFilter = { from: 'A1', to: 'G1' };

    // ── Labor Sheet ──────────────────────────────────────────────────────────
    const laborSheet = workbook.addWorksheet('Labor');
    laborSheet.columns = [
      { header: t(lang, 'date'), key: 'date', width: 15 },
      { header: t(lang, 'worker'), key: 'name', width: 25 },
      { header: t(lang, 'activity'), key: 'activity', width: 20 },
      { header: t(lang, 'days'), key: 'days', width: 10 },
      { header: t(lang, 'cost'), key: 'cost', width: 15 },
      { header: t(lang, 'labor_status'), key: 'status', width: 12 },
      { header: t(lang, 'paid'), key: 'paid', width: 10 },
    ];
    project.workEntries.forEach(w => {
      laborSheet.addRow({
        date: w.date.toLocaleDateString(),
        name: w.employee?.name || t(lang, 'n_a'),
        activity: w.activity,
        days: w.daysWorked,
        cost: w.totalCost,
        status: w.status,
        paid: w.isPaid ? t(lang, 'yes') : '',
      });
    });
    laborSheet.autoFilter = { from: 'A1', to: 'G1' };

    // ── Harvest Sheet ────────────────────────────────────────────────────────
    if (project.harvests.length > 0) {
      const harvestSheet = workbook.addWorksheet('Harvest');
      harvestSheet.columns = [
        { header: t(lang, 'date'), key: 'date', width: 15 },
        { header: t(lang, 'block'), key: 'block', width: 20 },
        { header: t(lang, 'crop'), key: 'crop', width: 20 },
        { header: `${t(lang, 'approved')} ${t(lang, 'weight_kg')}`, key: 'weight', width: 18 },
        { header: `${t(lang, 'rejected')} ${t(lang, 'weight_kg')}`, key: 'rejected', width: 18 },
        { header: t(lang, 'quality'), key: 'quality', width: 12 },
        { header: t(lang, 'rejection_reason'), key: 'rejReason', width: 20 },
        { header: t(lang, 'notes'), key: 'notes', width: 35 },
      ];
      project.harvests.forEach(h => {
        harvestSheet.addRow({
          date: h.date.toLocaleDateString(),
          block: h.block?.name || 'Overall',
          crop: h.crop,
          weight: h.weight - (h.rejectedWeight || 0),
          rejected: h.rejectedWeight || 0,
          quality: h.quality || '',
          rejReason: h.rejectedReason || '',
          notes: h.notes
        });
      });
      harvestSheet.autoFilter = { from: 'A1', to: 'H1' };
    }

    // ── Sales Sheet ──────────────────────────────────────────────────────────
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

    // ── Sale Payments Sheet ──────────────────────────────────────────────────
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

    // ── Budget Sheet ─────────────────────────────────────────────────────────
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

    // ── Inventory Sheet ──────────────────────────────────────────────────────
    if (project.inventoryItems.length > 0) {
      const inventorySheet = workbook.addWorksheet('Inventory');
      inventorySheet.columns = [
        { header: t(lang, 'item'), key: 'name', width: 25 },
        { header: t(lang, 'category'), key: 'category', width: 20 },
        { header: t(lang, 'quantity'), key: 'qty', width: 12 },
        { header: t(lang, 'unit'), key: 'unit', width: 10 },
        { header: t(lang, 'unit_cost'), key: 'cost', width: 15 },
        { header: t(lang, 'used_qty'), key: 'used', width: 12 },
        { header: t(lang, 'remaining_qty'), key: 'remaining', width: 12 },
        { header: t(lang, 'notes'), key: 'notes', width: 35 },
      ];
      project.inventoryItems.forEach(i => {
        inventorySheet.addRow({
          name: i.name,
          category: i.category,
          qty: i.quantity,
          unit: i.unit,
          cost: i.unitCost,
          used: i.usedQty,
          remaining: (i.quantity || 0) - (i.usedQty || 0),
          notes: i.notes
        });
      });
      inventorySheet.autoFilter = { from: 'A1', to: 'H1' };
    }

    // ── Equipment Sheet ──────────────────────────────────────────────────────
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

    // ── Budget vs Actual Sheet ──────────────────────────────────────────────
    const budgetCatEntries = Object.entries(budgetCatMap)
      .map(([cat, vals]) => ({
        category: cat,
        planned: vals.planned,
        spent: vals.spent,
        variance: vals.planned - vals.spent,
        utilization: vals.planned > 0 ? `${((vals.spent / vals.planned) * 100).toFixed(0)}%` : '-',
      }))
      .sort((a, b) => b.planned - a.planned);

    if (budgetCatEntries.length > 0) {
      const bvaSheet = workbook.addWorksheet(t(lang, 'budget_vs_actual'));
      bvaSheet.columns = [
        { header: t(lang, 'category'), key: 'category', width: 25 },
        { header: t(lang, 'planned'), key: 'planned', width: 18 },
        { header: t(lang, 'spent'), key: 'spent', width: 18 },
        { header: t(lang, 'variance'), key: 'variance', width: 18 },
        { header: '% Utilized', key: 'utilization', width: 14 },
      ];
      budgetCatEntries.forEach(row => bvaSheet.addRow(row));
      bvaSheet.autoFilter = { from: 'A1', to: 'E1' };
    }

    // ── Employee Payment Summary Sheet ──────────────────────────────────────
    const empPaymentRows = Object.values(empPaymentMap)
      .map(emp => ({
        employee: emp.name,
        earned: emp.earned,
        paid: emp.paid,
        outstanding: emp.earned - emp.paid,
      }))
      .filter(r => r.earned > 0 || r.paid > 0)
      .sort((a, b) => b.outstanding - a.outstanding);

    if (empPaymentRows.length > 0) {
      const empSheet = workbook.addWorksheet(t(lang, 'employee_payments'));
      empSheet.columns = [
        { header: t(lang, 'employee'), key: 'employee', width: 25 },
        { header: t(lang, 'total_earned'), key: 'earned', width: 18 },
        { header: t(lang, 'total_paid'), key: 'paid', width: 18 },
        { header: t(lang, 'outstanding'), key: 'outstanding', width: 18 },
      ];
      empPaymentRows.forEach(row => empSheet.addRow(row));
      empSheet.autoFilter = { from: 'A1', to: 'D1' };
    }

    // ── Block Profitability Sheet ───────────────────────────────────────────
    const blockRows = Object.values(blockData)
      .map(b => ({
        block: b.name,
        expenses: b.expenses,
        labor: b.labor,
        harvest: b.harvest,
        revenue: b.revenue,
        profit: b.revenue - b.expenses - b.labor,
      }))
      .sort((a, b) => b.profit - a.profit);

    if (blockRows.length > 1) {
      const blockSheet = workbook.addWorksheet(t(lang, 'block_profitability'));
      blockSheet.columns = [
        { header: t(lang, 'block'), key: 'block', width: 20 },
        { header: t(lang, 'block_expenses'), key: 'expenses', width: 16 },
        { header: t(lang, 'block_labor'), key: 'labor', width: 16 },
        { header: `${t(lang, 'block_harvest')}`, key: 'harvest', width: 16 },
        { header: t(lang, 'block_revenue'), key: 'revenue', width: 16 },
        { header: t(lang, 'block_profit'), key: 'profit', width: 16 },
      ];
      blockRows.forEach(row => blockSheet.addRow(row));
      blockSheet.autoFilter = { from: 'A1', to: 'F1' };
    }

    // ── Team Members Sheet ───────────────────────────────────────────────────
    if (project.projectAccess.length > 0) {
      const teamSheet = workbook.addWorksheet(t(lang, 'team_members'));
      teamSheet.columns = [
        { header: t(lang, 'user'), key: 'name', width: 25 },
        { header: t(lang, 'role'), key: 'role', width: 15 },
        { header: 'Phone', key: 'phone', width: 20 },
      ];
      project.projectAccess.forEach(pa => {
        teamSheet.addRow({
          name: pa.user?.name || pa.userName || t(lang, 'n_a'),
          role: pa.role,
          phone: pa.user?.phone || pa.userPhone || '',
        });
      });
      teamSheet.autoFilter = { from: 'A1', to: 'C1' };
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
