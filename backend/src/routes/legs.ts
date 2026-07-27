import { Router } from 'express';
import { getLegs, createLeg } from '../controllers/legController';
import { legValidationRules, validateResult } from '../middleware/validate';

const router = Router();

router.post('/', legValidationRules, validateResult, createLeg);
router.get('/:patientId', getLegs);

export default router;
