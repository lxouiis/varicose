import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { prisma } from '../lib/prisma';

// ── Helper: resolve patient uhid from leg_id ──────────────────────────────────
async function getPatientDir(legId: number, subfolder: string): Promise<string> {
  const leg = await prisma.leg.findUnique({
    where: { id: legId },
    include: { patient: { select: { uhid: true } } },
  });
  if (!leg) throw new Error('Leg not found');
  if (!leg.patient) throw new Error('Associated patient not found');
  const dir = path.join(process.cwd(), 'storage', 'patients', leg.patient.uhid, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Image upload config (clinical photos) ─────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const dir = await getPatientDir(parseInt(req.body.leg_id), 'images');
      cb(null, dir);
    } catch (err) { cb(err as Error, ''); }
  },
  filename: (_req, file, cb) => {
    const side = _req.body.leg_side || _req.body.side || 'unknown';
    const view = _req.body.view_type || 'photo';
    const label = _req.body.view_label || '';
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = label ? label.toLowerCase().replace(/\s+/g, '_') : view;
    cb(null, `${safeName}_${side}_${Date.now()}${ext}`);
  },
});

export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only JPG and PNG files are allowed'));
  },
});

// ── Doppler upload config (legacy + new structured) ───────────────────────────
const dopplerStorage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const dir = await getPatientDir(parseInt(req.body.leg_id), 'doppler');
      cb(null, dir);
    } catch (err) { cb(err as Error, ''); }
  },
  filename: (_req, file, cb) => {
    const providedName = _req.body.file_name;
    const ext = path.extname(file.originalname) || '.jpg';
    if (providedName) {
      const safeName = path.basename(providedName, path.extname(providedName)).replace(/[^a-zA-Z0-9_\-]/g, '_');
      cb(null, `${safeName}${ext}`);
    } else {
      cb(null, `doppler_${Date.now()}${ext}`);
    }
  },
});

export const dopplerUpload = multer({
  storage: dopplerStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.frm', '.dcm', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, FRM, DCM, JPG, and PNG files are allowed'));
  },
});

// ── POST /api/images — Upload clinical image ──────────────────────────────────
export async function uploadImage(req: Request, res: Response): Promise<void> {
  try {
    console.log('[uploadImage] req.body:', req.body);

    if (!req.file || req.file.size === 0) {
      if (req.file?.size === 0) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'No file uploaded or file is empty' });
      return;
    }

    const legId = parseInt(req.body.leg_id);
    if (isNaN(legId)) { res.status(400).json({ error: 'leg_id must be a number' }); return; }

    const leg = await prisma.leg.findUnique({ where: { id: legId } });
    if (!leg) { res.status(404).json({ error: 'Leg not found' }); return; }

    const relativePath = path.relative(process.cwd(), req.file.path);

    const image = await prisma.image.create({
      data: {
        leg_id:     legId,
        file_path:  relativePath,
        view_type:  req.body.view_type  || 'photo',
        phase:      req.body.phase      || null,
        segment:    req.body.segment    || null,
        leg_side:   req.body.leg_side   || null,
        view_label: req.body.view_label || null,
      },
    });

    console.log('[uploadImage] Created image record:', image.id);
    res.status(201).json(image);
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

// ── POST /api/doppler — Legacy Doppler upload (backwards compat) ──────────────
export async function uploadDoppler(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file || req.file.size === 0) {
      if (req.file?.size === 0) fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'No file uploaded or file is empty' });
      return;
    }

    const legId = parseInt(req.body.leg_id);
    const leg = await prisma.leg.findUnique({ where: { id: legId } });
    if (!leg) { res.status(404).json({ error: 'Leg not found' }); return; }

    const relativePath = path.relative(process.cwd(), req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    const doppler = await prisma.doppler.create({
      data: {
        leg_id:           legId,
        file_path:        relativePath,
        file_type:        ext,
        vein_type:        req.body.vein_type        || null,
        vein_diameter:    req.body.vein_diameter    ? parseFloat(req.body.vein_diameter)    : null,
        reflux_time:      req.body.reflux_time      ? parseFloat(req.body.reflux_time)      : null,
        deep_vein_status: req.body.deep_vein_status || null,
      },
    });

    res.status(201).json(doppler);
  } catch (error) {
    console.error('Upload doppler error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}

// ── POST /api/doppler-images — Structured DopplerImage upload ─────────────────
export async function uploadDopplerImage(req: Request, res: Response): Promise<void> {
  try {
    // File is now optional; data-only uploads are allowed.
    if (req.file?.size === 0) {
      fs.unlinkSync(req.file.path);
    }

    const legId = parseInt(req.body.leg_id);
    if (isNaN(legId)) { res.status(400).json({ error: 'leg_id must be a number' }); return; }

    const { leg_side, phase, segment, view_type, file_name } = req.body;
    if (!leg_side || !phase || !segment) {
      res.status(400).json({ error: 'leg_side, phase, and segment are required' });
      return;
    }

    const leg = await prisma.leg.findUnique({ where: { id: legId } });
    if (!leg) { res.status(404).json({ error: 'Leg not found' }); return; }

    const relativePath = req.file && req.file.size > 0 ? path.relative(process.cwd(), req.file.path) : null;
    const ext = req.file && req.file.size > 0 ? (path.extname(req.file.originalname).toLowerCase().replace('.', '') || 'jpg') : (req.body.file_path ? req.body.file_path.split('.').pop() : null);

    const parseBool = (v: any): boolean | null => {
      if (v === 'true' || v === true)  return true;
      if (v === 'false' || v === false) return false;
      return null;
    };
    const parseNum = (v: any): number | null =>
      (v !== undefined && v !== '') ? parseFloat(v) : null;

    const record = await prisma.dopplerImage.create({
      data: {
        leg_id:           legId,
        leg_side:         leg_side,
        phase:            phase,
        segment:          segment,
        view_type:        view_type || null,
        file_path:        relativePath || req.body.file_path || null,
        file_name:        file_name || (req.file ? req.file.originalname : null),
        file_ext:         ext,
        compressible:     parseBool(req.body.compressible),
        spontaneous_flow: parseBool(req.body.spontaneous_flow),
        reflux_ms:        parseNum(req.body.reflux_ms),
        reflux_positive:  parseBool(req.body.reflux_positive),
        diameter_mm:      parseNum(req.body.diameter_mm),
        outward_flow:     parseBool(req.body.outward_flow),
      },
    });

    console.log('[uploadDopplerImage] Created DopplerImage record:', record.id);
    res.status(201).json(record);
  } catch (error) {
    console.error('Upload doppler image error:', error);
    res.status(500).json({ error: 'Database error', detail: (error as Error).message });
  }
}
