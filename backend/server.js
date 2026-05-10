require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes     = require('./src/routes/auth.routes');
const projectRoutes  = require('./src/routes/project.routes');
const budgetRoutes   = require('./src/routes/budget.routes');
const expenseRoutes  = require('./src/routes/expense.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const paymentRoutes  = require('./src/routes/payment.routes');
const payeeRoutes    = require('./src/routes/payee.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const workEntryRoutes = require('./src/routes/workEntry.routes');
const harvestRoutes   = require('./src/routes/harvest.routes');
const saleRoutes      = require('./src/routes/sale.routes');
const syncRoutes      = require('./src/routes/sync.routes');
const reportRoutes    = require('./src/routes/report.routes');
const { authenticate } = require('./src/middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug logging for routes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/projects', projectRoutes);
apiRouter.use('/budget', budgetRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/employees', employeeRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/payees', payeeRoutes);
apiRouter.use('/inventory', inventoryRoutes);
apiRouter.use('/work-entries', workEntryRoutes);
apiRouter.use('/harvests', harvestRoutes);
apiRouter.use('/sales', saleRoutes);
apiRouter.use('/sync', syncRoutes);
apiRouter.use('/reports', reportRoutes);

apiRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  console.log(`[404 NOT FOUND] ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
