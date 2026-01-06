# SSE para Eventos de Listas de Caddies - Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar Server-Sent Events (SSE) como alternativa a WebSocket para notificar en tiempo real las acciones sobre las listas de caddies.

**Architecture:**
- Un endpoint SSE (`GET /api/events/caddies`) **completamente público** (sin autenticación) - cualquier usuario puede conectarse y ver actualizaciones en vivo de las listas de caddies
- Un SSEManager centralizado que gestiona las conexiones y permite emitir eventos desde cualquier controlador
- Coexistencia con WebSocket existente (migración progresiva)
- **Modelo de autenticación separado**:
  - **SSE endpoint** (`GET /api/events/caddies`): Público, sin token - usuarios pueden ver las listas en tiempo real sin autenticarse
  - **Admin endpoints** (`POST/PUT/PATCH/DELETE /api/caddies`): Requieren JWT token - solo administradores pueden crear/actualizar/eliminar caddies

**Tech Stack:** Express.js, Node.js native `res.write()`, EventEmitter pattern

---

## Diagrama de Arquitectura

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Arquitectura SSE vs Auth                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   [Usuario Cualquiera]           [Servidor]                             │
│       │                            │                                     │
│       │  GET /api/events/caddies   │  ← PÚBLICO (sin token)               │
│       │  ?listNumber=1             │     Ver listas en tiempo real        │
│       │──────────────────────────► │                                     │
│       │                            │                                     │
│       │  Content-Type: text/event-stream                                 │
│       │◄───────────────────────────│                                     │
│       │                            │                                     │
│       │  event: caddie:added       │  ← Recibe actualizaciones            │
│       │  data: {...}               │     cuando admin crea caddie        │
│       │◄───────────────────────────│                                     │
│       │                            │                                     │
│                                                                          │
│   [Administrador]                [Servidor]                                 │
│       │                            │                                     │
│       │  POST /api/caddies         │  ← REQUIERE JWT TOKEN                │
│       │  Authorization: Bearer... │     Crear/actualizar/eliminar         │
│       │  { "name": "Juan", ... }   │                                     │
│       │──────────────────────────► │                                     │
│       │                            │                                     │
│       │  201 Created               │                                     │
│       │◄───────────────────────────│                                     │
│       │                            │                                     │
│       │                            │ → Emite evento SSE automáticamente   │
│       │                            │   a TODOS los usuarios conectados    │
│       │                            │   (sin importar si tienen token)     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Flujo de datos:**
1. **Usuario público** se conecta a `/api/events/caddies` sin token → recibe actualizaciones en vivo
2. **Administrador** usa JWT para POST/PUT/PATCH/DELETE en `/api/caddies` → modifica datos
3. Cada acción de admin emite evento SSE → **todos** los usuarios conectados reciben la actualización
4. No se requiere token para ver las actualizaciones (solo para realizarlas)

## Estructura de Archivos

```
src/
├── config/
│   ├── websocket.js           # Existente (mantener)
│   └── sse.js                 # NUEVO - SSE Manager
├── controllers/
│   └── caddieController.js    # MODIFICAR - agregar emits SSE
├── routes/
│   ├── caddie.js              # Existente
│   └── events.js              # NUEVO - endpoint SSE
├── utils/
│   ├── websocketEmitter.js    # Existente
│   └── sseEmitter.js          # NUEVO - funciones de emisión SSE
└── server.js                  # MODIFICAR - agregar ruta SSE
```

---

## Task 1: Crear SSE Manager (`src/config/sse.js`)

**Files:**
- Create: `src/config/sse.js`
- Test: `tests/sse.test.js`

**Step 1: Write the failing test**

