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

  // Authentication middleware - allows both authenticated and public connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      // Allow public connections without token
      if (!token) {
        console.log('[WS] Public connection established');
        socket.user = {
          isAdmin: false,
          isPublic: true,
          listNumbers: null,
        };
        return next();
      }

      // Verify JWT token if provided
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user info from database
      let userInfo = { adminId: null, listNumbers: null };

      if (decoded.adminId) {
        // Admin user
        userInfo = { adminId: decoded.adminId, listNumbers: [1, 2, 3], isAdmin: true, isPublic: false };
      } else if (decoded.caddieId) {
        // Caddie user - get their list number
        const caddie = await prisma.caddie.findUnique({
          where: { id: decoded.caddieId },
          select: { id: true, name: true, number: true },
        });

        if (!caddie) {
          console.log('[WS] Connection rejected: Caddie not found');
          return next(new Error('User not found'));
        }

        // Determine list number based on category
        const categoryToNumber = { 'Primera': 1, 'Segunda': 2, 'Tercera': 3 };
        const listNumber = categoryToNumber[caddie.category] || 1;

        userInfo = {
          caddieId: caddie.id,
          caddieName: caddie.name,
          caddieNumber: caddie.number,
          listNumbers: [listNumber],
          isAdmin: false,
          isPublic: false,
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
    const { adminId, caddieId, listNumbers, isAdmin, isPublic } = socket.user;

    console.log(`[WS] Client connected: ${isPublic ? 'PUBLIC' : (caddieId || adminId)}`);

    // Join list rooms based on user access
    if (listNumbers && listNumbers.length > 0) {
      listNumbers.forEach((listNumber) => {
        const room = `list-${listNumber}`;
        socket.join(room);
        console.log(`[WS] ${isPublic ? 'PUBLIC' : (caddieId || adminId)} joined room: ${room}`);
      });
    }

    // Allow public users to join specific list rooms
    if (isPublic) {
      // Check if public user specified lists to join via query params
      const requestedLists = socket.handshake.query.lists;
      if (requestedLists) {
        const listNums = requestedLists.split(',').map(n => parseInt(n.trim()));
        listNums.forEach((listNumber) => {
          if ([1, 2, 3].includes(listNumber)) {
            const room = `list-${listNumber}`;
            socket.join(room);
            console.log(`[WS] PUBLIC user joined room: ${room}`);
          }
        });
      }

      // Handle subscribe event for public users to join/leave rooms
      socket.on('subscribe', (data) => {
        if (data && data.listNumbers && Array.isArray(data.listNumbers)) {
          data.listNumbers.forEach((listNumber) => {
            if ([1, 2, 3].includes(listNumber)) {
              const room = `list-${listNumber}`;
              socket.join(room);
              console.log(`[WS] PUBLIC user subscribed to: ${room}`);
            }
          });
        }
      });

      // Handle unsubscribe event for public users to leave rooms
      socket.on('unsubscribe', (data) => {
        if (data && data.listNumbers && Array.isArray(data.listNumbers)) {
          data.listNumbers.forEach((listNumber) => {
            if ([1, 2, 3].includes(listNumber)) {
              const room = `list-${listNumber}`;
              socket.leave(room);
              console.log(`[WS] PUBLIC user unsubscribed from: ${room}`);
            }
          });
        }
      });
    }

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[WS] Client disconnected: ${isPublic ? 'PUBLIC' : (caddieId || adminId)} (${reason})`);
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
  const roomSockets = io.sockets.adapter.rooms.get(room);
  const roomSize = roomSockets ? roomSockets.size : 0;
  
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  
  io.to(room).emit(event, payload);
  console.log(`[WS] Emitted ${event} to room ${room} (${roomSize} client(s)):`, data.caddieId || data.id || 'N/A');
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

  const connectedSockets = io.sockets.sockets.size;
  const payload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  
  io.emit(event, payload);
  console.log(`[WS] Emitted ${event} to ${connectedSockets} connected client(s)`);
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

/**
 * Get WebSocket connection statistics
 * @returns {object} Statistics about connected clients and rooms
 */
export function getWebSocketStats() {
  if (!io) {
    return { initialized: false, connectedClients: 0, rooms: {} };
  }

  const rooms = {};
  for (let i = 1; i <= 3; i++) {
    const room = `list-${i}`;
    const roomSockets = io.sockets.adapter.rooms.get(room);
    rooms[room] = roomSockets ? roomSockets.size : 0;
  }

  return {
    initialized: true,
    connectedClients: io.sockets.sockets.size,
    rooms,
  };
}

export default {
  initializeWebSocket,
  getIO,
  emitToList,
  emitToAll,
  emitToAdmins,
  getWebSocketStats,
};
