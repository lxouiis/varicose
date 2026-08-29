import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Blocks every protected route until the doctor has changed a
// temporary/forced password. Mounted after authMiddleware on every router
// EXCEPT the change-password route itself (which a must-reset doctor still
// needs to reach).
//
// Deliberately re-reads must_reset_password from the database on every
// request instead of trusting a claim baked into the JWT at login time.
// The JWT is valid for 8 hours; if an admin resets someone's password
// mid-session (e.g. because the account was compromised), a claim frozen
// at login would let that old session keep working right through the
// reset — the one case this feature most needs to prevent. The extra
// lookup is a single indexed read on a users table with (at most) a few
// hundred rows, so the cost is negligible.
export async function requirePasswordSet(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    // authMiddleware should always run first and populate this; treat its
    // absence as a bug rather than silently allowing the request through.
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.user.id },
      select: { must_reset_password: true },
    });

    if (!doctor) {
      // Account was deleted after the token was issued.
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (doctor.must_reset_password) {
      res.status(403).json({
        error: 'Password reset required before continuing.',
        code: 'PASSWORD_RESET_REQUIRED',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[requirePasswordSet] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
