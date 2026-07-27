import { Router } from 'express';
import { imageUpload, uploadImage } from '../controllers/uploadController';


const router = Router();



router.post('/', imageUpload.single('image'), uploadImage);

export default router;
