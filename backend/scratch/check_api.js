const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const assessment = await prisma.assessment.findFirst({
    include: {
      legs: {
        include: {
          dopplerImages: true
        }
      }
    },
    orderBy: { assessment_date: 'desc' }
  });
  console.log("Latest Assessment Legs length:", assessment?.legs?.length);
  if (assessment?.legs) {
    assessment.legs.forEach(l => {
      console.log(`Leg ${l.leg_side} doppler images:`, l.dopplerImages.length);
      if (l.dopplerImages.length > 0) {
         console.log(l.dopplerImages.map(d => `${d.segment} (${d.view_type})`));
      }
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
