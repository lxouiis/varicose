import { Request, Response } from 'express';
import { calculateCEAP, formatCeapFull } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';

import { prisma } from '../lib/prisma';

const toBool = (v: any) => v === true || v === 'true';

const safeParse = (val: any) => {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch (e) {
    return [val];
  }
};

/** Helper — attach computed virtual fields (rvcss_total, ceap_full) to a leg for API responses */
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

/** POST /api/legs — Always INSERT a new leg visit (never upsert) */
export async function createLeg(req: Request, res: Response): Promise<void> {
  try {
    const {
      patient_id, leg_side, assessment_id,
      // Ultrasound/doppler fields — accepted for CEAP computation but NOT stored on Leg
      deep_system, common_femoral_vein, superficial_femoral_vein, popliteal_vein,
      sfj_reflux, gsv_diameter, gsv_reflux, ssv_diameter, ssv_reflux,
      incompetent_perforators, clinical_signs, etiology,
      // rVCSS scores
      pain, varicose_veins, edema, pigmentation, inflammation,
      induration, ulcer_count, ulcer_duration, ulcer_size, compression,
      // Ulcer exam (collapsed single set)
      ulcer_present, ulcer_location, ulcer_size_cm, ulcer_type, ulcer_edges, ulcer_base,
      // Skin & swelling
      skin_changes, swelling_grade,
      // Patient-reported VAS (per-leg, Float)
      pain_vas,
    } = req.body;

    if (!patient_id || !leg_side) {
      res.status(400).json({ error: 'patient_id and leg_side are required' });
      return;
    }

    if (!['left', 'right'].includes(leg_side)) {
      res.status(400).json({ error: 'leg_side must be "left" or "right"' });
      return;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Normalize clinical_signs for CEAP computation (not stored)
    const signsStr = clinical_signs
      ? (typeof clinical_signs === 'string' ? clinical_signs : JSON.stringify(clinical_signs))
      : null;

    // Compute CEAP components (stored); ceap_full computed on-the-fly in response
    const ceap = calculateCEAP({
      clinical_signs: signsStr,
      common_femoral_vein, superficial_femoral_vein, popliteal_vein,
      sfj_reflux: toBool(sfj_reflux),
      gsv_diameter: gsv_diameter ? parseFloat(gsv_diameter) : null,
      gsv_reflux: toBool(gsv_reflux),
      ssv_diameter: ssv_diameter ? parseFloat(ssv_diameter) : null,
      ssv_reflux: toBool(ssv_reflux),
      incompetent_perforators: toBool(incompetent_perforators),
      deep_system,
      etiology,
    });

    const leg = await prisma.leg.create({
      data: {
        patient_id,
        leg_side,
        assessment_id: assessment_id || null,
        // CEAP components
        ...ceap,
        // Raw clinical_signs for form pre-population
        clinical_signs: signsStr,
        // rVCSS scores
        pain:           parseInt(pain)           || 0,
        varicose_veins: parseInt(varicose_veins) || 0,
        edema:          parseInt(edema)          || 0,
        pigmentation:   parseInt(pigmentation)   || 0,
        inflammation:   parseInt(inflammation)   || 0,
        induration:     parseInt(induration)     || 0,
        ulcer_count:    parseInt(ulcer_count)    || 0,
        ulcer_duration: parseInt(ulcer_duration) || 0,
        ulcer_size:     parseInt(ulcer_size)     || 0,
        compression:    parseInt(compression)    || 0,
        // Patient-reported (Float)
        pain_vas: pain_vas != null ? parseFloat(pain_vas) : null,
        // Bedside ulcer exam
        ulcer_present:  toBool(ulcer_present),
        ulcer_location: ulcer_location || null,
        ulcer_size_cm:  ulcer_size_cm  ? parseFloat(ulcer_size_cm) : null,
        ulcer_type:     ulcer_type     || null,
        ulcer_edges:    ulcer_edges    || null,
        ulcer_base:     ulcer_base     || null,
        // Skin & swelling (swelling_grade is now Int)
        skin_changes:   skin_changes   || null,
        swelling_grade: swelling_grade != null ? parseInt(swelling_grade) : null,
      },
      include: { images: true, doppler: true, dopplerImages: true },
    });

    res.status(201).json(decorateLeg(leg));
  } catch (error) {
    console.error('Create leg error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

/** GET /api/legs/:patientId — Get ALL visits for a patient, sorted latest first */
export async function getLegs(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.params.patientId as string;

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const legs = await prisma.leg.findMany({
      where: { patient_id: patientId },
      include: {
        images:        { orderBy: { uploaded_at: 'desc' } },
        doppler:       { orderBy: { uploaded_at: 'desc' } },
        dopplerImages: { orderBy: { uploaded_at: 'desc' } },
      },
      orderBy: [{ visited_at: 'desc' }, { leg_side: 'asc' }],
    });

    const mapped = legs.map(decorateLeg);
    res.json(mapped);
  } catch (error) {
    console.error('Get legs error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}
