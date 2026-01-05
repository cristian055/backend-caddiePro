import { emitToList, emitToAll, getIO } from '../config/websocket.js';

/**
 * WebSocket Event Emitter Utility
 * Provides convenient functions for emitting real-time events from controllers
 */

/**
 * Emit caddie status changed event
 * @param {object} caddie - Caddie object with id, name, status, listNumber
 */
export function emitCaddieStatusChanged(caddie) {
  emitToList(caddie.listNumber, 'caddie:status_changed', {
    caddieId: caddie.id,
    name: caddie.name,
    status: caddie.status,
    listNumber: caddie.listNumber,
  });
}

/**
 * Emit caddie added event
 * @param {object} caddie - Newly created caddie object
 */
export function emitCaddieAdded(caddie) {
  emitToList(caddie.listNumber, 'caddie:added', {
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
 * Emit caddie updated event
 * @param {string} caddieId - Caddie ID
 * @param {object} updates - Updated fields
 * @param {number} listNumber - Caddie's list number
 */
export function emitCaddieUpdated(caddieId, updates, listNumber) {
  emitToList(listNumber, 'caddie:updated', {
    caddieId,
    updates,
  });
}

/**
 * Emit caddie deleted event
 * @param {string} caddieId - Deleted caddie ID
 * @param {number} listNumber - Caddie's list number
 */
export function emitCaddieDeleted(caddieId, listNumber) {
  emitToList(listNumber, 'caddie:deleted', {
    caddieId,
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
