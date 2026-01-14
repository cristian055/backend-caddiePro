/**
 * Common validation utilities for backend controllers
 */

// Valid value sets - Updated for new schema with enums
export const VALID_OPERATIONAL_STATUSES = ['AVAILABLE', 'IN_PREP', 'IN_FIELD'];
export const VALID_ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'ON_LEAVE'];
export const VALID_CATEGORIES = ['PRIMERA', 'SEGUNDA', 'TERCERA'];
export const VALID_LOCATIONS = ['Llanogrande', 'Medellín'];
export const VALID_ROLES = ['GOLF', 'TENNIS', 'HYBRID'];
export const VALID_ORDER_TYPES = ['ASC', 'DESC', 'RANDOM', 'MANUAL'];
export const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

// Legacy: Kept for backward compatibility, will be deprecated
export const VALID_STATUSES = ['AVAILABLE', 'IN_PREP', 'IN_FIELD', 'LATE', 'ABSENT', 'ON_LEAVE'];

/**
 * Validate value against allowed set
 */
export function validateValue(value, allowedSet, fieldName) {
  if (!allowedSet.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${allowedSet.join(', ')}`);
  }
}

/**
 * Validate number range
 */
export function validateNumberRange(value, min, max, fieldName) {
  const num = parseInt(value);
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}`);
  }
  return num;
}

/**
 * Validate string length
 */
export function validateStringLength(value, min, max, fieldName) {
  if (!value || value.length < min || value.length > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max} characters`);
  }
}

/**
 * Validate time format (HH:mm)
 */
export function validateTimeFormat(time, fieldName = 'Time') {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`${fieldName} must be in HH:mm format`);
  }
}

/**
 * Validate range (start < end)
 */
export function validateRange(start, end, startName = 'rangeStart', endName = 'rangeEnd') {
  if (start >= end) {
    throw new Error(`${startName} must be less than ${endName}`);
  }
}
