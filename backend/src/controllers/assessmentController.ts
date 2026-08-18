import { Request, Response } from 'express';
import { calculateCEAP, formatCeapFull } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';
import { logAudit } from '../utils/audit';

import { prisma } from '../lib/prisma';

// Helper: coerce various truthy/falsy values to boolean
const toBool = (v: any) => v === true || v === 'true';

/**
 * buildLegData — Normalizes all incoming leg fields from the frontend
 * and returns only the fields that exist in the normalized Leg schema.
 *
 * Key normalization rules (v2):
 * - Ultrasound flat fields (deep_system, cfv_status, gsv_diameter, sfj_reflux, etc.)
 *   are accepted for CEAP computation but NOT stored on the Leg row.
 *   They belong in DopplerImage (uploaded separately).
 * - clinical_signs and etiology are accepted for CEAP C/E computation but NOT stored.
 * - ceap_full and rvcss_total are NOT stored (computed on-the-fly in responses).
 * - ulcer_*_r / ulcer_*_l column duplicates are collapsed into single ulcer_* fields.
 * - pain_vas is stored as Float (was Int).
 * - swelling_grade is stored as Int (was String).
 */
const buildLegData = (leg: any, legSide: 'right' | 'left', patientId: string) => {
  // Resolve clinical signs (camelCase and snake_case fallbacks)
  const rawSigns = leg.clinicalSigns ?? leg.clinical_signs;
  const signsStr = rawSigns != null
    ? (Array.isArray(rawSigns) ? JSON.stringify(rawSigns) : String(rawSigns))
    : null;

  // Ultrasound/doppler fields — used ONLY for CEAP computation, not stored on Leg
  const deepSystem              = leg.deepSystem            || leg.deep_system              || null;
  const commonFemoralVein       = leg.commonFemoralVein     || leg.common_femoral_vein      || null;
  const superficialFemoralVein  = leg.superficialFemoralVein || leg.superficial_femoral_vein || null;
  const poplitealVein           = leg.poplitealVeinStatus   || leg.popliteal_vein           || null;
  const sfjReflux               = toBool(leg.sfjReflux      ?? leg.sfj_reflux);
  const gsvDiameter             = leg.gsvDiamMm             ?? leg.gsv_diameter;
  const gsvReflux               = toBool(leg.gsvReflux      ?? leg.gsv_reflux);
  const ssvDiameter             = leg.ssvDiameter           ?? leg.ssv_diameter;
  const ssvReflux               = toBool(leg.ssvReflux      ?? leg.ssv_reflux);
  const incompetentPerforators  = toBool(leg.incompetentPerforators ?? leg.incompetent_perforators);

  // rVCSS component scores (0–3)
  const pain          = parseInt(leg.pain)                                    || 0;
  const varicoseVeins = parseInt(leg.varicoseVeins    ?? leg.varicose_veins)  || 0;
  const edema         = parseInt(leg.venousEdema      ?? leg.edema)           || 0;
  const pigmentation  = parseInt(leg.skinPigmentation ?? leg.pigmentation)    || 0;
  const inflammation  = parseInt(leg.inflammation)                            || 0;
  const induration    = parseInt(leg.induration)                              || 0;
  const ulcerCount    = parseInt(leg.ulcerNumber      ?? leg.ulcer_count)     || 0;
  const ulcerDuration = parseInt(leg.ulcerDuration    ?? leg.ulcer_duration)  || 0;
  const ulcerSize     = parseInt(leg.ulcerSizeScore   ?? leg.ulcer_size)      || 0;
  const compression   = parseInt(leg.compressionCompliance ?? leg.compression) || 0;

  // Compute CEAP components (stored); ceap_full is NOT stored (computed on-the-fly)
  const ceap = calculateCEAP({
    clinical_signs: signsStr,
    common_femoral_vein: commonFemoralVein,
    superficial_femoral_vein: superficialFemoralVein,
    popliteal_vein: poplitealVein,
    sfj_reflux: sfjReflux,
    gsv_diameter: gsvDiameter ? parseFloat(gsvDiameter) : null,
    gsv_reflux: gsvReflux,
    ssv_diameter: ssvDiameter ? parseFloat(ssvDiameter) : null,
    ssv_reflux: ssvReflux,
    incompetent_perforators: incompetentPerforators,
    deep_system: deepSystem,
    etiology: leg.etiology || null,
  });

  // Ulcer fields (collapsed from _r/_l duplicates into single fields using leg_side context)
  const ulcerPresent = toBool(leg.ulcerPresent ?? leg.ulcer_present);
  const ulcerLocation = leg.ulcerLocationText || leg.ulcer_location || null;
  const ulcerSizeCm = (leg.ulcerSizeCm ?? leg.ulcer_size_cm) ? parseFloat(leg.ulcerSizeCm ?? leg.ulcer_size_cm) : null;
  const ulcerType = leg.ulcerType   || leg.ulcer_type  || null;
  const ulcerEdges = leg.ulcerEdges  || leg.ulcer_edges || null;
  const ulcerBase = leg.ulcerBase   || leg.ulcer_base  || null;

  return {
    patient_id:    patientId,
    leg_side:      legSide,
    // CEAP components (doctor labels derived from clinical input)
    ...ceap,
    // Store raw clinical_signs for form pre-population (ceap_c is still the authority)
    clinical_signs: signsStr,
    // rVCSS scores (stored individually; rvcss_total computed on-the-fly)
    pain, varicose_veins: varicoseVeins, edema, pigmentation,
    inflammation, induration,
    ulcer_count: ulcerCount, ulcer_duration: ulcerDuration,
    ulcer_size: ulcerSize, compression,
    // Patient-reported VAS (Float, per-leg)
    pain_vas: leg.pain_vas != null ? parseFloat(leg.pain_vas) : null,
    // Bedside ulcer exam (single set of fields, not duplicated per side)
    ulcer_present: ulcerPresent,
    ulcer_location: ulcerLocation,
    ulcer_size_cm: ulcerSizeCm,
    ulcer_type: ulcerType,
    ulcer_edges: ulcerEdges,
    ulcer_base: ulcerBase,
    // Skin & swelling
    skin_changes: leg.skin || leg.skin_changes || null,
    swelling_grade: leg.swelling != null ? parseInt(leg.swelling) : (leg.swelling_grade != null ? parseInt(leg.swelling_grade) : null),
  };
};

