import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'caddiepro-secret-key-change-in-production';

// Store io instance for use in controllers
let io = null;

/**
 * Initialize WebSocket server with Socket.IO
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
export function initializeWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        console.log('[WS] Connection rejected: No token provided');
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user info from database
      let userInfo = { adminId: null, listNumbers: null };

      if (decoded.adminId) {
        // Admin user
        userInfo = { adminId: decoded.adminId, listNumbers: [1, 2, 3], isAdmin: true };
      } else if (decoded.caddieId) {
        // Caddie user - get their list number
        const caddie = await prisma.caddie.findUnique({
          where: { id: decoded.caddieId },
          select: { id: true, name: true, listNumber: true },
        });

        if (!caddie) {
          console.log('[WS] Connection rejected: Caddie not found');
          return next(new Error('User not found'));
        }

        userInfo = {
          caddieId: caddie.id,
          caddieName: caddie.name,
          listNumbers: [caddie.listNumber],
          isAdmin: false,
        };
      }

      // Attach user info to socket
      socket.user = userInfo;
      console.log(`[WS] User authenticated: ${userInfo.caddieId || userInfo.adminId}`);

      next();
    } catch (error) {
      console.log('[WS] Connection rejected: Invalid token', error.message);
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const { adminId, caddieId, listNumbers, isAdmin } = socket.user;

    console.log(`[WS] Client connected: ${caddieId || adminId}`);

    // Join list rooms based on user access
    if (listNumbers && listNumbers.length > 0) {
      listNumbers.forEach((listNumber) => {
        const room = `list-${listNumber}`;
        socket.join(room);
        console.log(`[WS] ${caddieId || adminId} joined room: ${room}`);
      });
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[WS] Client disconnected: ${caddieId || adminId} (${reason})`);
    });

    // Handle ping for connection status
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  console.log('[WS] WebSocket server initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 * @returns {Server|null} Socket.IO server instance or null if not initialized
 */
export function getIO() {
  return io;
}

/**
 * Emit event to a specific list room
 * @param {number} listNumber - List number (1, 2, or 3)
 * @param {string} event - Event name
 * @param {object} data - Event payload
 */
export function emitToList(listNumber, event, data) {
  if (!io) {
    console.warn('[WS] WebSocket not initialized');
    return;
  }

  const room = `list-${listNumber}`;
  io.to(room).emit(event, {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
  console.log(`[WS] Emitted ${event} to ${room}:`, data.caddieId || data.id || 'N/A');
}

/**
 * Emit event to all connected clients
 * @param {string} event - Event name
 * @param {object} data - Event payload
 */
export function emitToAll(event, data) {
  if (!io) {
    console.warn('[WS] WebSocket not initialized');
    return;
  }

  io.emit(event, {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
  console.log(`[WS] Emitted ${event} to all clients`);
}

/**
 * Emit event to all admin users
 * @param {string} event - Event name
 * @param {object} data - Event payload
 */
export function emitToAdmins(event, data) {
  if (!io) {
    console.warn('[WS] WebSocket not initialized');
    return;
  }

  // Admins are in all list rooms, so we can use broadcasting
  // Or we could create a dedicated admin room
  io.emit(event, {
    event,
    data,
    timestamp: new Date().toISOString(),
  });
}

export default {
  initializeWebSocket,
  getIO,
  emitToList,
  emitToAll,
  emitToAdmins,
};
