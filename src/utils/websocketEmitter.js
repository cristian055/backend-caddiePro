import { emitToList, emitToAll, getIO } from '../config/websocket.js';

/**
 * WebSocket Event Emitter Utility
 * Provides convenient functions for emitting real-time events from controllers
 */

/**
 * Emit caddie status changed event
 * @param {object} caddie - Caddie object with id, name, status, category
 */
export function emitCaddieStatusChanged(caddie) {
  const category = caddie.category || 'Primera';
  emitToAll('caddie:status:changed', {
    caddieId: caddie.id,
    name: caddie.name,
    previousStatus: caddie.previousStatus,
    newStatus: caddie.status,
    category,
    timestamp: Date.now(),
  });
}

/**
 * Emit caddie added event
 * @param {object} caddie - Newly created caddie object
 */
export function emitCaddieAdded(caddie) {
  emitToAll('caddie:added', {
    caddieId: caddie.id,
    name: caddie.name,
    number: caddie.number,
    category: caddie.category,
    status: caddie.status,
    location: caddie.location,
    role: caddie.role,
    timestamp: Date.now(),
  });
}

/**
 * Emit caddie updated event
 * @param {string} caddieId - Caddie ID
 * @param {object} updates - Updated fields
 * @param {string} category - Caddie's category
 */
export function emitCaddieUpdated(caddieId, updates, category) {
  emitToAll('caddie:updated', {
    caddieId,
    updates,
    category,
    timestamp: Date.now(),
  });
}

/**
 * Emit caddie deleted event
 * @param {string} caddieId - Deleted caddie ID
 * @param {string} category - Caddie's category
 */
export function emitCaddieDeleted(caddieId, category) {
  emitToAll('caddie:deleted', {
    caddieId,
    category,
    timestamp: Date.now(),
  });
}

/**
 * Emit caddie dispatched event (for batch dispatch)
 * @param {string[]} ids - Array of dispatched caddie IDs
 * @param {object[]} caddies - Array of caddie objects
 * @param {number} timestamp - Timestamp of dispatch
 */
export function emitCaddieDispatched(ids, caddies, timestamp) {
  emitToAll('caddie:dispatched', {
    ids,
    caddies,
    timestamp,
  });
}

/**
 * Emit queue updated event
 * @param {string} category - Category that was updated
 */
export function emitQueueUpdated(category) {
  emitToAll('queue:updated', {
    category,
    timestamp: Date.now(),
  });
}

/**
 * Emit schedule updated event
 * @param {string} day - Day that was updated
 */
export function emitScheduleUpdated(day) {
  emitToAll('schedule:updated', {
    day,
    timestamp: Date.now(),
  });
}

/**
 * Emit list updated event
 * @param {string} listId - List ID
 * @param {object} list - Updated list object
 */
export function emitListUpdated(listId, list) {
  emitToAll('list:updated', {
    listId,
    list,
    timestamp: Date.now(),
  });
}

/**
 * Broadcast message to all clients (for announcements)
 * @param {object} message - Message object
 */
export function emitMessageBroadcast(message) {
  emitToAll('message:broadcast', {
    id: message.id,
    content: message.content,
    targetList: message.targetList,
    createdAt: message.createdAt,
  });
}

/**
 * Check if WebSocket is connected
 * @returns {boolean} True if WebSocket is initialized
 */
export function isWebSocketConnected() {
  return getIO() !== null;
}

export default {
  emitCaddieStatusChanged,
  emitCaddieAdded,
  emitCaddieUpdated,
  emitCaddieDeleted,
  emitMessageBroadcast,
  isWebSocketConnected,
};
