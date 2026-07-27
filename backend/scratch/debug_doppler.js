const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const images = await prisma.dopplerImage.findMany();
  console.dir(images, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
