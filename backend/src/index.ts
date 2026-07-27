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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow local images to be loaded
}));

// CORS Configuration (Requirement 21)
app.use(cors({
  origin: ['http://localhost:5173', 'http://cevi-hospital-prod-ip.local'], // Vite dev server and hypothetical production IP
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Ensure OPTIONS preflight returns 200 (Requirement 22)
app.options('*', cors());

app.use(express.json());

// Require Content-Type header on all responses (Requirement 23)
app.use((req: Request, res: Response, next: express.NextFunction) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Health check (Requirement 33)
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', project: 'CEVI', timestamp: new Date() });
});

// Auth Route
app.use('/api/auth', authRoutes);

// Apply JWT globally to all routes following this except /api/auth/login and /api/health (Requirement 2)
import { authMiddleware } from './middleware/auth';
app.use('/api', authMiddleware);

app.use('/storage', express.static(path.join(process.cwd(), 'storage')));

// Routes
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

// Global Error handler (Requirement 30)
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'File size limit exceeded' });
    return;
  }
  console.error('Unhandled Exception:', err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
