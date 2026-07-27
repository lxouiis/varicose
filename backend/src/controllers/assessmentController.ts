import { Request, Response } from 'express';
import { calculateCEAP } from '../utils/ceap';
import { calculateRvcss } from '../utils/rvcss';
import { logAudit } from '../utils/audit';

import { prisma } from '../lib/prisma';

// Helper to calculate score and normalize fields for Leg creation.
// Accepts both camelCase (frontend) and snake_case field names.
const toBool = (v: any) => v === true || v === 'true';

const buildLegData = (leg: any, legSide: 'right' | 'left', patientId: string) => {
  // Resolve camelCase (frontend LegExam) → snake_case with snake_case fallback
  const rawSigns = leg.clinicalSigns ?? leg.clinical_signs;
  const signsStr = rawSigns != null
    ? (Array.isArray(rawSigns) ? JSON.stringify(rawSigns) : String(rawSigns))
    : null;

  const deepSystem            = leg.deepSystem            || leg.deep_system              || null;
  const commonFemoralVein     = leg.commonFemoralVein     || leg.common_femoral_vein      || null;
  const superficialFemoralVein= leg.superficialFemoralVein|| leg.superficial_femoral_vein || null;
  const poplitealVein         = leg.poplitealVeinStatus   || leg.popliteal_vein           || null;
  const sfjReflux             = toBool(leg.sfjReflux      ?? leg.sfj_reflux);
  const gsvDiameter           = leg.gsvDiamMm             ?? leg.gsv_diameter;
  const gsvReflux             = toBool(leg.gsvReflux      ?? leg.gsv_reflux);
  const ssvDiameter           = leg.ssvDiameter           ?? leg.ssv_diameter;
  const ssvDiamMm             = leg.ssvDiamMm             ?? leg.ssv_diam_mm;
  const ssvReflux             = toBool(leg.ssvReflux      ?? leg.ssv_reflux);
  const incompetentPerforators= toBool(leg.incompetentPerforators ?? leg.incompetent_perforators);
  
  const cfvStatus       = leg.cfvStatus ?? leg.cfv_status;
  const femoralVStatus  = leg.femoralVStatus ?? leg.femoral_v_status;
  const poplitealStatus = leg.poplitealStatus ?? leg.popliteal_status;

  const pain         = parseInt(leg.pain)                                    || 0;
  const varicoseVeins= parseInt(leg.varicoseVeins    ?? leg.varicose_veins)  || 0;
  const edema        = parseInt(leg.venousEdema      ?? leg.edema)           || 0;
  const pigmentation = parseInt(leg.skinPigmentation ?? leg.pigmentation)    || 0;
  const inflammation = parseInt(leg.inflammation)                            || 0;
  const induration   = parseInt(leg.induration)                              || 0;
  const ulcerCount   = parseInt(leg.ulcerNumber      ?? leg.ulcer_count)     || 0;
  const ulcerDuration= parseInt(leg.ulcerDuration    ?? leg.ulcer_duration)  || 0;
  const ulcerSize    = parseInt(leg.ulcerSizeScore   ?? leg.ulcer_size)      || 0;
  const compression  = parseInt(leg.compressionCompliance ?? leg.compression)|| 0;

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

  const rvcss_total = calculateRvcss({
    pain, varicose_veins: varicoseVeins, edema, pigmentation,
    inflammation, induration, ulcer_count: ulcerCount,
    ulcer_duration: ulcerDuration, ulcer_size: ulcerSize, compression,
  });

  const ulcerSizeCmRaw = leg.ulcerSizeCm ?? leg.ulcer_size_cm;
  
  const ulcerPresent = toBool(leg.ulcerPresent ?? leg.ulcer_present);
  const ulcerLocation = leg.ulcerLocationText || leg.ulcer_location || null;
  const ulcerSizeCmParsed = ulcerSizeCmRaw ? parseFloat(ulcerSizeCmRaw) : null;
  const ulcerType = leg.ulcerType || leg.ulcer_type || null;
  const ulcerEdges = leg.ulcerEdges || leg.ulcer_edges || null;
  const ulcerBase = leg.ulcerBase || leg.ulcer_base || null;

  return {
    patient_id: patientId,
    leg_side: legSide,
    deep_system: deepSystem,
    common_femoral_vein: commonFemoralVein,
    superficial_femoral_vein: superficialFemoralVein,
    popliteal_vein: poplitealVein,
    sfj_reflux: sfjReflux,
    gsv_diameter: gsvDiameter ? parseFloat(gsvDiameter) : null,
    gsv_reflux: gsvReflux,
    ssv_diameter: ssvDiameter ? parseFloat(ssvDiameter) : null,
    ssv_diam_mm: ssvDiamMm ? parseFloat(ssvDiamMm) : null,
    ssv_reflux: ssvReflux,
    incompetent_perforators: incompetentPerforators,
    clinical_signs: signsStr,
    etiology: leg.etiology || null,
    cfv_status: cfvStatus || null,
    femoral_v_status: femoralVStatus || null,
    popliteal_status: poplitealStatus || null,
    ...ceap,
    pain, varicose_veins: varicoseVeins, edema, pigmentation,
    inflammation, induration,
    ulcer_count: ulcerCount, ulcer_duration: ulcerDuration,
    ulcer_size: ulcerSize, compression,
    rvcss_total,
    // Legacy fields
    ulcer_present: ulcerPresent,
    ulcer_location: ulcerLocation,
    ulcer_size_cm: ulcerSizeCmParsed,
    ulcer_type: ulcerType,
    ulcer_edges: ulcerEdges,
    ulcer_base: ulcerBase,
    // Per leg fields based on side
    ...(legSide === 'right' ? {
      ulcer_present_r: ulcerPresent,
      ulcer_location_r: ulcerLocation,
      ulcer_size_r: ulcerSizeCmParsed,
      ulcer_type_r: ulcerType,
      ulcer_edges_r: ulcerEdges,
      ulcer_base_r: ulcerBase,
    } : {
      ulcer_present_l: ulcerPresent,
      ulcer_location_l: ulcerLocation,
      ulcer_size_l: ulcerSizeCmParsed,
      ulcer_type_l: ulcerType,
      ulcer_edges_l: ulcerEdges,
      ulcer_base_l: ulcerBase,
    }),
    skin_changes: leg.skin     || leg.skin_changes || null,
    swelling_grade: leg.swelling != null ? String(leg.swelling) : (leg.swelling_grade || null),
    pain_vas: leg.pain_vas != null ? parseInt(leg.pain_vas) : null,
  };
};