```javascript
// tests/sse.test.js
import { jest } from '@jest/globals';
import { SSEManager } from '../src/config/sse.js';

describe('SSEManager', () => {
  let sseManager;

  beforeEach(() => {
    sseManager = new SSEManager();
  });

  afterEach(() => {
    sseManager.cleanup();
  });

  describe('addClient', () => {
    test('should add a client and return clientId (public access)', () => {
      const mockRes = {
        write: jest.fn(),
        on: jest.fn(),
      };

      // No userId needed - public endpoint
      const clientId = sseManager.addClient(mockRes, { listNumber: 1 });

      expect(clientId).toBeDefined();
      expect(typeof clientId).toBe('string');
      expect(sseManager.getClientCount()).toBe(1);
    });

    test('should filter clients by listNumber', () => {
      const mockRes1 = { write: jest.fn(), on: jest.fn() };
      const mockRes2 = { write: jest.fn(), on: jest.fn() };

      sseManager.addClient(mockRes1, { listNumber: 1 });
      sseManager.addClient(mockRes2, { listNumber: 2 });

      expect(sseManager.getClientsByList(1).length).toBe(1);
      expect(sseManager.getClientsByList(2).length).toBe(1);
    });
  });

  describe('removeClient', () => {
    test('should remove a client by clientId', () => {
      const mockRes = { write: jest.fn(), on: jest.fn() };
      const clientId = sseManager.addClient(mockRes, { listNumber: 1 });

      sseManager.removeClient(clientId);

      expect(sseManager.getClientCount()).toBe(0);
    });
  });

  describe('broadcast', () => {
    test('should send event to all clients', () => {
      const mockRes1 = { write: jest.fn(), on: jest.fn() };
      const mockRes2 = { write: jest.fn(), on: jest.fn() };

      sseManager.addClient(mockRes1, { listNumber: 1 });
      sseManager.addClient(mockRes2, { listNumber: 2 });

      sseManager.broadcast('test:event', { message: 'hello' });

      expect(mockRes1.write).toHaveBeenCalled();
      expect(mockRes2.write).toHaveBeenCalled();
    });

    test('should send event only to specific list', () => {
      const mockRes1 = { write: jest.fn(), on: jest.fn() };
      const mockRes2 = { write: jest.fn(), on: jest.fn() };

      sseManager.addClient(mockRes1, { listNumber: 1 });
      sseManager.addClient(mockRes2, { listNumber: 2 });

      sseManager.broadcastToList(1, 'test:event', { message: 'hello' });

      expect(mockRes1.write).toHaveBeenCalled();
      expect(mockRes2.write).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/sse.test.js`
Expected: FAIL with "Cannot find module '../src/config/sse.js'"

**Step 3: Write minimal implementation**

