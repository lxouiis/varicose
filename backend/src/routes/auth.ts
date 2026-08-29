import { Router } from 'express';
import { login, changePassword } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
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

// Authenticated but deliberately NOT behind requirePasswordSet (see
// index.ts) — this is the one route a must-reset doctor needs to reach to
// get past the forced-reset gate. Still covered by the /api/auth-wide
// loginLimiter mounted in index.ts, which also throttles guesses at a
// doctor's current password here.
router.post('/change-password', authMiddleware, changePassword);

export default router;
