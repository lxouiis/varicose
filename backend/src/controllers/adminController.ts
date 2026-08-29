import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

import { prisma } from '../lib/prisma';
import { logAudit } from '../utils/audit';
import { generateTempPassword } from '../utils/tempPassword';

/** GET /api/admin/doctors — list all doctor accounts for the admin panel. */
export async function listDoctors(req: Request, res: Response): Promise<void> {
  try {
    const doctors = await prisma.doctor.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        must_reset_password: true,
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(doctors.map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: d.role,
      mustResetPassword: d.must_reset_password,
      createdAt: d.created_at,
    })));
  } catch (error) {
    console.error('[listDoctors] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/doctors/:id/reset-password
 * Generates a new random temporary password, forces a reset on next login,
 * and returns the plaintext password once so the admin can relay it to the
 * doctor directly (this deployment has no email/SMS — see feature notes).
 *
 * The plaintext value is returned in this one response and nowhere else:
 * it is never passed to logAudit() or console.log(), and nothing else in
 * the codebase persists it outside the bcrypt hash written to the DB.
 */
export async function resetDoctorPassword(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid doctor id' });
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    await prisma.doctor.update({
      where: { id },
      data: { password: hash, must_reset_password: true },
    });

    logAudit({
      doctorId:   req.user?.id,
      doctorName: req.user?.name,
      action:     'ADMIN_RESET_PASSWORD',
      details:    { targetDoctorId: id, targetDoctorEmail: doctor.email }, // no password value
    });

    res.json({ tempPassword });
  } catch (error) {
    console.error('[resetDoctorPassword] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
