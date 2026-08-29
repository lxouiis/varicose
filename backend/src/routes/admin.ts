import { Router } from 'express';
import { listDoctors, resetDoctorPassword } from '../controllers/adminController';

const router = Router();

router.get('/doctors', listDoctors);
router.post('/doctors/:id/reset-password', resetDoctorPassword);

export default router;
