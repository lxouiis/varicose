import { Router } from 'express';
import { body } from 'express-validator';
import { createAssessment, getAssessments } from '../controllers/assessmentController';
import { validate } from '../middleware/validate';

const router = Router();

// Retrieve all assessments for a patient
router.get('/:patientId', getAssessments);

// Create a new assessment with leg data
router.post('/',
  [
    body('patientId').isString().notEmpty(),
    body('rightLeg.gsvDiamMm').optional().customSanitizer(val => {
      if (val == null || val === '') return null;
      const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    }),
    body('leftLeg.gsvDiamMm').optional().customSanitizer(val => {
      if (val == null || val === '') return null;
      const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    }),
    body('rightLeg.clinicalSigns').optional().customSanitizer(val => {
      if (val == null || val === 'null' || (Array.isArray(val) && val.length === 0)) return null;
      return val;
    }),
    body('leftLeg.clinicalSigns').optional().customSanitizer(val => {
      if (val == null || val === 'null' || (Array.isArray(val) && val.length === 0)) return null;
      return val;
    })
  ],
  validate,
  createAssessment
);

export default router;
