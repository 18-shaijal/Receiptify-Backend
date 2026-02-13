import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import uploadRoutes from './routes/uploadRoutes';
import documentRoutes from './routes/documentRoutes';
import { scheduleCleanup } from './utils/fileCleanup';
import { ensureDirectoryExists } from './utils/validators';
import { CONFIG } from './config';

const app: Application = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors({
    origin: CONFIG.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

ensureDirectoryExists(CONFIG.UPLOAD_DIR);

// Connect to MongoDB
mongoose.connect(CONFIG.MONGODB_URI)
    .then(() => console.log('🍃 Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api', documentRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Receipt Generator API is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${path.resolve(CONFIG.UPLOAD_DIR)}`);

    // Schedule file cleanup
    scheduleCleanup([CONFIG.UPLOAD_DIR], CONFIG.CLEANUP_INTERVAL_HOURS, CONFIG.CLEANUP_INTERVAL_HOURS);
    console.log(`🧹 File cleanup scheduled every ${CONFIG.CLEANUP_INTERVAL_HOURS} hours`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

export default app;
