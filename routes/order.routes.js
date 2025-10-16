const express = require('express');
const {
  createSalesOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  cancelOrder,
  fulfillPreorder
} = require('../controller/order.controller');

const router = express.Router();

// Create order
router.post('/', createSalesOrder);

// List orders
router.get('/', listOrders);

// Get single order
router.get('/:id', getOrder);

// Update order status
router.put('/:id/status', updateOrderStatus);

// Cancel order
router.delete('/:id', cancelOrder);

// Fulfill pre-order
router.post('/:id/fulfill', fulfillPreorder);

module.exports = router;