```javascript
// src/config/sse.js
import { randomUUID } from 'crypto';

/**
 * SSE (Server-Sent Events) Manager
 * Manages client connections and broadcasts events for real-time updates
 */
export class SSEManager {
  constructor() {
    // Map of clientId -> { res, listNumber, userId, connectedAt }
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  }

  /**
   * Add a new SSE client connection
   * @param {Response} res - Express response object
   * @param {object} options - Connection options
   * @param {number} options.listNumber - List number to subscribe to (1, 2, 3, or null for all)
   * @param {string} options.userId - User ID (optional, INTERNAL ONLY - for server-side tracking, never exposed to client)
   * @returns {string} Client ID
   */
  addClient(res, options = {}) {
    const clientId = randomUUID();
    const { listNumber = null, userId = null } = options;

    this.clients.set(clientId, {
      res,
      listNumber,
      userId, // Internal tracking only - never sent in events
      connectedAt: new Date(),
    });

    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });

    console.log(`[SSE] Client connected: ${clientId} (list: ${listNumber || 'all'})`);

    // Start heartbeat if this is the first client
    if (this.clients.size === 1) {
      this.startHeartbeat();
    }

    return clientId;
  }

  /**
   * Remove a client connection
   * @param {string} clientId - Client ID to remove
   */
  removeClient(clientId) {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      console.log(`[SSE] Client disconnected: ${clientId}`);

      // Stop heartbeat if no clients
      if (this.clients.size === 0) {
        this.stopHeartbeat();
      }
    }
  }

  /**
   * Get total client count
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Get clients subscribed to a specific list
   * @param {number} listNumber - List number
   * @returns {Array} Array of client objects
   */
  getClientsByList(listNumber) {
    const clients = [];
    for (const [clientId, client] of this.clients) {
      if (client.listNumber === listNumber || client.listNumber === null) {
        clients.push({ clientId, ...client });
      }
    }
    return clients;
  }

  /**
   * Format SSE message
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @returns {string} Formatted SSE message
   */
  formatMessage(event, data) {
    const payload = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  /**
   * Send event to a specific client
   * @param {string} clientId - Client ID
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  sendToClient(clientId, event, data) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.res.write(this.formatMessage(event, data));
      } catch (error) {
        console.error(`[SSE] Error sending to client ${clientId}:`, error.message);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Broadcast event to all connected clients
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  broadcast(event, data) {
    const message = this.formatMessage(event, data);
    for (const [clientId, client] of this.clients) {
      try {
        client.res.write(message);
      } catch (error) {
        console.error(`[SSE] Error broadcasting to client ${clientId}:`, error.message);
        this.removeClient(clientId);
      }
    }
    console.log(`[SSE] Broadcasted ${event} to ${this.clients.size} clients`);
  }

  /**
   * Broadcast event to clients subscribed to a specific list
   * @param {number} listNumber - List number
   * @param {string} event - Event name
   * @param {object} data - Event data
   */
  broadcastToList(listNumber, event, data) {
    const message = this.formatMessage(event, data);
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      // Send to clients subscribed to this list OR subscribed to all lists (null)
      if (client.listNumber === listNumber || client.listNumber === null) {
        try {
          client.res.write(message);
          sentCount++;
        } catch (error) {
          console.error(`[SSE] Error sending to client ${clientId}:`, error.message);
          this.removeClient(clientId);
        }
      }
    }
    console.log(`[SSE] Sent ${event} to list-${listNumber} (${sentCount} clients)`);
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      this.broadcast('heartbeat', { type: 'ping' });
    }, this.HEARTBEAT_INTERVAL_MS);

    console.log('[SSE] Heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[SSE] Heartbeat stopped');
    }
  }

  /**
   * Cleanup all connections
   */
  cleanup() {
    this.stopHeartbeat();
    this.clients.clear();
    console.log('[SSE] All connections cleaned up');
  }
}

// Singleton instance
let sseManagerInstance = null;

/**
 * Get or create SSE Manager instance
 * @returns {SSEManager} SSE Manager instance
 */
export function getSSEManager() {
  if (!sseManagerInstance) {
    sseManagerInstance = new SSEManager();
  }
  return sseManagerInstance;
}

export default {
  SSEManager,
  getSSEManager,
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/sse.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/sse.js tests/sse.test.js
git commit -m "feat(sse): add SSEManager for real-time event broadcasting"
```

---

## Task 2: Crear SSE Emitter Utility (`src/utils/sseEmitter.js`)

**Files:**
- Create: `src/utils/sseEmitter.js`

**Step 1: Write implementation**

