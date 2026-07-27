import { Router } from 'express';
import { login } from '../controllers/authController';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per window
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);

export default router;