/** Helper — attach computed virtual fields (rvcss_total, ceap_full) to a leg row for API responses */
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

/** POST /api/assessments — Create a new Assessment with both legs */
export async function createAssessment(req: Request, res: Response): Promise<void> {
  try {
    const {
      patientId,
      // Per-visit history (now lives on Assessment, not Patient)
      comorbidities, venousHistory, medications, clinicalNotes, veinesNotes,
      // General exam (previously silently dropped)
      bp, pulse, generalSigns,
      // Legs
      rightLeg, leftLeg,
    } = req.body;

    if (!patientId || !rightLeg || !leftLeg) {
      res.status(400).json({ error: 'patientId, rightLeg, and leftLeg are required' });
      return;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Duplicate-submission guard (10-second window)
    const recentAssessment = await prisma.assessment.findFirst({
      where: {
        patient_id: patientId,
        assessment_date: { gte: new Date(Date.now() - 10000) },
      },
    });
    if (recentAssessment) {
      res.status(409).json({ error: 'Duplicate submission detected. Assessment was already created.' });
      return;
    }

    const rightData = buildLegData(rightLeg, 'right', patientId);
    const leftData  = buildLegData(leftLeg,  'left',  patientId);

    const assessment = await prisma.$transaction(async (tx) => {
      const newAss = await tx.assessment.create({
        data: {
          patient_id: patientId,
          // doctor_id from authenticated user (if available)
          ...(req.user?.id ? { doctor_id: req.user.id } : {}),
          comorbidities:  comorbidities  ? JSON.stringify(comorbidities)  : null,
          venous_history: venousHistory  ? JSON.stringify(venousHistory)  : null,
          medications:    medications    ? JSON.stringify(medications)    : null,
          clinical_notes: clinicalNotes  || null,
          veines_notes:   veinesNotes    || null,
          // General exam — these were previously silently dropped!
          bp:            bp    || null,
          pulse:         pulse ? parseInt(pulse) : null,
          general_signs: generalSigns ? JSON.stringify(generalSigns) : null,
        },
      });

      const rightLegRecord = await tx.leg.create({ data: { ...rightData, assessment_id: newAss.id } });
      const leftLegRecord  = await tx.leg.create({ data: { ...leftData,  assessment_id: newAss.id } });

      console.log('[createAssessment] Created legs:', { right: rightLegRecord.id, left: leftLegRecord.id });

      const result = await tx.assessment.findUnique({
        where: { id: newAss.id },
        include: {
          doctor: { select: { id: true, name: true, role: true } },
          legs: {
            include: { dopplerImages: true, images: true },
          },
        },
      });

      return result;
    });

    // Attach computed fields to each leg in the response
    const responseAssessment = {
      ...assessment,
      legs: assessment?.legs.map(decorateLeg) ?? [],
    };

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'CREATE_ASSESSMENT',
      patientId,
      details: JSON.stringify({ assessmentId: assessment?.id }),
    });

    res.status(201).json(responseAssessment);
  } catch (error: any) {
    console.error('Create assessment error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Conflict: Unique constraint failed. Duplicate assessment detected.' });
      return;
    }
    res.status(500).json({ error: 'Database error' });
  }
}

/** GET /api/assessments/:patientId — Fetch all assessments and connected legs */
export async function getAssessments(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.params.patientId as string;

    const assessments = await prisma.assessment.findMany({
      where: { patient_id: patientId },
      include: {
        doctor: { select: { id: true, name: true, role: true } },
        legs: {
          include: {
            dopplerImages: true,
            images: true,
          },
        },
      },
      orderBy: { assessment_date: 'desc' },
    });

    // Attach computed rvcss_total and ceap_full to each leg row
    const response = assessments.map(a => ({
      ...a,
      legs: a.legs.map(decorateLeg),
    }));

    res.json(response);
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}
