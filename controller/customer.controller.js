const prisma = require('../lib/prisma');

// Create new customer
const createCustomer = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validation
    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone are required'
      });
    }

    // Check if email already exists
    if (email) {
      const existingCustomer = await prisma.customer.findUnique({
        where: { email }
      });

      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });

  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create customer'
    });
  }
};

// Get single customer with orders
const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        orders: {
          include: {
            items: {
              include: {
                goods: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Last 10 orders
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    return res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Get customer error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get customer'
    });
  }
};

// List all customers with pagination
const listCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          _count: {
            select: { orders: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customer.count({ where })
    ]);

    return res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('List customers error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to list customers'
    });
  }
};

// Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // If email is being changed, check if new email already exists
    if (email && email !== existingCustomer.email) {
      const duplicateEmail = await prisma.customer.findUnique({
        where: { email }
      });

      if (duplicateEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone && { phone })
      }
    });

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });

  } catch (error) {
    console.error('Update customer error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update customer'
    });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      include: {
        orders: true
      }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has orders
    if (existingCustomer.orders.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing orders'
      });
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete customer'
    });
  }
};

module.exports = {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  deleteCustomer
};
