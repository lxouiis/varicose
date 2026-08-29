import bcrypt from 'bcrypt';

import { prisma } from './lib/prisma';

async function main() {
  // Create Doctor idempotently — local/dev seed only, NOT the production
  // account. role: 'Admin' matches this deployment's real role values
  // ('Admin', 'Professor & HOD', 'Asso. Professor'), so this seeded account
  // can immediately exercise the admin panel in local testing.
  // must_reset_password: false since 'jnmc2026' is a real chosen dev
  // password, not a temporary one — leave it able to log straight in.
  const password = await bcrypt.hash('jnmc2026', 10);
  const doctor = await prisma.doctor.upsert({
    where: { email: 'dr.irannahittalmani@jnmc.edu' },
    update: { password, role: 'Admin', must_reset_password: false },
    create: {
      email: 'dr.irannahittalmani@jnmc.edu',
      password,
      name: 'Dr. Iranna M Hittalamani',
      role: 'Admin',
      must_reset_password: false,
    },
  });
  console.log('Upserted doctor dr.irannahittalmani@jnmc.edu (role: Admin)');

  // Patient 1 — purely static demographics
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
    },
  });

  // Assessment for Patient 1 — per-visit data lives here in v2
  const a1 = await prisma.assessment.create({
    data: {
      patient_id:    p1.id,
      doctor_id:     doctor.id,
      comorbidities: JSON.stringify(['Hypertension', 'Diabetes']),
      venous_history: JSON.stringify(['Previous DVT']),
      bp:            '130/90 mmHg',
      pulse:         78,
      legs: {
        create: {
          patient_id:    p1.id,
          leg_side:      'left',
          // CEAP components (ceap_full is computed on-the-fly)
          ceap_c:        'C3',
          ceap_e:        'Es',
          ceap_a:        'Ap',
          ceap_p:        'Pr',
          // rVCSS components (rvcss_total is computed on-the-fly)
          pain:          1,
          edema:         3,
        },
      },
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
    },
  });

  await prisma.assessment.create({
    data: {
      patient_id:     p2.id,
      doctor_id:      doctor.id,
      venous_history: JSON.stringify(['Family History']),
      legs: {
        create: {
          patient_id:    p2.id,
          leg_side:      'right',
          ceap_c:        'C2',
          ceap_e:        'En',
          ceap_a:        'An',
          ceap_p:        'Pn',
          varicose_veins: 2,
        },
      },
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
    },
  });

  await prisma.assessment.create({
    data: {
      patient_id:    p3.id,
      doctor_id:     doctor.id,
      comorbidities: JSON.stringify(['Obesity']),
      legs: {
        create: {
          patient_id:  p3.id,
          leg_side:    'left',
          ceap_c:      'C6',
          ceap_e:      'Ep',
          ceap_a:      'Ad',
          ceap_p:      'Pr,o',
          ulcer_count: 1,
          pain:        3,
        },
      },
    },
  });

  console.log('Seeded 3 demo patients with normalized CEAP/rVCSS data (v2 schema).');
  console.log('Seeding complete. Use dr.irannahittalmani@jnmc.edu / jnmc2026 to log in.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
