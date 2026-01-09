#!/usr/bin/env node
/**
 * WebSocket Test Script
 * Tests the WebSocket connection and event emission for caddie status changes
 * 
 * Usage: 
 *   1. Start the server: npm run dev
 *   2. In another terminal: node scripts/test-websocket.js
 */

import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

console.log(`\n🔌 Connecting to WebSocket at ${SERVER_URL}...\n`);

// Create socket connection as a public user (no auth)
const socket = io(SERVER_URL, {
  query: {
    lists: '1,2,3' // Subscribe to all lists
  },
  transports: ['websocket', 'polling'],
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log(`   Socket ID: ${socket.id}`);
  console.log('\n📡 Listening for events...\n');
  console.log('-------------------------------------------');
  console.log('Waiting for caddie status changes...');
  console.log('(Make a status change in the admin panel)');
  console.log('-------------------------------------------\n');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log(`⚠️  Disconnected: ${reason}`);
});

// Subscribe to specific rooms after connection
socket.on('connect', () => {
  socket.emit('subscribe', { listNumbers: [1, 2, 3] });
  console.log('📬 Subscribed to rooms: list-1, list-2, list-3\n');
});

// Listen for ALL caddie-related events
const events = [
  'caddie:status_changed',
  'caddie:added',
  'caddie:updated',
  'caddie:deleted',
  'caddie:dispatched',
  'queue:updated',
  'list:updated',
  'message:broadcast',
  'schedule:updated',
];

events.forEach(eventName => {
  socket.on(eventName, (payload) => {
    console.log(`\n📨 Event: ${eventName}`);
    console.log('   Timestamp:', new Date().toISOString());
    console.log('   Payload:', JSON.stringify(payload, null, 2));
    console.log('-------------------------------------------');
  });
});

// Handle ping/pong for connection health
socket.on('pong', (data) => {
  console.log('🏓 Pong received:', data);
});

// Periodic ping to keep connection alive
setInterval(() => {
  if (socket.connected) {
    socket.emit('ping');
  }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Closing WebSocket connection...');
  socket.disconnect();
  process.exit(0);
});

console.log('Press Ctrl+C to exit\n');