```javascript
// src/utils/sseEmitter.js
import { getSSEManager } from '../config/sse.js';

/**
 * SSE Event Emitter Utility
 * Provides convenient functions for emitting real-time events from controllers
 * Mirrors the websocketEmitter.js API for consistency
 */

/**
 * Emit caddie status changed event via SSE
 * @param {object} caddie - Caddie object with id, name, status, listNumber
 */
export function emitCaddieStatusChangedSSE(caddie) {
  const sseManager = getSSEManager();
  sseManager.broadcastToList(caddie.listNumber, 'caddie:status_changed', {
    caddieId: caddie.id,
    name: caddie.name,
    status: caddie.status,
    listNumber: caddie.listNumber,
  });
}

/**
 * Emit caddie added event via SSE
 * @param {object} caddie - Newly created caddie object
 */
export function emitCaddieAddedSSE(caddie) {
  const sseManager = getSSEManager();
  sseManager.broadcastToList(caddie.listNumber, 'caddie:added', {
    caddieId: caddie.id,
    name: caddie.name,
    listNumber: caddie.listNumber,
    status: caddie.status,
    phoneNumber: caddie.phoneNumber,
    createdAt: caddie.createdAt,
    updatedAt: caddie.updatedAt,
  });
}

/**
 * Emit caddie updated event via SSE
 * @param {string} caddieId - Caddie ID
 * @param {object} updates - Updated fields
 * @param {number} listNumber - Caddie's list number
 */
export function emitCaddieUpdatedSSE(caddieId, updates, listNumber) {
  const sseManager = getSSEManager();
  sseManager.broadcastToList(listNumber, 'caddie:updated', {
    caddieId,
    updates,
  });
}

/**
 * Emit caddie deleted event via SSE
 * @param {string} caddieId - Deleted caddie ID
 * @param {number} listNumber - Caddie's list number
 */
export function emitCaddieDeletedSSE(caddieId, listNumber) {
  const sseManager = getSSEManager();
  sseManager.broadcastToList(listNumber, 'caddie:deleted', {
    caddieId,
  });
}

/**
 * Broadcast message to all clients via SSE
 * @param {object} message - Message object
 */
export function emitMessageBroadcastSSE(message) {
  const sseManager = getSSEManager();
  sseManager.broadcast('message:broadcast', {
    id: message.id,
    content: message.content,
    targetList: message.targetList,
    createdAt: message.createdAt,
  });
}

/**
 * Check if SSE has connected clients
 * @returns {boolean} True if there are connected clients
 */
export function hasSSEClients() {
  return getSSEManager().getClientCount() > 0;
}

export default {
  emitCaddieStatusChangedSSE,
  emitCaddieAddedSSE,
  emitCaddieUpdatedSSE,
  emitCaddieDeletedSSE,
  emitMessageBroadcastSSE,
  hasSSEClients,
};
```

**Step 2: Commit**

```bash
git add src/utils/sseEmitter.js
git commit -m "feat(sse): add SSE emitter utility functions"
```

---

## Task 3: Crear Endpoint SSE (`src/routes/events.js`)

**Files:**
- Create: `src/routes/events.js`

**Step 1: Write implementation**

```javascript
// src/routes/events.js
import { Router } from 'express';
import { getSSEManager } from '../config/sse.js';

const router = Router();

/**
 * GET /api/events/caddies
 * Server-Sent Events endpoint for caddie list updates
 * 
 * PUBLIC ENDPOINT - No authentication required
 * Any user can view caddie lists and receive real-time updates
 *
 * Query params:
 * - listNumber: 1|2|3 (optional, filter events by list)
 * 
 * Events emitted:
 * - connected: Initial connection confirmation
 * - caddie:status_changed: When a caddie's status changes
 * - caddie:added: When a new caddie is created (by admin)
 * - caddie:updated: When a caddie is updated (by admin)
 * - caddie:deleted: When a caddie is deleted (by admin)
 * - heartbeat: Keep-alive ping every 30 seconds
 */
router.get('/caddies', (req, res) => {
  const { listNumber } = req.query;

  // Validate listNumber if provided
  const parsedListNumber = listNumber ? parseInt(listNumber) : null;
  if (listNumber && (isNaN(parsedListNumber) || ![1, 2, 3].includes(parsedListNumber))) {
    return res.status(400).json({ error: 'listNumber must be 1, 2, or 3' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Register client with SSE manager (public, no userId)
  const sseManager = getSSEManager();
  const clientId = sseManager.addClient(res, {
    listNumber: parsedListNumber,
    userId: null, // Public endpoint - no user tracking
  });

  // Send initial connection confirmation
  res.write(sseManager.formatMessage('connected', {
    clientId,
    listNumber: parsedListNumber,
    message: 'SSE connection established',
  }));

  // Log connection info (public endpoint - no userId)
  console.log(`[SSE] New public connection - clientId: ${clientId}, list: ${parsedListNumber || 'all'}`);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE] Connection closed - clientId: ${clientId}`);
  });
});

/**
 * GET /api/events/status
 * Get SSE server status (for monitoring/debugging)
 */
router.get('/status', (req, res) => {
  const sseManager = getSSEManager();
  res.json({
    connectedClients: sseManager.getClientCount(),
    clientsByList: {
      list1: sseManager.getClientsByList(1).length,
      list2: sseManager.getClientsByList(2).length,
      list3: sseManager.getClientsByList(3).length,
    },
  });
});

