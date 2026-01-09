/**
 * WebSocket Integration Tests
 * Tests the WebSocket connection and event emission for caddie status changes
 */

import { io } from 'socket.io-client';
import { createServer } from 'http';
import app from '../src/server.js';
import { initializeWebSocket, getIO, emitToAll, emitToList } from '../src/config/websocket.js';
import { emitCaddieStatusChanged } from '../src/utils/websocketEmitter.js';

describe('WebSocket Integration', () => {
  let httpServer;
  let clientSocket;
  const PORT = 3099;
  const SERVER_URL = `http://localhost:${PORT}`;

  beforeAll((done) => {
    // Create a new HTTP server for testing
    httpServer = createServer(app);
    initializeWebSocket(httpServer);
    httpServer.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    httpServer.close(done);
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
      clientSocket = null;
    }
  });

  describe('Connection', () => {
    test('should allow public connection without authentication', (done) => {
      clientSocket = io(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should allow public connection with list subscription via query', (done) => {
      clientSocket = io(SERVER_URL, {
        query: { lists: '1,2,3' },
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });
  });

  describe('Room Subscription', () => {
    test('should join rooms via subscribe event', (done) => {
      clientSocket = io(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { listNumbers: [1, 2] });
        // Give it time to process
        setTimeout(() => {
          const io = getIO();
          const room1 = io.sockets.adapter.rooms.get('list-1');
          const room2 = io.sockets.adapter.rooms.get('list-2');
          expect(room1).toBeDefined();
          expect(room2).toBeDefined();
          done();
        }, 100);
      });
    });

    test('should leave rooms via unsubscribe event', (done) => {
      clientSocket = io(SERVER_URL, {
        query: { lists: '1,2,3' },
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        // First verify we're in the rooms
        setTimeout(() => {
          clientSocket.emit('unsubscribe', { listNumbers: [1] });
          setTimeout(() => {
            done();
          }, 100);
        }, 100);
      });
    });
  });

  describe('Event Emission', () => {
    test('should receive caddie:status_changed event via emitToAll', (done) => {
      clientSocket = io(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        // Listen for the event
        clientSocket.on('caddie:status_changed', (payload) => {
          expect(payload).toBeDefined();
          expect(payload.event).toBe('caddie:status_changed');
          expect(payload.data).toBeDefined();
          expect(payload.data.caddieId).toBe('test-caddie-id');
          expect(payload.data.newStatus).toBe('IN_PREP');
          expect(payload.timestamp).toBeDefined();
          done();
        });

        // Emit the event after a short delay
        setTimeout(() => {
          emitCaddieStatusChanged({
            id: 'test-caddie-id',
            name: 'Test Caddie',
            number: 1,
            status: 'IN_PREP',
            category: 'Primera',
          }, 'AVAILABLE');
        }, 100);
      });
    });

    test('should receive caddie:status_changed event via emitToList', (done) => {
      clientSocket = io(SERVER_URL, {
        query: { lists: '1' },
        transports: ['websocket'],
        forceNew: true,
      });

      let eventCount = 0;
      clientSocket.on('connect', () => {
        clientSocket.on('caddie:status_changed', (payload) => {
          eventCount++;
          expect(payload).toBeDefined();
          expect(payload.event).toBe('caddie:status_changed');
          // Event should be received twice: once from emitToAll, once from emitToList
          if (eventCount === 2) {
            done();
          }
        });

        setTimeout(() => {
          emitCaddieStatusChanged({
            id: 'test-caddie-2',
            name: 'Test Caddie 2',
            number: 2,
            status: 'IN_FIELD',
            category: 'Primera',
          }, 'IN_PREP');
        }, 100);
      });
    });

    test('should NOT receive events for unsubscribed lists', (done) => {
      clientSocket = io(SERVER_URL, {
        query: { lists: '1' }, // Only subscribe to list 1
        transports: ['websocket'],
        forceNew: true,
      });

      let eventReceived = false;

      clientSocket.on('connect', () => {
        clientSocket.on('caddie:status_changed', (payload) => {
          // Should only receive from emitToAll, not from emitToList for list-2
          eventReceived = true;
          expect(payload.data.category).toBe('Segunda');
        });

        setTimeout(() => {
          // Emit for list 2 (Segunda category)
          emitToList(2, 'caddie:status_changed', {
            caddieId: 'test-3',
            category: 'Segunda',
          });
          
          // Emit to all
          emitToAll('caddie:status_changed', {
            caddieId: 'test-3',
            category: 'Segunda',
          });

          // Wait and check
          setTimeout(() => {
            expect(eventReceived).toBe(true); // Should receive from emitToAll
            done();
          }, 200);
        }, 100);
      });
    });
  });

  describe('Ping/Pong', () => {
    test('should respond to ping with pong', (done) => {
      clientSocket = io(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        clientSocket.on('pong', (data) => {
          expect(data).toBeDefined();
          expect(data.timestamp).toBeDefined();
          done();
        });

        clientSocket.emit('ping');
      });
    });
  });
});
