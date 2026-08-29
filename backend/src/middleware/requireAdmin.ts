import { Request, Response, NextFunction } from 'express';

// Gates admin-only routes. Trusts the `role` claim on the JWT — unlike
// must_reset_password (see requirePasswordSet.ts), role isn't changed by
// any in-app action in this feature, so there's no mid-session staleness
// risk to guard against here.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'Admin') {
    // 404 rather than 403 — don't reveal to a non-admin that an admin API
    // exists at this path.
    res.status(404).json({ error: 'Route not found' });
    return;
  }
  next();
}
