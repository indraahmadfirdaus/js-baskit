const express = require('express');
const {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  deleteCustomer
} = require('../controller/customer.controller');

const router = express.Router();

// Create customer
router.post('/', createCustomer);

// List customers
router.get('/', listCustomers);

// Get single customer
router.get('/:id', getCustomer);

// Update customer
router.put('/:id', updateCustomer);

// Delete customer
router.delete('/:id', deleteCustomer);

module.exports = router;
