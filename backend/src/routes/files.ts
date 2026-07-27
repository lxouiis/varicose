import { Router } from 'express';
import { getFile } from '../controllers/fileController';


const router = Router();

// Securely serve files — requires JWT
router.get('/:type/:id', getFile);

export default router;