export default router;
```

**Step 2: Commit**

```bash
git add src/routes/events.js
git commit -m "feat(sse): add SSE endpoint for caddie events"
```

---

## Task 4: Integrar SSE en el Servidor (`src/server.js`)

**Files:**
- Modify: `src/server.js`

**Step 1: Add SSE route import and registration**

Agregar después de la línea 13 (import messagesRoutes):
```javascript
import eventsRoutes from './routes/events.js';
```

Agregar después de la línea 79 (app.use('/api/messages', messagesRoutes)):
```javascript
app.use('/api/events', eventsRoutes);
```

**Step 2: Commit**

```bash
git add src/server.js
git commit -m "feat(sse): register SSE events route in server"
```

---

## Task 5: Integrar SSE Emitter en CaddieController (`src/controllers/caddieController.js`)

**Files:**
- Modify: `src/controllers/caddieController.js`

**Step 1: Add SSE emitter imports**

Agregar después de la línea 2:
```javascript
import { 
  emitCaddieAddedSSE, 
  emitCaddieUpdatedSSE, 
  emitCaddieDeletedSSE, 
  emitCaddieStatusChangedSSE 
} from '../utils/sseEmitter.js';
```

**Step 2: Add SSE emit calls alongside WebSocket emits**

En la función `createCaddie` (después de línea 87):
```javascript
emitCaddieAddedSSE(caddie);
```

En la función `updateCaddie` (después de líneas 133-137):
```javascript
// Emit SSE events
if (listNumber && parseInt(listNumber) !== oldCaddie.listNumber) {
  emitCaddieUpdatedSSE(id, updates, oldCaddie.listNumber);
  emitCaddieUpdatedSSE(id, updates, parseInt(listNumber));
} else {
  emitCaddieUpdatedSSE(id, updates, oldCaddie.listNumber);
}
```

En la función `deleteCaddie` (después de línea 162):
```javascript
emitCaddieDeletedSSE(id, caddie.listNumber);
```

En la función `updateCaddieStatus` (después de línea 187):
```javascript
emitCaddieStatusChangedSSE(caddie);
```

**Step 3: Commit**

```bash
git add src/controllers/caddieController.js
git commit -m "feat(sse): emit SSE events from caddie controller"
```

---

## Task 6: Escribir Tests de Integración

**Files:**
- Create: `tests/events.test.js`

**Step 1: Write integration tests**

```javascript
// tests/events.test.js
import request from 'supertest';
import app from '../src/server.js';

