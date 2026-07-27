const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const patient = await prisma.patient.findFirst({
    include: {
      assessments: {
        orderBy: { assessment_date: 'desc' },
        take: 1,
        include: {
          legs: {
            include: { dopplerImages: true }
          }
        }
      }
    }
  });
  console.dir(patient, { depth: null });
}
main().catch(console.error).finally(() => prisma.$disconnect());
