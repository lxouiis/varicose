import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import legRoutes from './routes/legs';
import assessmentRoutes from './routes/assessments';
import imageRoutes from './routes/images';
import dopplerRoutes from './routes/doppler';
import dopplerImagesRoutes from './routes/dopplerImages';
import fileRoutes from './routes/files';

// Load env vars
dotenv.config();

// ── Security: fail fast if critical secrets are missing ──────────────────────
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set.');
  console.error('[FATAL] Server refusing to start to protect patient data.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow local images to be loaded
}));

// CORS — restricted to intranet only. In Docker, frontend+backend are on the same
// internal network. The only external origin is the hospital's LAN IP (served by Nginx).
// Accept the server's own LAN address and localhost for dev.
const allowedOrigins = [
  'http://localhost:5173',   // dev
  'http://localhost:3000',   // dev alt
  'http://localhost',        // Docker Nginx on port 80
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : []),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any http://192.168.x.x or http://10.x.x.x (RFC-1918 private ranges)
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Ensure OPTIONS preflight returns 200 (Requirement 22)
app.options('*', cors());

app.use(express.json());

// Health check (Requirement 33)
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', project: 'CEVI', timestamp: new Date() });
});

// Auth Route
app.use('/api/auth', authRoutes);

// Apply JWT globally to all routes following this except /api/auth/login and /api/health (Requirement 2)
import { authMiddleware } from './middleware/auth';
// Routes (All /api routes require valid JWT via authMiddleware above)
app.use('/api/patients', patientRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/legs', legRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/doppler', dopplerRoutes);
app.use('/api/doppler-images', dopplerImagesRoutes);
app.use('/api/files', fileRoutes);

// 404 Catch-All Handler (Requirement 31)
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error handler
// NOTE: Never send raw error.message or stack to the client — it may contain
// table names, column names, SQL fragments, or file paths (patient data context).
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'File size limit exceeded (max 50 MB)' });
    return;
  }
  // Log full detail server-side only
  console.error('[Unhandled Exception]', err.stack || err);
  // Generic message to client — no internal detail
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
