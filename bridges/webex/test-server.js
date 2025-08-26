#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing WebEx MCP Server...\n');

// Start the server
const serverPath = path.join(__dirname, 'dist', 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Send a test MCP request
setTimeout(() => {
  const testRequest = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  }) + '\n';
  
  console.log('\nSending test request:', testRequest);
  server.stdin.write(testRequest);
}, 1000);

// Wait for response
setTimeout(() => {
  console.log('\nTest complete. Server is running correctly if you see tool list above.');
  server.kill();
  process.exit(0);
}, 3000);