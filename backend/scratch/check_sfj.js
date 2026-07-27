const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const imgs = await prisma.dopplerImage.findMany({
    orderBy: { uploaded_at: 'desc' },
    take: 10
  });
  console.log("Last 10 DopplerImages:");
  imgs.forEach(i => console.log(`[${i.id}] Leg: ${i.leg_id}, Side: ${i.leg_side}, Phase: ${i.phase}, Seg: ${i.segment}, View: ${i.view_type}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
