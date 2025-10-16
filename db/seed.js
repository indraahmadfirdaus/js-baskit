const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('Clearing existing data...');
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.goods.deleteMany();
  await prisma.customer.deleteMany();

  // Create customers
  console.log('Creating customers...');
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0101'
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        phone: '+1-555-0102'
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        phone: '+1-555-0103'
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Alice Williams',
        email: 'alice.williams@example.com',
        phone: '+1-555-0104'
      }
    }),
    prisma.customer.create({
      data: {
        name: 'Charlie Brown',
        email: 'charlie.brown@example.com',
        phone: '+1-555-0105'
      }
    })
  ]);
  console.log(`Created ${customers.length} customers`);

  // Create goods with inventory
  console.log('Creating goods and inventory...');
  const goods = await Promise.all([
    prisma.goods.create({
      data: {
        sku: 'LAPTOP-001',
        goodsName: 'Dell XPS 15 Laptop',
        price: 1499.99,
        description: 'High-performance laptop with 16GB RAM and 512GB SSD',
        inventory: {
          create: {
            stock: 50,
            reservedStock: 0,
            minStock: 10
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'MOUSE-001',
        goodsName: 'Logitech MX Master 3 Mouse',
        price: 99.99,
        description: 'Wireless ergonomic mouse',
        inventory: {
          create: {
            stock: 100,
            reservedStock: 0,
            minStock: 20
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'KEYBOARD-001',
        goodsName: 'Mechanical Gaming Keyboard',
        price: 149.99,
        description: 'RGB mechanical keyboard with cherry MX switches',
        inventory: {
          create: {
            stock: 75,
            reservedStock: 0,
            minStock: 15
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'MONITOR-001',
        goodsName: 'LG 27 4K Monitor',
        price: 399.99,
        description: '27-inch 4K UHD monitor with HDR',
        inventory: {
          create: {
            stock: 5,
            reservedStock: 0,
            minStock: 5
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'HEADSET-001',
        goodsName: 'Sony WH-1000XM4 Headphones',
        price: 349.99,
        description: 'Noise-cancelling wireless headphones',
        inventory: {
          create: {
            stock: 30,
            reservedStock: 0,
            minStock: 10
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'WEBCAM-001',
        goodsName: 'Logitech C920 HD Webcam',
        price: 79.99,
        description: '1080p HD webcam with auto-focus',
        inventory: {
          create: {
            stock: 2,
            reservedStock: 0,
            minStock: 5
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'DESK-001',
        goodsName: 'Standing Desk',
        price: 599.99,
        description: 'Electric height-adjustable standing desk',
        inventory: {
          create: {
            stock: 20,
            reservedStock: 0,
            minStock: 5
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'CHAIR-001',
        goodsName: 'Ergonomic Office Chair',
        price: 399.99,
        description: 'Mesh back ergonomic chair with lumbar support',
        inventory: {
          create: {
            stock: 15,
            reservedStock: 0,
            minStock: 5
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'PHONE-001',
        goodsName: 'iPhone 15 Pro',
        price: 999.99,
        description: '256GB, Titanium finish',
        inventory: {
          create: {
            stock: 0,
            reservedStock: 0,
            minStock: 10
          }
        }
      }
    }),
    prisma.goods.create({
      data: {
        sku: 'TABLET-001',
        goodsName: 'iPad Pro 12.9',
        price: 1099.99,
        description: '512GB with M2 chip',
        inventory: {
          create: {
            stock: 25,
            reservedStock: 0,
            minStock: 10
          }
        }
      }
    })
  ]);
  console.log(`Created ${goods.length} goods with inventory`);

  // Create sample orders
  console.log('Creating sample orders...');

  // Regular order (all items in stock)
  const order1 = await prisma.salesOrder.create({
    data: {
      notesNumber: 'SO-2025001',
      customerId: customers[0].id,
      isPreorder: false,
      status: 'CONFIRMED',
      totalAmount: 1749.97,
      orderDate: new Date(),
      deliveryAddress: '123 Main St, New York, NY 10001',
      items: {
        create: [
          {
            goodsId: goods[0].id, // Laptop
            quantity: 1,
            unitPrice: 1499.99,
            totalPrice: 1499.99
          },
          {
            goodsId: goods[1].id, // Mouse
            quantity: 1,
            unitPrice: 99.99,
            totalPrice: 99.99
          },
          {
            goodsId: goods[2].id, // Keyboard
            quantity: 1,
            unitPrice: 149.99,
            totalPrice: 149.99
          }
        ]
      }
    }
  });

  // Deduct stock for regular order
  await prisma.inventory.update({
    where: { goodsId: goods[0].id },
    data: { stock: { decrement: 1 } }
  });
  await prisma.inventory.update({
    where: { goodsId: goods[1].id },
    data: { stock: { decrement: 1 } }
  });
  await prisma.inventory.update({
    where: { goodsId: goods[2].id },
    data: { stock: { decrement: 1 } }
  });

  console.log(`Created regular order: ${order1.notesNumber}`);

  // Pre-order (some items out of stock)
  const order2 = await prisma.salesOrder.create({
    data: {
      notesNumber: 'SO-2025002',
      customerId: customers[1].id,
      isPreorder: true,
      status: 'PENDING',
      totalAmount: 2099.97,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryAddress: '456 Oak Ave, Los Angeles, CA 90001',
      items: {
        create: [
          {
            goodsId: goods[8].id, // iPhone (out of stock)
            quantity: 2,
            unitPrice: 999.99,
            totalPrice: 1999.98
          },
          {
            goodsId: goods[1].id, // Mouse
            quantity: 1,
            unitPrice: 99.99,
            totalPrice: 99.99
          }
        ]
      }
    }
  });

  // Reserve available stock for pre-order mouse
  await prisma.inventory.update({
    where: { goodsId: goods[1].id },
    data: { reservedStock: { increment: 1 } }
  });

  console.log(`Created pre-order: ${order2.notesNumber}`);

  // Another regular order
  const order3 = await prisma.salesOrder.create({
    data: {
      notesNumber: 'SO-2025003',
      customerId: customers[2].id,
      isPreorder: false,
      status: 'PROCESSING',
      totalAmount: 1499.97,
      orderDate: new Date(),
      deliveryAddress: '789 Pine Rd, Chicago, IL 60601',
      items: {
        create: [
          {
            goodsId: goods[3].id, // Monitor
            quantity: 1,
            unitPrice: 399.99,
            totalPrice: 399.99
          },
          {
            goodsId: goods[4].id, // Headset
            quantity: 1,
            unitPrice: 349.99,
            totalPrice: 349.99
          },
          {
            goodsId: goods[6].id, // Desk
            quantity: 1,
            unitPrice: 599.99,
            totalPrice: 599.99
          },
          {
            goodsId: goods[2].id, // Keyboard
            quantity: 1,
            unitPrice: 149.99,
            totalPrice: 149.99
          }
        ]
      }
    }
  });

  // Deduct stock
  await prisma.inventory.update({
    where: { goodsId: goods[3].id },
    data: { stock: { decrement: 1 } }
  });
  await prisma.inventory.update({
    where: { goodsId: goods[4].id },
    data: { stock: { decrement: 1 } }
  });
  await prisma.inventory.update({
    where: { goodsId: goods[6].id },
    data: { stock: { decrement: 1 } }
  });
  await prisma.inventory.update({
    where: { goodsId: goods[2].id },
    data: { stock: { decrement: 1 } }
  });

  console.log(`Created regular order: ${order3.notesNumber}`);

  // Pre-order with low stock item
  const order4 = await prisma.salesOrder.create({
    data: {
      notesNumber: 'SO-2025004',
      customerId: customers[3].id,
      isPreorder: true,
      status: 'PENDING',
      totalAmount: 479.94,
      orderDate: new Date(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryAddress: '321 Elm St, Houston, TX 77001',
      items: {
        create: [
          {
            goodsId: goods[5].id, // Webcam (low stock)
            quantity: 6,
            unitPrice: 79.99,
            totalPrice: 479.94
          }
        ]
      }
    }
  });

  // Reserve available webcam stock (only 2 available)
  await prisma.inventory.update({
    where: { goodsId: goods[5].id },
    data: { reservedStock: { increment: 2 } }
  });

  console.log(`Created pre-order: ${order4.notesNumber}`);

  console.log('\n=== Seeding Summary ===');
  console.log(` Created ${customers.length} customers`);
  console.log(` Created ${goods.length} goods with inventory`);
  console.log(' Created 4 sample orders (2 regular, 2 pre-orders)');
  console.log('\nDatabase seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
