import { Request, Response } from 'express';
import { calculateCEAP } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';

import { prisma } from '../lib/prisma';

const toBool = (v: any) => v === true || v === 'true';

const safeParse = (val: any) => {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch(e) {
    return [val];
  }
};

/** POST /api/legs — Always INSERT a new leg visit (never upsert) */
export async function createLeg(req: Request, res: Response): Promise<void> {
  try {
    const {
      patient_id, leg_side, assessment_id,
      deep_system, common_femoral_vein, superficial_femoral_vein, popliteal_vein,
      sfj_reflux, gsv_diameter, gsv_reflux, ssv_diameter, ssv_diam_mm, ssv_reflux,
      incompetent_perforators, clinical_signs, etiology,
      cfv_status, femoral_v_status, popliteal_status,
      pain, varicose_veins, edema, pigmentation, inflammation,
      induration, ulcer_count, ulcer_duration, ulcer_size, compression,
      // Legacy single ulcer fields
      ulcer_present, ulcer_location, ulcer_size_cm, ulcer_type, ulcer_edges, ulcer_base,
      // Per-leg ulcer fields
      ulcer_present_r, ulcer_location_r, ulcer_size_r, ulcer_type_r, ulcer_edges_r, ulcer_base_r,
      ulcer_present_l, ulcer_location_l, ulcer_size_l, ulcer_type_l, ulcer_edges_l, ulcer_base_l,
      skin_changes, swelling_grade, pain_vas,
    } = req.body;

    if (!patient_id || !leg_side) {
      res.status(400).json({ error: 'patient_id and leg_side are required' });
      return;
    }

    if (!['left', 'right'].includes(leg_side)) {
      res.status(400).json({ error: 'leg_side must be "left" or "right"' });
      return;
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({ where: { id: patient_id } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Normalize clinical_signs to JSON string
    const signsStr = clinical_signs
      ? (typeof clinical_signs === 'string' ? clinical_signs : JSON.stringify(clinical_signs))
      : null;

    // Auto-calculate CEAP
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

    // Auto-calculate rVCSS
    const rvcss_total = calculateRvcss({
      pain: parseInt(pain) || 0,
      varicose_veins: parseInt(varicose_veins) || 0,
      edema: parseInt(edema) || 0,
      pigmentation: parseInt(pigmentation) || 0,
      inflammation: parseInt(inflammation) || 0,
      induration: parseInt(induration) || 0,
      ulcer_count: parseInt(ulcer_count) || 0,
      ulcer_duration: parseInt(ulcer_duration) || 0,
      ulcer_size: parseInt(ulcer_size) || 0,
      compression: parseInt(compression) || 0,
    });

    // Calculate visit_number: count existing visits for this patient+side, then +1
    const existingVisits = await prisma.leg.count({
      where: { patient_id, leg_side },
    });
    const visit_number = existingVisits + 1;

    const leg = await prisma.leg.create({
      data: {
        patient_id,
        leg_side,
        visit_number,
        assessment_id:            assessment_id           || null,
        deep_system:              deep_system             || null,
        common_femoral_vein:      common_femoral_vein     || null,
        superficial_femoral_vein: superficial_femoral_vein || null,
        popliteal_vein:           popliteal_vein          || null,
        sfj_reflux:               toBool(sfj_reflux),
        cfv_status:               cfv_status              || null,
        femoral_v_status:         femoral_v_status        || null,
        popliteal_status:         popliteal_status        || null,
        gsv_diameter:             gsv_diameter            ? parseFloat(gsv_diameter)  : null,
        gsv_reflux:               toBool(gsv_reflux),
        ssv_diameter:             ssv_diameter            ? parseFloat(ssv_diameter)  : null,
        ssv_diam_mm:              ssv_diam_mm             ? parseFloat(ssv_diam_mm)   : null,
        ssv_reflux:               toBool(ssv_reflux),
        incompetent_perforators:  toBool(incompetent_perforators),
        clinical_signs:           signsStr,
        etiology:                 etiology                || null,
        ...ceap,
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
        rvcss_total,
        // Legacy ulcer fields
        ulcer_present:   toBool(ulcer_present),
        ulcer_location:  ulcer_location  || null,
        ulcer_size_cm:   ulcer_size_cm   ? parseFloat(ulcer_size_cm)   : null,
        ulcer_type:      ulcer_type      || null,
        ulcer_edges:     ulcer_edges     || null,
        ulcer_base:      ulcer_base      || null,
        // Right-leg specific ulcer
        ulcer_present_r: toBool(ulcer_present_r),
        ulcer_location_r: ulcer_location_r || null,
        ulcer_size_r:    ulcer_size_r     ? parseFloat(ulcer_size_r)    : null,
        ulcer_type_r:    ulcer_type_r     || null,
        ulcer_edges_r:   ulcer_edges_r    || null,
        ulcer_base_r:    ulcer_base_r     || null,
        // Left-leg specific ulcer
        ulcer_present_l: toBool(ulcer_present_l),
        ulcer_location_l: ulcer_location_l || null,
        ulcer_size_l:    ulcer_size_l     ? parseFloat(ulcer_size_l)    : null,
        ulcer_type_l:    ulcer_type_l     || null,
        ulcer_edges_l:   ulcer_edges_l    || null,
        ulcer_base_l:    ulcer_base_l     || null,
        skin_changes:    skin_changes     || null,
        swelling_grade:  swelling_grade   || null,
        pain_vas:        pain_vas != null  ? parseInt(pain_vas) : null,
      },
      include: { images: true, doppler: true, dopplerImages: true },
    });

    res.status(201).json(leg);
  } catch (error) {
    console.error('Create leg error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
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

    const mapped = legs.map(l => ({
      ...l,
      clinical_signs: safeParse(l.clinical_signs),
    }));
    res.json(mapped);
  } catch (error) {
    console.error('Get legs error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
