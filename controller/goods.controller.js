const prisma = require('../lib/prisma');

// Create new goods with inventory
const createGoods = async (req, res) => {
  try {
    const { sku, goodsName, price, description, initialStock = 0, minStock = 0 } = req.body;

    // Validation
    if (!sku || !goodsName || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'SKU, goods name, and price are required'
      });
    }

    // Check if SKU already exists
    const existingGoods = await prisma.goods.findUnique({
      where: { sku }
    });

    if (existingGoods) {
      return res.status(400).json({
        success: false,
        message: 'SKU already exists'
      });
    }

    // Create goods with inventory in transaction
    const goods = await prisma.$transaction(async (tx) => {
      const newGoods = await tx.goods.create({
        data: {
          sku,
          goodsName,
          price,
          description,
          inventory: {
            create: {
              stock: initialStock,
              reservedStock: 0,
              minStock
            }
          }
        },
        include: {
          inventory: true
        }
      });

      return newGoods;
    });

    return res.status(201).json({
      success: true,
      message: 'Goods created successfully',
      data: goods
    });

  } catch (error) {
    console.error('Create goods error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create goods'
    });
  }
};

// Get single goods with inventory
const getGoods = async (req, res) => {
  try {
    const { id } = req.params;

    const goods = await prisma.goods.findUnique({
      where: { id: parseInt(id) },
      include: {
        inventory: true
      }
    });

    if (!goods) {
      return res.status(404).json({
        success: false,
        message: 'Goods not found'
      });
    }

    // Calculate available stock
    const availableStock = goods.inventory
      ? goods.inventory.stock - goods.inventory.reservedStock
      : 0;

    return res.json({
      success: true,
      data: {
        ...goods,
        inventory: goods.inventory ? {
          ...goods.inventory,
          availableStock
        } : null
      }
    });

  } catch (error) {
    console.error('Get goods error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get goods'
    });
  }
};

// List all goods with pagination
const listGoods = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search ? {
      OR: [
        { sku: { contains: search, mode: 'insensitive' } },
        { goodsName: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [goods, total] = await Promise.all([
      prisma.goods.findMany({
        where,
        include: {
          inventory: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.goods.count({ where })
    ]);

    // Add available stock calculation
    const goodsWithAvailableStock = goods.map(item => ({
      ...item,
      inventory: item.inventory ? {
        ...item.inventory,
        availableStock: item.inventory.stock - item.inventory.reservedStock
      } : null
    }));

    return res.json({
      success: true,
      data: goodsWithAvailableStock,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('List goods error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to list goods'
    });
  }
};

// Update goods
const updateGoods = async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, goodsName, price, description } = req.body;

    // Check if goods exists
    const existingGoods = await prisma.goods.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingGoods) {
      return res.status(404).json({
        success: false,
        message: 'Goods not found'
      });
    }

    // If SKU is being changed, check if new SKU already exists
    if (sku && sku !== existingGoods.sku) {
      const duplicateSku = await prisma.goods.findUnique({
        where: { sku }
      });

      if (duplicateSku) {
        return res.status(400).json({
          success: false,
          message: 'SKU already exists'
        });
      }
    }

    // Update goods
    const updatedGoods = await prisma.goods.update({
      where: { id: parseInt(id) },
      data: {
        ...(sku && { sku }),
        ...(goodsName && { goodsName }),
        ...(price !== undefined && { price }),
        ...(description !== undefined && { description })
      },
      include: {
        inventory: true
      }
    });

    return res.json({
      success: true,
      message: 'Goods updated successfully',
      data: updatedGoods
    });

  } catch (error) {
    console.error('Update goods error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update goods'
    });
  }
};

// Delete goods (soft delete by setting stock to 0 or hard delete)
const deleteGoods = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if goods exists
    const existingGoods = await prisma.goods.findUnique({
      where: { id: parseInt(id) },
      include: {
        inventory: true,
        orderItems: {
          include: {
            order: true
          }
        }
      }
    });

    if (!existingGoods) {
      return res.status(404).json({
        success: false,
        message: 'Goods not found'
      });
    }

    // Check if goods has pending orders
    const hasPendingOrders = existingGoods.orderItems.some(
      item => item.order.status === 'PENDING' || item.order.status === 'CONFIRMED'
    );

    if (hasPendingOrders) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete goods with pending orders'
      });
    }

    // Delete goods (cascade will delete inventory)
    await prisma.goods.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Goods deleted successfully'
    });

  } catch (error) {
    console.error('Delete goods error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete goods'
    });
  }
};

module.exports = {
  createGoods,
  getGoods,
  listGoods,
  updateGoods,
  deleteGoods
};
