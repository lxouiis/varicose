const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dopplerImages = await prisma.dopplerImage.findMany({
    orderBy: { uploaded_at: 'desc' },
    take: 5
  });
  console.log("Recent Doppler Images:", JSON.stringify(dopplerImages, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
