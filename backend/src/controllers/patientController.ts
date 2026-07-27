import { Request, Response } from 'express';
import { logAudit } from '../utils/audit';

import { prisma } from '../lib/prisma';


const safeParse = (val: any) => {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch(e) {
    return [val];
  }
};


/** GET /api/patients — List all patients with latest CEAP + rVCSS per leg side */
export async function listPatients(req: Request, res: Response): Promise<void> {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        legs: {
          select: {
            leg_side: true,
            ceap_full: true,
            rvcss_total: true,
            visit_number: true,
            visited_at: true,
          },
          orderBy: { visited_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const mapped = patients.map(p => {
      // Pick only the latest visit per leg side
      const latestRight = p.legs.find(l => l.leg_side === 'right') || null;
      const latestLeft  = p.legs.find(l => l.leg_side === 'left')  || null;
      return {
        ...p,
        ceap_right: latestRight?.ceap_full || null,
        ceap_left:  latestLeft?.ceap_full  || null,
        ceap_full:  latestRight?.ceap_full || latestLeft?.ceap_full || null,
        rvcss_total: Math.max(latestRight?.rvcss_total || 0, latestLeft?.rvcss_total || 0),
        comorbidities: safeParse(p.comorbidities),
        medications: safeParse(p.medications),
        venous_history: safeParse(p.venous_history),
      };
    });
    res.json(mapped);
  } catch (error) {
    console.error('List patients error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

/** POST /api/patients — Create new patient with UHID uniqueness check */
export async function createPatient(req: Request, res: Response): Promise<void> {
  try {
    console.log('[CREATE_PATIENT] req.body:', JSON.stringify(req.body, null, 2));
    const { name, uhid, age, sex, height, weight, bmi, race, smoking, occupation, parity,
      comorbidities, medications, venous_history, dvt_history, clinic, doctor_notes,
      clinical_notes, r_pain_vas, l_pain_vas, veines_notes } = req.body;

    if (!name || !uhid || !age || !sex) {
      res.status(400).json({ error: 'Name, UHID, age, and sex are required' });
      return;
    }

    const existing = await prisma.patient.findUnique({ where: { uhid } });
    if (existing) {
      res.status(409).json({ error: 'A patient with this UHID already exists' });
      return;
    }

    const h = (height !== undefined && height !== null && height !== '') ? parseFloat(height) : null;
    const w = (weight !== undefined && weight !== null && weight !== '') ? parseFloat(weight) : null;
    const parsedBmi = bmi !== undefined && bmi !== null && bmi !== ''
      ? parseFloat(bmi) || null
      : (h && w && h > 0 ? parseFloat((w / ((h / 100) ** 2)).toFixed(1)) : null);

    const patient = await prisma.patient.create({
      data: {
        name,
        uhid,
        age: parseInt(age),
        sex,
        height: h,
        weight: w,
        bmi: parsedBmi,
        race: race || null,
        smoking: smoking || null,
        occupation: occupation || null,
        parity: parity ? parseInt(parity) : null,
        comorbidities: comorbidities ? (typeof comorbidities === 'string' ? comorbidities : JSON.stringify(comorbidities)) : null,
        medications: medications ? (typeof medications === 'string' ? medications : JSON.stringify(medications)) : null,
        venous_history: venous_history ? (typeof venous_history === 'string' ? venous_history : JSON.stringify(venous_history)) : null,
        dvt_history: dvt_history === true || dvt_history === 'true',
        clinic: clinic || null,
        doctor_notes: doctor_notes || null,
        clinical_notes: clinical_notes || null,
        r_pain_vas: r_pain_vas !== undefined && r_pain_vas !== null ? parseFloat(r_pain_vas) : null,
        l_pain_vas: l_pain_vas !== undefined && l_pain_vas !== null ? parseFloat(l_pain_vas) : null,
        veines_notes: veines_notes || null,
      },
    });

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'CREATE_PATIENT',
      patientId: patient.id,
      details: { uhid: patient.uhid }
    });

    // Parse JSON fields before returning
    const response = {
      ...patient,
      comorbidities: safeParse(patient.comorbidities),
      medications: safeParse(patient.medications),
      venous_history: safeParse(patient.venous_history),
    };
    res.status(201).json(response);
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

/** GET /api/patients/:id — Full patient with legs + images + doppler */
export async function getPatient(req: Request, res: Response): Promise<void> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id as string },
      include: {
        legs: {
          include: {
            images: { orderBy: { uploaded_at: 'desc' } },
            doppler: { orderBy: { uploaded_at: 'desc' } },
            dopplerImages: { orderBy: { uploaded_at: 'desc' } },
          },
          orderBy: { visited_at: 'desc' },
        },
      },
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'VIEW_PATIENT',
      patientId: patient.id
    });

    const mapped = {
      ...patient,
      comorbidities: safeParse(patient.comorbidities),
      medications: safeParse(patient.medications),
      venous_history: safeParse(patient.venous_history),
    };
    res.json(mapped);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

/** PUT /api/patients/:id — Update patient demographics */
export async function updatePatient(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.patient.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const { name, age, sex, height, weight, bmi, race, smoking, occupation, parity,
      comorbidities, medications, venous_history, dvt_history, clinic, doctor_notes,
      clinical_notes, r_pain_vas, l_pain_vas, veines_notes } = req.body;

    const h = height !== undefined ? (height !== null && height !== '' ? parseFloat(height) : null) : existing.height;
    const w = weight !== undefined ? (weight !== null && weight !== '' ? parseFloat(weight) : null) : existing.weight;
    const parsedBmi = bmi !== undefined && bmi !== null && bmi !== ''
      ? parseFloat(bmi) || null
      : (h && w && h > 0 ? parseFloat((w / ((h / 100) ** 2)).toFixed(1)) : existing.bmi);

    const patient = await prisma.patient.update({
      where: { id: req.params.id as string },
      data: {
        ...(name && { name }),
        ...(age && { age: parseInt(age) }),
        ...(sex && { sex }),
        height: h,
        weight: w,
        bmi: parsedBmi,
        ...(race !== undefined && { race }),
        ...(smoking !== undefined && { smoking }),
        ...(occupation !== undefined && { occupation }),
        ...(parity !== undefined && { parity: parity ? parseInt(parity) : null }),
        ...(comorbidities !== undefined && { comorbidities: typeof comorbidities === 'string' ? comorbidities : JSON.stringify(comorbidities) }),
        ...(medications !== undefined && { medications: typeof medications === 'string' ? medications : JSON.stringify(medications) }),
        ...(venous_history !== undefined && { venous_history: typeof venous_history === 'string' ? venous_history : JSON.stringify(venous_history) }),
        ...(dvt_history !== undefined && { dvt_history: dvt_history === true || dvt_history === 'true' }),
        ...(clinic !== undefined && { clinic }),
        ...(doctor_notes !== undefined && { doctor_notes }),
        ...(clinical_notes !== undefined && { clinical_notes }),
        ...(r_pain_vas !== undefined && { r_pain_vas: r_pain_vas !== null ? parseFloat(r_pain_vas) : null }),
        ...(l_pain_vas !== undefined && { l_pain_vas: l_pain_vas !== null ? parseFloat(l_pain_vas) : null }),
        ...(veines_notes !== undefined && { veines_notes }),
      },
    });

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'UPDATE_PATIENT',
      patientId: patient.id
    });

    const response = {
      ...patient,
      comorbidities: safeParse(patient.comorbidities),
      medications: safeParse(patient.medications),
      venous_history: safeParse(patient.venous_history),
    };
    res.json(response);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
