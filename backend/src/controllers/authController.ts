import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { prisma } from '../lib/prisma';
import { logAudit } from '../utils/audit';

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

    res.json({ token, user: payload });
  } catch (error) {
    // Never send internal DB/server errors to the client
    console.error('[login] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