/** POST /api/assessments — Create Assessment with both legs */
export async function createAssessment(req: Request, res: Response): Promise<void> {
  try {
    const { patientId, comorbidities, venousHistory, clinicalNotes, rightPainVas, leftPainVas, veinesNotes, rightLeg, leftLeg } = req.body;

    if (!patientId || !rightLeg || !leftLeg) {
      res.status(400).json({ error: 'patientId, rightLeg, and leftLeg are required' });
      return;
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Edge case: double submission check
    const recentAssessment = await prisma.assessment.findFirst({
      where: {
        patient_id: patientId,
        assessment_date: {
          gte: new Date(Date.now() - 10000) // within the last 10 seconds
        }
      }
    });

    if (recentAssessment) {
      res.status(409).json({ error: 'Duplicate submission detected. Assessment was already created.' });
      return;
    }

    const rightData = buildLegData(rightLeg, 'right', patientId);
    const leftData = buildLegData(leftLeg, 'left', patientId);
    const globalRvcss = (rightData.rvcss_total || 0) + (leftData.rvcss_total || 0);

    // Create assessment and legs in a transaction
    const assessment = await prisma.$transaction(async (tx) => {
      const newAss = await tx.assessment.create({
        data: {
          patient_id: patientId,
          assessed_by: req.user?.name || req.body.assessedBy || 'Unknown Doctor',
          comorbidities: comorbidities ? JSON.stringify(comorbidities) : null,
          venous_history: venousHistory ? JSON.stringify(venousHistory) : null,
          clinical_notes: clinicalNotes || null,
          veines_notes: veinesNotes || null,
          right_pain_vas: parseInt(rightPainVas) || null,
          left_pain_vas: parseInt(leftPainVas) || null,
          global_rvcss: globalRvcss,
        }
      });

      // Insert legs linking to assessment
      const rightLegRecord = await tx.leg.create({ data: { ...rightData, assessment_id: newAss.id } });
      const leftLegRecord = await tx.leg.create({ data: { ...leftData, assessment_id: newAss.id } });

      console.log('[createAssessment] Created legs:', { right: rightLegRecord.id, left: leftLegRecord.id });

      const result = await tx.assessment.findUnique({
        where: { id: newAss.id },
        include: { legs: true },
      });

      console.log('[createAssessment] Final result legs count:', result?.legs?.length);
      return result;
    });

    console.log('[createAssessment] Sending response with', assessment?.legs?.length, 'legs');

    logAudit({
      doctorId: req.user?.id,
      doctorName: req.user?.name,
      action: 'CREATE_ASSESSMENT',
      patientId,
      details: JSON.stringify({ assessmentId: assessment?.id }),
    });

    res.status(201).json(assessment);
  } catch (error: any) {
    console.error('Create assessment error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Conflict: Unique constraint failed. Duplicate assessment detected.' });
      return;
    }
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

/** GET /api/assessments/:patientId — Fetch all assessments and connected legs */
export async function getAssessments(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.params.patientId as string;

    const assessments = await prisma.assessment.findMany({
      where: { patient_id: patientId },
      include: {
        legs: {
          include: {
            dopplerImages: true,
            images: true
          }
        }
      },
      orderBy: { assessment_date: 'desc' }
    });

    res.json(assessments);
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
