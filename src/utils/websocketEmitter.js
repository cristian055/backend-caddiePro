import { emitToList, emitToAll, getIO } from '../config/websocket.js';

/**
 * WebSocket Event Emitter Utility
 * Provides convenient functions for emitting real-time events from controllers
 */

/**
 * Emit caddie status changed event
 * @param {object} caddie - Caddie object with id, name, status, category, number
 * @param {string} previousStatus - The previous status before the change
 */
export function emitCaddieStatusChanged(caddie, previousStatus = null) {
  const category = caddie.category || 'Primera';
  const categoryToListNumber = { 'Primera': 1, 'Segunda': 2, 'Tercera': 3 };
  const listNumber = categoryToListNumber[category] || 1;
  
  const eventData = {
    caddieId: caddie.id,
    name: caddie.name,
    number: caddie.number,
    previousStatus: previousStatus || caddie.previousStatus,
    newStatus: caddie.status,
    status: caddie.status,
    category,
    listNumber,
    timestamp: Date.now(),
  };
  
  // Emit to all clients for real-time updates
  emitToAll('caddie:status_changed', eventData);
  
  // Also emit to specific list room
  emitToList(listNumber, 'caddie:status_changed', eventData);
  
  console.log(`[WS Emitter] Status changed for caddie ${caddie.name} (${caddie.number}): ${previousStatus} -> ${caddie.status}`);
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
 * Emit queue position updated event (for operational status changes)
 * @param {string} caddieId - Caddie ID that was updated
 * @param {object} updates - Updated fields (operationalStatus, lastDispatchedAt)
 * @param {string} category - Caddie's category
 */
export function emitQueuePositionUpdated(caddieId, updates, category) {
  emitToAll('queue:position_updated', {
    caddieId,
    updates,
    category,
    timestamp: Date.now(),
  });
}

/**
 * Emit caddie promoted event (for category promotion)
 * @param {string} caddieId - Caddie ID that was promoted
 * @param {string} oldCategory - Previous category
 * @param {string} newCategory - New category
 * @param {number} oldPosition - Previous position
 * @param {number} newPosition - New position
 */
export function emitCaddiePromoted(caddieId, oldCategory, newCategory, oldPosition, newPosition) {
  emitToAll('caddie:promoted', {
    caddieId,
    oldCategory,
    newCategory,
    oldPosition,
    newPosition,
    timestamp: Date.now(),
  });
}

/**
 * Emit queue recalculated event (for queue position recalculation)
 * @param {string} category - Category that was recalculated
 */
export function emitQueueRecalculated(category) {
  emitToAll('queue:recalculated', {
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
 * Emit daily attendance updated event
 * @param {object} attendance - Attendance object
 */
export function emitDailyAttendanceUpdated(attendance) {
  emitToAll('daily_attendance:updated', {
    id: attendance.id,
    caddieId: attendance.caddieId,
    caddie: attendance.caddie,
    date: attendance.date,
    status: attendance.status,
    arrivalTime: attendance.arrivalTime,
    servicesCount: attendance.servicesCount,
    timestamp: Date.now(),
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
  emitCaddieDispatched,
  emitQueueUpdated,
  emitQueuePositionUpdated,
  emitCaddiePromoted,
  emitQueueRecalculated,
  emitListUpdated,
  emitMessageBroadcast,
  emitDailyAttendanceUpdated,
  isWebSocketConnected,
};
