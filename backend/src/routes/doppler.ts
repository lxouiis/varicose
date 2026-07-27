import { Router } from 'express';
import { dopplerUpload, uploadDoppler } from '../controllers/uploadController';


const router = Router();



router.post('/', dopplerUpload.single('file'), uploadDoppler);

export default router;