describe('SSE Events API', () => {
  describe('GET /api/events/status', () => {
    test('should return SSE server status', async () => {
      const response = await request(app)
        .get('/api/events/status')
        .expect(200);

      expect(response.body).toHaveProperty('connectedClients');
      expect(response.body).toHaveProperty('clientsByList');
      expect(response.body.clientsByList).toHaveProperty('list1');
      expect(response.body.clientsByList).toHaveProperty('list2');
      expect(response.body.clientsByList).toHaveProperty('list3');
    });
  });

  describe('GET /api/events/caddies', () => {
    test('should reject invalid listNumber', async () => {
      const response = await request(app)
        .get('/api/events/caddies?listNumber=5')
        .expect(400);

      expect(response.body.error).toBe('listNumber must be 1, 2, or 3');
    });

    test('should accept valid listNumber', (done) => {
      const req = request(app)
        .get('/api/events/caddies?listNumber=1')
        .set('Accept', 'text/event-stream');

      req.on('response', (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        req.abort();
        done();
      });
    });

    test('should connect without listNumber (all lists)', (done) => {
      const req = request(app)
        .get('/api/events/caddies')
        .set('Accept', 'text/event-stream');

      req.on('response', (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        req.abort();
        done();
      });
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- tests/events.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/events.test.js
git commit -m "test(sse): add integration tests for SSE events endpoint"
```

---

## Task 7: Actualizar Documentación

**Files:**
- Modify: `AGENTS.md`

**Step 1: Add SSE documentation**

Agregar después de la sección "## WebSocket Events":

```markdown
## SSE Events (Server-Sent Events)

Alternative to WebSocket for one-way server-to-client communication.

### Endpoint
```
GET /api/events/caddies
```

**PUBLIC ENDPOINT** - No authentication required. Any user can connect and view real-time updates.

### Query Parameters
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| listNumber | 1\|2\|3 | No | Filter events by list (default: all lists) |

### Events
| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{clientId, listNumber, message}` | Connection established |
| `caddie:status_changed` | `{caddieId, name, status, listNumber, timestamp}` | Caddie status updated |
| `caddie:added` | `{caddieId, name, listNumber, status, ...}` | New caddie created (by admin) |
| `caddie:updated` | `{caddieId, updates, timestamp}` | Caddie data updated (by admin) |
| `caddie:deleted` | `{caddieId, timestamp}` | Caddie removed (by admin) |
| `heartbeat` | `{type: "ping", timestamp}` | Keep-alive (every 30s) |

### Client Example (JavaScript)
```javascript
// Connect to SSE endpoint (no token needed!)
const eventSource = new EventSource('/api/events/caddies?listNumber=1');

// Listen for new caddies
eventSource.addEventListener('caddie:added', (event) => {
  const data = JSON.parse(event.data);
  console.log('New caddie:', data);
  // Update UI with new caddie
});

// Listen for status changes
eventSource.addEventListener('caddie:status_changed', (event) => {
  const data = JSON.parse(event.data);
  console.log('Status changed:', data);
  // Update caddie status in UI
});

// Heartbeat - connection is alive
eventSource.addEventListener('heartbeat', (event) => {
  console.log('Connection alive');
});

// Handle errors (auto-reconnect by browser)
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};
```

### Status Endpoint
```
GET /api/events/status
```
Returns connected client count and distribution by list (for monitoring/debugging).

### Note
- SSE events are **public** - anyone can view caddie updates
- Admin actions (create/update/delete caddie) still require JWT token via `/api/caddies` endpoints
```

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add SSE events documentation"
```

---

## Resumen de Cambios

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/config/sse.js` | Crear | SSE Manager singleton (gestiona conexiones públicas) |
| `src/utils/sseEmitter.js` | Crear | Funciones helper para emitir eventos desde controladores |
| `src/routes/events.js` | Crear | Endpoint SSE público `/api/events/caddies` (sin auth) |
| `src/server.js` | Modificar | Registrar ruta de eventos |
| `src/controllers/caddieController.js` | Modificar | Agregar emits SSE en acciones de admin |
| `tests/sse.test.js` | Crear | Unit tests SSEManager |
| `tests/events.test.js` | Crear | Integration tests endpoint público |
| `AGENTS.md` | Modificar | Documentación SSE |

## Modelo de Autenticación

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTENTICACIÓN                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Endpoint Público (Sin Token):                             │
│  • GET /api/events/caddies   → Ver actualizaciones en vivo  │
│  • GET /api/events/status    → Status del servidor SSE     │
│                                                             │
│  Endpoint de Admin (Con Token JWT):                        │
│  • POST   /api/caddies      → Crear caddie                 │
│  • PUT    /api/caddies/:id  → Actualizar caddie            │
│  • PATCH  /api/caddies/:id/status → Cambiar estado        │
│  • DELETE /api/caddies/:id  → Eliminar caddie             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Notas de Migración

1. **Coexistencia**: WebSocket y SSE funcionarán en paralelo
2. **Frontend**: Puede migrar gradualmente de Socket.IO a EventSource nativo
3. **Endpoint Público**: `/api/events/caddies` es público - no requiere token para conectarse
4. **Admin Actions**: Las acciones administrativas (`POST/PUT/PATCH/DELETE /api/caddies`) siguen requiriendo JWT
5. **Deprecación futura**: Una vez validado SSE, se puede remover Socket.IO

## Comandos de Verificación

```bash
# Ejecutar todos los tests
npm test

# Verificar endpoint SSE con curl (no se requiere token!)
curl -N http://localhost:3000/api/events/caddies

# Verificar status del servidor SSE
curl http://localhost:3000/api/events/status

# Ver eventos de lista específica
curl -N http://localhost:3000/api/events/caddies?listNumber=1
```

# Verificar status
curl http://localhost:3000/api/events/status
```
