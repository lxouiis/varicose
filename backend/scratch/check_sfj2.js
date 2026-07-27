const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const images = await prisma.dopplerImage.findMany({
    orderBy: { uploaded_at: 'desc' },
    take: 10
  });
  console.log("Recent images segments:");
  images.forEach(i => console.log(`${i.id}: leg_side=${i.leg_side}, segment=${i.segment}, view=${i.view_type}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
