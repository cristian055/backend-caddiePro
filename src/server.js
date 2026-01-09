import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Import routes
import authRoutes from './routes/auth.js';
import caddieRoutes from './routes/caddie.js';
import turnRoutes from './routes/turn.js';
import attendanceRoutes from './routes/attendance.js';
import listsRoutes from './routes/lists.js';
import reportsRoutes from './routes/reports.js';
import messagesRoutes from './routes/messages.js';
import dispatchRoutes from './routes/dispatch.js';
import scheduleRoutes from './routes/schedule.js';
import publicRoutes from './routes/public.js';

// Import WebSocket initialization
import { initializeWebSocket, getWebSocketStats } from './config/websocket.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for Express + WebSocket
const httpServer = createServer(app);

// Initialize WebSocket server
initializeWebSocket(httpServer);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    // Get allowed origins from environment variable
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : [];

    // In development, allow localhost
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Allow if in development or origin is in allowed list
    if (isDevelopment || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
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

// WebSocket status endpoint (for debugging)
app.get('/ws-status', (req, res) => {
  const stats = getWebSocketStats();
  res.json({
    success: true,
    data: stats,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/caddies', caddieRoutes);
app.use('/api/turns', turnRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/public', publicRoutes);

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
  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API URL: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
  });
}

export default app;
