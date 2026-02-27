import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import listingsRoutes from './routes/listings.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : '*';
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/conversations', messagesRoutes);
app.use('/api/upload', uploadRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

app.listen(PORT, () => {
    console.log(`🚀 RealEats server running on port ${PORT}`);
});

export default app;
