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
const inventoryRoutes = require('./src/routes/inventory.routes');
const workEntryRoutes = require('./src/routes/workEntry.routes');
const { authenticate } = require('./src/middleware/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/budget', budgetRoutes);
app.use('/expenses', expenseRoutes);
app.use('/employees', employeeRoutes);
app.use('/payments', paymentRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/work-entries', workEntryRoutes);

// Protected routes
app.get('/api/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// 404 handler
app.use((req, res) => {
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
