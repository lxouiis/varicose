import { Router } from 'express';
import { createPatient, getPatient, listPatients, updatePatient } from '../controllers/patientController';


const router = Router();



router.get('/', listPatients);
router.post('/', createPatient);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);

export default router;
