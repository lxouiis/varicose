import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { prisma } from '../lib/prisma';
import { logAudit } from '../utils/audit';
import { MIN_PASSWORD_LENGTH } from '../utils/tempPassword';

const JWT_SECRET = process.env.JWT_SECRET;

export async function login(req: Request, res: Response): Promise<void> {
  try {
    if (!JWT_SECRET) {
      // Server misconfiguration — never reveal details to the client
      console.error('[SECURITY] JWT_SECRET is not set. Server cannot issue tokens safely.');
      res.status(503).json({ error: 'Server configuration error. Contact system administrator.' });
      return;
    }

    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Generic message on failure — never reveal whether email exists
    const GENERIC_AUTH_ERROR = 'Invalid email or password';

    const doctor = await prisma.doctor.findUnique({ where: { email } });
    if (!doctor) {
      res.status(401).json({ error: GENERIC_AUTH_ERROR });
      return;
    }

    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      logAudit({
        action:     'LOGIN_FAILED',
        doctorName: email,
        details:    { reason: 'wrong_password' },
      });
      res.status(401).json({ error: GENERIC_AUTH_ERROR });
      return;
    }

    const payload = {
      id:    doctor.id,
      email: doctor.email,
      name:  doctor.name,
      role:  doctor.role,
    };

    // 8-hour session — typical hospital shift
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    logAudit({
      doctorId:   doctor.id,
      doctorName: doctor.name,
      action:     'LOGIN_SUCCESS',
    });

    // mustResetPassword rides along in the response body (read fresh from the
    // DB above) purely so the frontend can redirect straight to the reset
    // screen without an extra round trip. It is NOT part of the JWT payload —
    // every protected route re-checks the current value server-side via
    // requirePasswordSet, so this field is a UX convenience only, never the
    // source of truth for access control.
    res.json({ token, user: payload, mustResetPassword: doctor.must_reset_password });
  } catch (error) {
    // Never send internal DB/server errors to the client
    console.error('[login] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/change-password
 * Authenticated (via authMiddleware) but deliberately NOT behind
 * requirePasswordSet — this is the one route a must-reset doctor needs to
 * reach. Used both for the mandatory first-login/post-admin-reset flow and
 * for an ordinary voluntary password change later.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: req.user.id } });
    if (!doctor) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const currentValid = await bcrypt.compare(currentPassword, doctor.password);
    if (!currentValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Reject reuse of the current (temp or otherwise) password. Comparing
    // against the live hash — rather than a separate "is this the temp
    // password" flag — covers the first-reset case and any later voluntary
    // change with the same check.
    const sameAsCurrent = await bcrypt.compare(newPassword, doctor.password);
    if (sameAsCurrent) {
      res.status(400).json({ error: 'New password must be different from your current password' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { password: newHash, must_reset_password: false },
    });

    // Audit that a reset happened — never the password value itself, before
    // or after hashing.
    logAudit({
      doctorId:   doctor.id,
      doctorName: doctor.name,
      action:     'PASSWORD_CHANGED',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[changePassword] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
