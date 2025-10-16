const prisma = require('../lib/prisma');

// List all inventory with goods info
const listInventory = async (req, res) => {
  try {
    const { page = 1, limit = 10, lowStock = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [inventories, total] = await Promise.all([
      prisma.inventory.findMany({
        include: {
          goods: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.inventory.count()
    ]);

    // Calculate available stock and filter low stock if requested
    let result = inventories.map(inv => ({
      ...inv,
      availableStock: inv.stock - inv.reservedStock,
      isLowStock: (inv.stock - inv.reservedStock) <= inv.minStock
    }));

    if (lowStock === 'true') {
      result = result.filter(inv => inv.isLowStock);
    }

    return res.json({
      success: true,
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: lowStock === 'true' ? result.length : total,
        totalPages: Math.ceil((lowStock === 'true' ? result.length : total) / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('List inventory error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to list inventory'
    });
  }
};

// Get inventory for specific goods
const getInventoryByGoodsId = async (req, res) => {
  try {
    const { goodsId } = req.params;

    const inventory = await prisma.inventory.findUnique({
      where: { goodsId: parseInt(goodsId) },
      include: {
        goods: true
      }
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found for this goods'
      });
    }

    const availableStock = inventory.stock - inventory.reservedStock;

    return res.json({
      success: true,
      data: {
        ...inventory,
        availableStock,
        isLowStock: availableStock <= inventory.minStock
      }
    });

  } catch (error) {
    console.error('Get inventory error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get inventory'
    });
  }
};

// Update stock level (add or reduce)
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, quantity, minStock } = req.body;

    // Validation
    if (!action || !['add', 'reduce', 'set'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be one of: add, reduce, set'
      });
    }

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a non-negative number'
      });
    }

    // Check if inventory exists
    const existingInventory = await prisma.inventory.findUnique({
      where: { id: parseInt(id) },
      include: { goods: true }
    });

    if (!existingInventory) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found'
      });
    }

    // Calculate new stock
    let newStock = existingInventory.stock;

    switch (action) {
      case 'add':
        newStock += parseInt(quantity);
        break;
      case 'reduce':
        newStock -= parseInt(quantity);
        if (newStock < existingInventory.reservedStock) {
          return res.status(400).json({
            success: false,
            message: `Cannot reduce stock below reserved stock (${existingInventory.reservedStock})`
          });
        }
        break;
      case 'set':
        newStock = parseInt(quantity);
        if (newStock < existingInventory.reservedStock) {
          return res.status(400).json({
            success: false,
            message: `Stock cannot be less than reserved stock (${existingInventory.reservedStock})`
          });
        }
        break;
    }

    // Update inventory
    const updatedInventory = await prisma.inventory.update({
      where: { id: parseInt(id) },
      data: {
        stock: newStock,
        ...(minStock !== undefined && { minStock: parseInt(minStock) })
      },
      include: {
        goods: true
      }
    });

    const availableStock = updatedInventory.stock - updatedInventory.reservedStock;

    return res.json({
      success: true,
      message: `Stock ${action === 'set' ? 'updated' : action === 'add' ? 'added' : 'reduced'} successfully`,
      data: {
        ...updatedInventory,
        availableStock,
        isLowStock: availableStock <= updatedInventory.minStock
      }
    });

  } catch (error) {
    console.error('Update stock error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update stock'
    });
  }
};

// Check availability for multiple goods
const checkAvailability = async (req, res) => {
  try {
    const { items } = req.body; // items: [{ goodsId, quantity }]

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    // Get inventory for all requested goods
    const goodsIds = items.map(item => item.goodsId);
    const inventories = await prisma.inventory.findMany({
      where: {
        goodsId: { in: goodsIds }
      },
      include: {
        goods: true
      }
    });

    // Check availability for each item
    const availabilityCheck = items.map(item => {
      const inventory = inventories.find(inv => inv.goodsId === item.goodsId);

      if (!inventory) {
        return {
          goodsId: item.goodsId,
          requestedQuantity: item.quantity,
          available: false,
          reason: 'Goods not found',
          availableStock: 0
        };
      }

      const availableStock = inventory.stock - inventory.reservedStock;
      const isAvailable = availableStock >= item.quantity;

      return {
        goodsId: item.goodsId,
        goodsName: inventory.goods.goodsName,
        sku: inventory.goods.sku,
        requestedQuantity: item.quantity,
        availableStock,
        available: isAvailable,
        ...((!isAvailable) && {
          reason: availableStock === 0
            ? 'Out of stock'
            : `Insufficient stock (only ${availableStock} available)`
        })
      };
    });

    const allAvailable = availabilityCheck.every(item => item.available);

    return res.json({
      success: true,
      allAvailable,
      items: availabilityCheck
    });

  } catch (error) {
    console.error('Check availability error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to check availability'
    });
  }
};

// Reserve stock (for pre-orders)
const reserveStock = async (req, res) => {
  try {
    const { goodsId, quantity } = req.body;

    if (!goodsId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid goodsId and quantity are required'
      });
    }

    const inventory = await prisma.$transaction(async (tx) => {
      // Get current inventory with lock
      const current = await tx.inventory.findUnique({
        where: { goodsId: parseInt(goodsId) }
      });

      if (!current) {
        throw new Error('Inventory not found');
      }

      const availableStock = current.stock - current.reservedStock;

      if (availableStock < quantity) {
        throw new Error(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
      }

      // Reserve stock
      const updated = await tx.inventory.update({
        where: { goodsId: parseInt(goodsId) },
        data: {
          reservedStock: { increment: parseInt(quantity) }
        },
        include: {
          goods: true
        }
      });

      return updated;
    });

    const availableStock = inventory.stock - inventory.reservedStock;

    return res.json({
      success: true,
      message: 'Stock reserved successfully',
      data: {
        ...inventory,
        availableStock
      }
    });

  } catch (error) {
    console.error('Reserve stock error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to reserve stock'
    });
  }
};

// Release reservation (cancel pre-order or order)
const releaseReservation = async (req, res) => {
  try {
    const { goodsId, quantity } = req.body;

    if (!goodsId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid goodsId and quantity are required'
      });
    }

    const inventory = await prisma.$transaction(async (tx) => {
      const current = await tx.inventory.findUnique({
        where: { goodsId: parseInt(goodsId) }
      });

      if (!current) {
        throw new Error('Inventory not found');
      }

      if (current.reservedStock < quantity) {
        throw new Error(`Cannot release more than reserved. Reserved: ${current.reservedStock}`);
      }

      // Release reservation
      const updated = await tx.inventory.update({
        where: { goodsId: parseInt(goodsId) },
        data: {
          reservedStock: { decrement: parseInt(quantity) }
        },
        include: {
          goods: true
        }
      });

      return updated;
    });

    const availableStock = inventory.stock - inventory.reservedStock;

    return res.json({
      success: true,
      message: 'Reservation released successfully',
      data: {
        ...inventory,
        availableStock
      }
    });

  } catch (error) {
    console.error('Release reservation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to release reservation'
    });
  }
};

module.exports = {
  listInventory,
  getInventoryByGoodsId,
  updateStock,
  checkAvailability,
  reserveStock,
  releaseReservation
};
