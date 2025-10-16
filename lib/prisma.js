const { PrismaClient } = require('../generated/prisma');

// Singleton pattern for Prisma Client
// Prevents multiple instances in development with hot reload
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
