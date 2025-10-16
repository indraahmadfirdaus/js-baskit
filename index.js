const express = require('express');
const orderRouter = require('./routes/order.routes');
const goodsRouter = require('./routes/goods.routes');
const customerRouter = require('./routes/customer.routes');
const inventoryRouter = require('./routes/inventory.routes');

const app = express();
const port = process.env.PORT || 3300;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Sales Order API',
    version: '1.0.0',
    endpoints: {
      orders: '/api/orders',
      goods: '/api/goods',
      customers: '/api/customers',
      inventory: '/api/inventory'
    }
  });
});

app.use('/api/orders', orderRouter);
app.use('/api/goods', goodsRouter);
app.use('/api/customers', customerRouter);
app.use('/api/inventory', inventoryRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(port, () => {
  console.log(`Sales Order API listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
