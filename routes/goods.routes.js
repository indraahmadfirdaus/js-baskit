const express = require('express');
const {
  createGoods,
  getGoods,
  listGoods,
  updateGoods,
  deleteGoods
} = require('../controller/goods.controller');

const router = express.Router();

// Create goods
router.post('/', createGoods);

// List goods
router.get('/', listGoods);

// Get single goods
router.get('/:id', getGoods);

// Update goods
router.put('/:id', updateGoods);

// Delete goods
router.delete('/:id', deleteGoods);

module.exports = router;