import { Request, Response } from 'express';
import { formatCeapFull } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';
import { logAudit } from '../utils/audit';
import { generateNextUhid } from '../utils/uhid';

import { prisma } from '../lib/prisma';

const safeParse = (val: any) => {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch (e) {
    return [val];
  }
};

/** Helper — attach computed virtual fields to a leg for API responses */
function decorateLeg(leg: any) {
  const rvcss_total = calculateRvcss({
    pain:           leg.pain           || 0,
    varicose_veins: leg.varicose_veins || 0,
    edema:          leg.edema          || 0,
    pigmentation:   leg.pigmentation   || 0,
    inflammation:   leg.inflammation   || 0,
    induration:     leg.induration     || 0,
    ulcer_count:    leg.ulcer_count    || 0,
    ulcer_duration: leg.ulcer_duration || 0,
    ulcer_size:     leg.ulcer_size     || 0,
    compression:    leg.compression    || 0,
  });
  return {
    ...leg,
    rvcss_total,
    ceap_full: formatCeapFull(leg.ceap_c, leg.ceap_e, leg.ceap_a, leg.ceap_p),
  };
}

/** GET /api/patients — List all patients with latest CEAP + rVCSS per leg side */
export async function listPatients(req: Request, res: Response): Promise<void> {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        legs: {
          select: {
            leg_side:      true,
            ceap_c:        true,
            ceap_e:        true,
            ceap_a:        true,
            ceap_p:        true,
            pain:          true,
            varicose_veins: true,
            edema:         true,
            pigmentation:  true,
            inflammation:  true,
            induration:    true,
            ulcer_count:   true,
            ulcer_duration: true,
            ulcer_size:    true,
            compression:   true,
            visited_at:    true,
          },
          orderBy: { visited_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const mapped = patients.map(p => {
      // Pick the latest visit per leg side
      const latestRight = p.legs.find(l => l.leg_side === 'right') || null;
      const latestLeft  = p.legs.find(l => l.leg_side === 'left')  || null;

      // Compute CEAP full strings on-the-fly (not stored in DB)
      const ceapRight = latestRight
        ? formatCeapFull(latestRight.ceap_c, latestRight.ceap_e, latestRight.ceap_a, latestRight.ceap_p)
        : null;
      const ceapLeft = latestLeft
        ? formatCeapFull(latestLeft.ceap_c, latestLeft.ceap_e, latestLeft.ceap_a, latestLeft.ceap_p)
        : null;

      // Compute rVCSS totals on-the-fly
      const rvcssRight = latestRight ? calculateRvcss({
        pain: latestRight.pain, varicose_veins: latestRight.varicose_veins, edema: latestRight.edema,
        pigmentation: latestRight.pigmentation, inflammation: latestRight.inflammation,
        induration: latestRight.induration, ulcer_count: latestRight.ulcer_count,
        ulcer_duration: latestRight.ulcer_duration, ulcer_size: latestRight.ulcer_size,
        compression: latestRight.compression,
      }) : 0;
      const rvcssLeft = latestLeft ? calculateRvcss({
        pain: latestLeft.pain, varicose_veins: latestLeft.varicose_veins, edema: latestLeft.edema,
        pigmentation: latestLeft.pigmentation, inflammation: latestLeft.inflammation,
        induration: latestLeft.induration, ulcer_count: latestLeft.ulcer_count,
        ulcer_duration: latestLeft.ulcer_duration, ulcer_size: latestLeft.ulcer_size,
        compression: latestLeft.compression,
      }) : 0;

      return {
        ...p,
        ceap_right:  ceapRight,
        ceap_left:   ceapLeft,
        ceap_full:   ceapRight || ceapLeft || null,
        rvcss_total: Math.max(rvcssRight, rvcssLeft),
        // Note: comorbidities, medications, venous_history are now per-assessment (not on Patient)
        smoking:    p.smoking    ? safeParse(p.smoking)    : [],
        occupation: p.occupation ? safeParse(p.occupation) : [],
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error('List patients error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

/** POST /api/patients — Create new patient with UHID uniqueness check */
export async function createPatient(req: Request, res: Response): Promise<void> {
  try {

    // NOTE: comorbidities, medications, venous_history, clinical_notes, veines_notes,
    // r_pain_vas, l_pain_vas are no longer stored on Patient. They belong to Assessment.
    // NOTE: uhid is intentionally NOT read from req.body — it is always generated
    // server-side via generateNextUhid() so two doctors registering patients at
    // the same instant can never collide on the same UHID.
    const {
      name, age, sex, height, weight, bmi,
      race, smoking, occupation, parity,
      dvt_history, clinic, doctor_notes,
    } = req.body;

    if (!name || !age || !sex) {
      res.status(400).json({ error: 'Name, age, and sex are required' });
      return;
    }

    const h = (height !== undefined && height !== null && height !== '') ? parseFloat(height) : null;
    const w = (weight !== undefined && weight !== null && weight !== '') ? parseFloat(weight) : null;
    const parsedBmi = bmi !== undefined && bmi !== null && bmi !== ''
      ? parseFloat(bmi) || null
      : (h && w && h > 0 ? parseFloat((w / ((h / 100) ** 2)).toFixed(1)) : null);

    const patientData = {
      name,
      age:         parseInt(age),
      sex,
      height:      h,
      weight:      w,
      bmi:         parsedBmi,
      race:        race       || null,
      smoking:     smoking    ? (typeof smoking    === 'string' ? smoking    : JSON.stringify(smoking))    : null,
      occupation:  occupation ? (typeof occupation === 'string' ? occupation : JSON.stringify(occupation)) : null,
      parity:      parity     ? parseInt(parity)   : null,
      dvt_history: dvt_history === true || dvt_history === 'true',
      clinic:      clinic      || null,
      doctor_notes: doctor_notes || null,
    };

    // Retry loop guards against the extremely unlikely case where a generated
    // UHID collides with one entered manually before this auto-generation was
    // introduced (e.g. leftover test data). Each retry pulls a fresh sequence
    // number, so this always converges.
    let patient;
    for (let attempt = 0; attempt < 5; attempt++) {
      const uhid = await generateNextUhid();
      try {
        patient = await prisma.patient.create({ data: { ...patientData, uhid } });
        break;
      } catch (err: any) {
        if (err.code === 'P2002' && attempt < 4) continue; // uhid collision — retry
        throw err;
      }
    }
    if (!patient) {
      res.status(500).json({ error: 'Failed to generate a unique UHID after multiple attempts' });
      return;
    }

    logAudit({
      doctorId:   req.user?.id,
      doctorName: req.user?.name,
      action:     'CREATE_PATIENT',
      patientId:  patient.id,
      details:    { uhid: patient.uhid },
    });

    const response = {
      ...patient,
      smoking:    safeParse(patient.smoking),
      occupation: safeParse(patient.occupation),
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

/** GET /api/patients/:id — Full patient with assessments + legs + images + doppler */
export async function getPatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id as string },
      include: {
        legs: {
          include: {
            images:        { orderBy: { uploaded_at: 'desc' } },
            dopplerImages: { orderBy: { uploaded_at: 'desc' } },
          },
          orderBy: { visited_at: 'desc' },
        },
        assessments: {
          orderBy: { assessment_date: 'desc' },
          take: 1, // latest assessment for quick access
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    logAudit({
      doctorId:   req.user?.id,
      doctorName: req.user?.name,
      action:     'VIEW_PATIENT',
      patientId:  patient.id,
    });

    const mapped = {
      ...patient,
      smoking:    safeParse(patient.smoking),
      occupation: safeParse(patient.occupation),
      legs: patient.legs.map(decorateLeg),
    };
    res.json(mapped);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

/** PUT /api/patients/:id — Update patient demographics only */
export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // NOTE: per-visit fields (comorbidities, medications, venous_history, clinical_notes,
    // veines_notes, r_pain_vas, l_pain_vas) are no longer on Patient.
    // If the frontend sends them, they are silently ignored here.
    const {
      name, age, sex, height, weight, bmi,
      race, smoking, occupation, parity,
      dvt_history, clinic, doctor_notes,
    } = req.body;

    const h = height !== undefined ? (height !== null && height !== '' ? parseFloat(height) : null) : existing.height;
    const w = weight !== undefined ? (weight !== null && weight !== '' ? parseFloat(weight) : null) : existing.weight;
    const parsedBmi = bmi !== undefined && bmi !== null && bmi !== ''
      ? parseFloat(bmi) || null
      : (h && w && h > 0 ? parseFloat((w / ((h / 100) ** 2)).toFixed(1)) : existing.bmi);

    const patient = await prisma.patient.update({
      where: { id: req.params.id as string },
      data: {
        ...(name         && { name }),
        ...(age          && { age: parseInt(age) }),
        ...(sex          && { sex }),
        height:      h,
        weight:      w,
        bmi:         parsedBmi,
        ...(race        !== undefined && { race }),
        ...(smoking     !== undefined && { smoking:    smoking    ? (typeof smoking    === 'string' ? smoking    : JSON.stringify(smoking))    : null }),
        ...(occupation  !== undefined && { occupation: occupation ? (typeof occupation === 'string' ? occupation : JSON.stringify(occupation)) : null }),
        ...(parity      !== undefined && { parity: parity ? parseInt(parity) : null }),
        ...(dvt_history !== undefined && { dvt_history: dvt_history === true || dvt_history === 'true' }),
        ...(clinic      !== undefined && { clinic }),
        ...(doctor_notes !== undefined && { doctor_notes }),
      },
    });

    logAudit({
      doctorId:   req.user?.id,
      doctorName: req.user?.name,
      action:     'UPDATE_PATIENT',
      patientId:  patient.id,
    });

    const response = {
      ...patient,
      smoking:    safeParse(patient.smoking),
      occupation: safeParse(patient.occupation),
    };
    res.json(response);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}
