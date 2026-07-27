import { prisma } from './src/lib/prisma';

async function test() {
  const patient = await prisma.patient.findFirst({
    where: { name: 'try' }
  });
  console.log('Before:', patient);

  if (patient) {
    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        smoking: JSON.stringify(["Former"]),
        occupation: JSON.stringify(["Active"])
      }
    });
    console.log('After:', updated);
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());
