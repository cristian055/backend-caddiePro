# WebSocket Real-Time Synchronization Requirements

## Executive Summary

Implement WebSocket-based real-time synchronization to allow 100+ caddie users to see admin actions (like marking a caddie "En campo") instantly without page refresh or polling.

**Priority:** High


---

## Problem Statement

### Current Architecture Issues

1. **Performance Impact:** 100+ clients polling every 5 seconds = 20+ requests/second
2. **Latency:** 5-second maximum delay for updates to appear
3. **Server Load:** Unnecessary bandwidth and CPU usage
4. **Poor UX:** Users must wait for the next poll cycle
5. **Scalability Limit:** Polling doesn't scale beyond 100-200 concurrent users

---

## Solution Requirements

### Core Requirements

1. **Real-Time Updates:** When admin changes caddie status, all connected clients must receive the update within 100ms
2. **WebSocket Connection:** Clients maintain persistent WebSocket connections using Socket.IO
3. **Room-Based Broadcasting:** Updates are broadcast only to clients subscribed to the affected list (list-1, list-2, list-3)
4. **Authentication:** All WebSocket connections must be authenticated using the same JWT token as the REST API
5. **Access Control:** Users only receive updates for lists they have access to
6. **Connection Status:** Frontend displays real-time connection status to users

---

## WebSocket Message Protocol

### Server → Client Events

The backend must emit these events when changes occur:

| Event Name | Payload Fields | When to Emit |
|------------|----------------|--------------|
| `caddie:status_changed` | `caddieId`, `name`, `status`, `listNumber`, `timestamp` | Caddie status changes (Disponible → En campo → Disponible) |
| `caddie:added` | `caddieId`, `name`, `listNumber`, `status`, `phoneNumber`, `createdAt`, `updatedAt` | New caddie is added to any list |
| `caddie:updated` | `caddieId`, updates object, `timestamp` | Caddie information is modified (name, listNumber, etc.) |
| `caddie:deleted` | `caddieId`, `timestamp` | Caddie is removed from the system |

### Message Format Example

When a caddie's status changes to "En campo", the backend must emit:

```json
{
  "event": "caddie:status_changed",
  "data": {
    "caddieId": "uuid-123",
    "name": "Alejandro",
    "status": "En campo",
    "listNumber": 1,
    "timestamp": "2025-01-05T10:30:45.123Z"
  }
}
```

### Backend Integration Points

The backend must emit WebSocket events at these API endpoints:

1. **PATCH /api/caddies/:id/status** - Emit `caddie:status_changed`
2. **POST /api/caddies** - Emit `caddie:added`
3. **PUT /api/caddies/:id** - Emit `caddie:updated`
4. **DELETE /api/caddies/:id** - Emit `caddie:deleted`

---

## Frontend Requirements

### WebSocket Client

The frontend requires:

1. **WebSocket Service** to manage Socket.IO connection lifecycle
2. **Authentication** using the JWT token stored in `caddiePro_token`
3. **Auto-reconnection** with retry attempts if connection drops
4. **Event listeners** for all caddie-related events
5. **Connection status indicator** showing connected/disconnected state

### State Management

The frontend must:

1. Update caddie status locally when receiving `caddie:status_changed` event
2. Maintain existing REST API calls for initial data load
3. Remove the 5-second polling interval from `CaddieTurns` component
4. Display connection status to users

### Update Behavior

When a caddie status changes:

1. Frontend receives `caddie:status_changed` event via WebSocket
2. Frontend updates the caddie's status in local state immediately
3. UI reflects the change without API call or page refresh
4. The caddie name appears in the "En campo" section for their list

---

## Security Requirements

### Authentication

- All WebSocket connections must authenticate with JWT token
- Token passed in `auth` object during connection handshake
- Use the same JWT validation logic as REST API endpoints
- Reject connections without valid token

### Access Control

- Each connection joins rooms based on user's list access: `list-1`, `list-2`, `list-3`
- Events are only emitted to rooms containing affected list
- Users without list access do not receive updates for that list

### CORS

- Allow connections from frontend domain only
- Restrict origins to prevent unauthorized access

---

## Performance Requirements

### Connection Limits

- Must support 100+ concurrent WebSocket connections
- Target: 1000+ concurrent connections for future growth

### Latency

- Maximum 100ms latency from admin action to client update
- Target: < 50ms for optimal user experience

### Bandwidth

- Idle connections: minimal heartbeat traffic only
- Active updates: only send data when changes occur

---

## Deployment Requirements

### Environment Variables

Frontend needs:

