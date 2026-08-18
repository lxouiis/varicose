import { Router, Request, Response } from 'express';
import { dopplerUpload, uploadDopplerImage } from '../controllers/uploadController';
import { dopplerImageValidationRules, validateResult } from '../middleware/validate';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/doppler-images/visit/:assessmentId — fetch all doppler images for an assessment/visit
router.get('/visit/:assessmentId', async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;

    // Find all legs linked to this assessment
    const legs = await prisma.leg.findMany({
      where: { assessment_id: assessmentId as string },
      include: { dopplerImages: true },
    });

    const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

    const images = legs.flatMap((leg) =>
      leg.dopplerImages.map((d: any) => ({
        id: d.id,
        leg: leg.leg_side as 'right' | 'left',
        phase: d.phase as 'deep' | 'sfj_gsv' | 'spj_ssv' | 'accessory',
        segment: d.segment,
        view: d.view_type || '',
        filePath: d.file_path,
        fileName: d.file_name || d.file_path?.split('/').pop() || '',
        previewUrl: d.file_path ? `${BASE_URL}/${d.file_path}` : undefined,
        veinStatus:    d.vein_status,
        compressible:  d.compressible,
        spontaneous:   d.spontaneous_flow,
        refluxMs:      d.reflux_ms,
        refluxPositive: d.reflux_positive,
        diameterMm:    d.diameter_mm,
        outwardFlow350: d.outward_flow,
        doctorNotes:   d.doctor_notes,
      }))
    );

    res.json(images);
  } catch (error) {
    console.error('Get doppler images error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post(
  '/',
  dopplerUpload.single('file'),
  dopplerImageValidationRules,
  validateResult,
  uploadDopplerImage
);

export default router;
