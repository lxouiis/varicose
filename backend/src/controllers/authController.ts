import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { prisma } from '../lib/prisma';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { email } });
    if (!doctor) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const payload = {
      id: doctor.id,
      email: doctor.email,
      name: doctor.name,
      role: doctor.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: '8h',
    });

    res.json({
      token,
      user: payload,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