- `VITE_WS_URL` - WebSocket server URL (wss:// for production)

### WebSocket Support

The deployment platform must support:
- Persistent WebSocket connections
- WebSocket upgrade headers
- Long-running connections (serverless platforms may not support this)

---

## Testing Requirements

### Functional Testing

1. Admin connects successfully
2. Caddie clients connect successfully
3. Admin marks caddie "En campo" - update appears instantly for all caddies in that list
4. Connection status indicator shows correct state
5. Disconnection/reconnection works automatically
6. Multiple concurrent caddie clients receive updates simultaneously
7. Updates only go to correct list (not cross-list pollution)

### Load Testing

- Test with 100+ concurrent WebSocket connections
- Verify no connection drops under load
- Confirm latency remains under 100ms

### Security Testing

- Verify unauthenticated connections are rejected
- Confirm users only receive updates for their assigned lists
- Test CORS restrictions

---

## Frontend Integration Points

### Components to Modify

1. **CaddieTurns.tsx**
   - Remove 5-second polling interval
   - Add WebSocket connection management
   - Add connection status indicator
   - Subscribe to real-time caddie updates

2. **AppContext.tsx**
   - Add `updateCaddieStatusLocal()` function for instant state updates
   - No API call when updating from WebSocket events

### New Files Required

1. `src/services/websocket.ts` - WebSocket connection service
2. `src/hooks/useCaddieUpdates.ts` - React hook for real-time updates

---

## Success Criteria

The implementation is successful when:

1. Admin changes caddie status to "En campo"
2. All 100+ caddie clients see the change within 100ms
3. Caddie name appears in the "En campo" section for their list
4. No page refresh required
5. Connection status shows "Conectado en tiempo real"
6. Server CPU usage is reduced compared to polling
7. Bandwidth usage is reduced by 90%+ compared to polling

---

## Performance Benchmarks (Expected)

### Before (Polling - Current)

| Metric | Current Value |
|--------|---------------|
| Requests/second (100 clients) | 20 req/s |
| Bandwidth (100 clients) | ~500 KB/min |
| Latency | 0-5 seconds |
| Server CPU usage | High |

### After (WebSocket - Target)

| Metric | Target Value |
|--------|--------------|
| Persistent connections | 100 connections |
| Bandwidth (idle) | ~10 KB/min (heartbeat) |
| Bandwidth (active) | ~100 KB/min (updates only) |
| Latency | < 100ms |
| Server CPU usage | Low |

---

## Rollback Requirements

If WebSocket implementation fails:

1. Frontend must fall back to existing 5-second polling
2. Backend must continue to support REST API without WebSocket
3. No database changes required for rollback
4. Users must still be able to use the application (with polling)

---

## Questions for Backend Team

1. What backend technology stack is currently used?
2. How is authentication currently implemented (JWT, session, etc.)?
3. Where is the backend deployed (does it support WebSockets)?
4. What database is being used?
5. Are there existing caddie management API routes to integrate with?

---

## Backend Implementation (Completed)

### Archivos Creados

1. **src/config/websocket.js** - Configuración del servidor Socket.IO con autenticación JWT
2. **src/utils/websocketEmitter.js** - Utilidades para emitir eventos desde los controladores

### Archivos Modificados

1. **src/server.js** - Inicialización del servidor WebSocket
2. **src/controllers/caddieController.js** - Emisión de eventos al crear, actualizar y eliminar caddies
3. **src/controllers/turnController.js** - Emisión de eventos al iniciar y finalizar turnos
4. **src/routes/caddie.js** - Nuevo endpoint PATCH /:id/status

### Eventos Emitidos

| Evento | Descripción | Endpoint que lo dispara |
|--------|-------------|------------------------|
| `caddie:status_changed` | Cuando el estado de un caddie cambia | PATCH /caddies/:id/status, POST /turns, PUT /turns/:id |
| `caddie:added` | Cuando se crea un nuevo caddie | POST /caddies |
| `caddie:updated` | Cuando se actualiza información de un caddie | PUT /caddies/:id |
| `caddie:deleted` | Cuando se elimina un caddie | DELETE /caddies/:id |

### Formato de los Eventos

Todos los eventos incluyen un objeto con la siguiente estructura:

```json
{
  "event": "caddie:status_changed",
  "data": { ...payload específico del evento },
  "timestamp": "2026-01-05T15:00:00.000Z"
}
```

### Conexión desde el Frontend

El cliente debe conectarse pasando el token JWT en el objeto `auth`:

```javascript
import { io } from 'socket.io-client';

const socket = io('URL_DEL_BACKEND', {
  auth: {
    token: localStorage.getItem('caddiePro_token')
  }
});
```

### Salas (Rooms)

- Los caddies se unen automáticamente a la sala correspondiente a su lista: `list-1`, `list-2`, `list-3`
- Los administradores se unen a las tres salas
- Los eventos se emiten solo a la sala afectada

