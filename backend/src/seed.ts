import bcrypt from 'bcrypt';

import { prisma } from './lib/prisma';

async function main() {
  // Create Doctor idempotently
  const password = await bcrypt.hash('jnmc2026', 10);
  await prisma.doctor.upsert({
    where: { email: 'dr.iranna@jnmc.edu' },
    update: { password },
    create: {
      email: 'dr.iranna@jnmc.edu',
      password,
      name: 'Dr. Iranna M Hittalamani',
      role: 'interventional_radiologist',
    },
  });
  console.log('Upserted doctor dr.iranna@jnmc.edu');

  // Patient 1
  const p1 = await prisma.patient.upsert({
    where: { uhid: 'UHID-1001' },
    update: {},
    create: {
      uhid: 'UHID-1001',
      name: 'Ramesh Kumar',
      age: 45,
      sex: 'Male',
      height: 170,
      weight: 75,
      bmi: parseFloat((75 / ((170 / 100) ** 2)).toFixed(1)),
      comorbidities: JSON.stringify(['Hypertension', 'Diabetes']),
      venous_history: JSON.stringify(['Previous DVT']),
      legs: {
        create: {
          leg_side: 'left',
          ceap_full: 'C3, Es, Ap, Pr',
          rvcss_total: 4,
          pain: 1,
          edema: 3,
        }
      }
    },
  });

  // Patient 2
  const p2 = await prisma.patient.upsert({
    where: { uhid: 'UHID-1002' },
    update: {},
    create: {
      uhid: 'UHID-1002',
      name: 'Suma Patil',
      age: 38,
      sex: 'Female',
      height: 160,
      weight: 65,
      bmi: parseFloat((65 / ((160 / 100) ** 2)).toFixed(1)),
      comorbidities: JSON.stringify([]),
      venous_history: JSON.stringify(['Family History']),
      legs: {
        create: {
          leg_side: 'right',
          ceap_full: 'C2, En, An, Pn',
          rvcss_total: 2,
          varicose_veins: 2,
        }
      }
    },
  });

  // Patient 3
  const p3 = await prisma.patient.upsert({
    where: { uhid: 'UHID-1003' },
    update: {},
    create: {
      uhid: 'UHID-1003',
      name: 'Basavaraj Desai',
      age: 55,
      sex: 'Male',
      height: 165,
      weight: 80,
      bmi: parseFloat((80 / ((165 / 100) ** 2)).toFixed(1)),
      comorbidities: JSON.stringify(['Obesity']),
      venous_history: JSON.stringify([]),
      legs: {
        create: {
          leg_side: 'left',
          ceap_full: 'C6, Ep+Es, Ad, Pr+Po',
          rvcss_total: 12,
          ulcer_count: 1,
          pain: 3,
        }
      }
    },
  });

  console.log('Seeded 3 demo patients with auto-calculated CEAP leg data.');
  console.log('Seeding complete. Use dr.iranna@jnmc.edu / jnmc2026 to log in.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
