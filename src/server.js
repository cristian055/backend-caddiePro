import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import caddieRoutes from './routes/caddie.js';
import turnRoutes from './routes/turn.js';
import attendanceRoutes from './routes/attendance.js';
import listSettingsRoutes from './routes/listSettings.js';
import reportsRoutes from './routes/reports.js';
import messagesRoutes from './routes/messages.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CaddiePro API is running' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/caddies', caddieRoutes);
app.use('/api/turns', turnRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/list-settings', listSettingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/messages', messagesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server only if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API URL: http://localhost:${PORT}`);
  });
}

export default app;
