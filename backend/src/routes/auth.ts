import { Router } from 'express';
import { login } from '../controllers/authController';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per IP per window (hospital NAT — many users share one IP)
  message: { error: 'Too many login attempts from this network. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);

export default router;
