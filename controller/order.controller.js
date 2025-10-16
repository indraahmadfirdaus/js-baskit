const prisma = require('../lib/prisma');
const { Prisma } = require('../generated/prisma');

// Create sales order with pessimistic locking
const createSalesOrder = async (req, res) => {
  try {
    const { customerId, items, deliveryAddress, notes } = req.body;

    // Validation
    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and items array are required'
      });
    }

    // Validate items format
    for (const item of items) {
      if (!item.goodsId || !item.quantity || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have goodsId and positive quantity'
        });
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      // 1. Validate customer
      const customer = await tx.customer.findUnique({
        where: { id: parseInt(customerId) }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // 2. Lock inventory rows with SELECT FOR UPDATE
      const inventoryIds = items.map(item => item.goodsId);

      // Using raw SQL for SELECT FOR UPDATE
      const lockedInventories = await tx.$queryRaw`
        SELECT i.*, g.id as "goodsDbId", g.sku, g."goodsName", g.price, g.description
        FROM "Inventory" i
        JOIN "Goods" g ON g.id = i."goodsId"
        WHERE i."goodsId" IN (${Prisma.join(inventoryIds.map(id => parseInt(id)))})
        FOR UPDATE
      `;

      // Convert to map for easy lookup
      const inventoryMap = new Map(
        lockedInventories.map(inv => [inv.goodsId, inv])
      );

      // 3. Validate and check stock availability
      let isPreorder = false;
      const orderItems = [];

      for (const item of items) {
        const inventory = inventoryMap.get(item.goodsId);

        if (!inventory) {
          throw new Error(`Goods with ID ${item.goodsId} not found`);
        }

        const availableStock = inventory.stock - inventory.reservedStock;

        if (availableStock < item.quantity) {
          isPreorder = true;
        }

        orderItems.push({
          goodsId: item.goodsId,
          quantity: parseInt(item.quantity),
          unitPrice: inventory.price,
          totalPrice: inventory.price * parseInt(item.quantity)
        });
      }

      // 4. Calculate total
      const totalAmount = orderItems.reduce(
        (sum, item) => sum + parseFloat(item.totalPrice),
        0
      );

      // 5. Generate unique order number
      const notesNumber = `SO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // 6. Create order with items
      const newOrder = await tx.salesOrder.create({
        data: {
          notesNumber,
          customerId: parseInt(customerId),
          isPreorder,
          status: 'PENDING',
          totalAmount,
          orderDate: new Date(),
          expectedDeliveryDate: isPreorder
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : null,
          deliveryAddress,
          notes,
          items: {
            create: orderItems
          }
        },
        include: {
          items: {
            include: {
              goods: true
            }
          },
          customer: true
        }
      });

      // 7. Update inventory (while still locked)
      for (const item of orderItems) {
        const inventory = inventoryMap.get(item.goodsId);
        const availableStock = inventory.stock - inventory.reservedStock;

        if (isPreorder) {
          // Reserve whatever stock is available
          const reserveAmount = Math.min(availableStock, item.quantity);
          if (reserveAmount > 0) {
            await tx.inventory.update({
              where: { goodsId: item.goodsId },
              data: {
                reservedStock: { increment: reserveAmount }
              }
            });
          }
        } else {
          // Deduct stock immediately for regular orders
          await tx.inventory.update({
            where: { goodsId: item.goodsId },
            data: {
              stock: { decrement: item.quantity }
            }
          });
        }
      }

      return newOrder;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5000,
      timeout: 10000
    });

    return res.status(201).json({
      success: true,
      message: `${order.isPreorder ? 'Pre-order' : 'Order'} created successfully`,
      data: order
    });

  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
};

// Get single order
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            goods: {
              include: {
                inventory: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    return res.json({
      success: true,
      data: order
    });

  } catch (error) {
    console.error('Get order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get order'
    });
  }
};

// List all orders with filters
const listOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      isPreorder,
      customerId
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(status && { status }),
      ...(isPreorder !== undefined && { isPreorder: isPreorder === 'true' }),
      ...(customerId && { customerId: parseInt(customerId) })
    };

    const [orders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: true,
          items: {
            include: {
              goods: true
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.salesOrder.count({ where })
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('List orders error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to list orders'
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if order exists
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true
      }
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If cancelling order, release reserved stock or restore stock
    if (status === 'CANCELLED') {
      await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.salesOrder.update({
          where: { id: parseInt(id) },
          data: { status }
        });

        // Restore inventory
        for (const item of existingOrder.items) {
          if (existingOrder.isPreorder) {
            // Release reserved stock
            await tx.inventory.update({
              where: { goodsId: item.goodsId },
              data: {
                reservedStock: { decrement: item.quantity }
              }
            });
          } else {
            // Restore stock
            await tx.inventory.update({
              where: { goodsId: item.goodsId },
              data: {
                stock: { increment: item.quantity }
              }
            });
          }
        }
      });
    } else {
      // Just update status
      await prisma.salesOrder.update({
        where: { id: parseInt(id) },
        data: { status }
      });
    }

    // Fetch updated order
    const updatedOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            goods: true
          }
        }
      }
    });

    return res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status'
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order exists
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true
      }
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Cannot cancel delivered orders
    if (existingOrder.status === 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel delivered orders'
      });
    }

    // Cancel order and restore inventory
    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.salesOrder.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' }
      });

      // Restore inventory
      for (const item of existingOrder.items) {
        if (existingOrder.isPreorder) {
          // Release reserved stock
          await tx.inventory.update({
            where: { goodsId: item.goodsId },
            data: {
              reservedStock: { decrement: item.quantity }
            }
          });
        } else {
          // Restore stock
          await tx.inventory.update({
            where: { goodsId: item.goodsId },
            data: {
              stock: { increment: item.quantity }
            }
          });
        }
      }
    });

    // Fetch updated order
    const cancelledOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            goods: true
          }
        }
      }
    });

    return res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: cancelledOrder
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    });
  }
};

// Fulfill pre-order
const fulfillPreorder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if order exists and is a pre-order
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true
      }
    });

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!existingOrder.isPreorder) {
      return res.status(400).json({
        success: false,
        message: 'This is not a pre-order'
      });
    }

    if (existingOrder.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot fulfill cancelled order'
      });
    }

    // Check if all items are now available
    const fulfillResult = await prisma.$transaction(async (tx) => {
      let canFulfill = true;
      const stockChecks = [];

      for (const item of existingOrder.items) {
        const inventory = await tx.inventory.findUnique({
          where: { goodsId: item.goodsId }
        });

        const availableStock = inventory.stock - inventory.reservedStock;

        stockChecks.push({
          goodsId: item.goodsId,
          required: item.quantity,
          available: availableStock
        });

        if (availableStock < item.quantity) {
          canFulfill = false;
        }
      }

      if (!canFulfill) {
        throw new Error(`Insufficient stock to fulfill order. Checks: ${JSON.stringify(stockChecks)}`);
      }

      // Fulfill order: deduct stock and release reservations
      for (const item of existingOrder.items) {
        const inventory = await tx.inventory.findUnique({
          where: { goodsId: item.goodsId }
        });

        // Release reservation
        const currentReserved = inventory.reservedStock;
        const releaseAmount = Math.min(currentReserved, item.quantity);

        await tx.inventory.update({
          where: { goodsId: item.goodsId },
          data: {
            stock: { decrement: item.quantity },
            reservedStock: { decrement: releaseAmount }
          }
        });
      }

      // Update order
      const fulfilledOrder = await tx.salesOrder.update({
        where: { id: parseInt(id) },
        data: {
          isPreorder: false,
          status: 'CONFIRMED',
          expectedDeliveryDate: null
        },
        include: {
          customer: true,
          items: {
            include: {
              goods: true
            }
          }
        }
      });

      return fulfilledOrder;
    });

    return res.json({
      success: true,
      message: 'Pre-order fulfilled successfully',
      data: fulfillResult
    });

  } catch (error) {
    console.error('Fulfill pre-order error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fulfill pre-order'
    });
  }
};

module.exports = {
  createSalesOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
  cancelOrder,
  fulfillPreorder
};
