const express = require('express');
const {
  listInventory,
  getInventoryByGoodsId,
  updateStock,
  checkAvailability,
  reserveStock,
  releaseReservation
} = require('../controller/inventory.controller');

const router = express.Router();

// List all inventory
router.get('/', listInventory);

// Get inventory by goods ID
router.get('/goods/:goodsId', getInventoryByGoodsId);

// Update stock
router.put('/:id', updateStock);

// Check availability
router.post('/check', checkAvailability);

// Reserve stock
router.post('/reserve', reserveStock);

// Release reservation
router.post('/release', releaseReservation);

module.exports = router;
