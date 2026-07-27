import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

import { prisma } from '../lib/prisma';

/**
 * GET /api/files/:type/:id
 * Streams a stored clinical image or doppler file securely.
 * Checks JWT via middleware before reaching here.
 */
export async function getFile(req: Request, res: Response): Promise<void> {
  try {
    const { type, id } = req.params;
    const fileId = parseInt(id as string);

    if (isNaN(fileId)) {
      res.status(400).json({ error: 'Invalid file ID' });
      return;
    }

    let filePath: string | null = null;
    let mimeType: string = 'application/octet-stream';

    if (type === 'image') {
      const record = await prisma.image.findUnique({ where: { id: fileId } });
      if (record) {
        filePath = record.file_path;
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.png') mimeType = 'image/png';
      }
    } else if (type === 'doppler') {
      const record = await prisma.doppler.findUnique({ where: { id: fileId } });
      if (record) {
        filePath = record.file_path;
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') mimeType = 'application/pdf';
        else if (ext === '.dcm') mimeType = 'application/dicom';
        else if (ext === '.frm') mimeType = 'application/octet-stream'; // Proprietary
      }
    } else {
      res.status(400).json({ error: 'Invalid file type' });
      return;
    }

    if (!filePath) {
      res.status(404).json({ error: 'File record not found in database' });
      return;
    }

    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    // Set headers and stream file
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(absolutePath)}"`);
    res.sendFile(absolutePath);

  } catch (error) {
    console.error('Secure file access error:', error);
    res.status(500).json({ error: 'Internal server error while retrieving file' });
  }
}
