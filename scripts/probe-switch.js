import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { readConfig } from '../src/config.js';

const config = readConfig();
if (!config.baseUrl || !config.agentId || !config.agentKey) throw new Error('Switch agent config missing');
const url = new URL(config.baseUrl);
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
url.pathname = `/agents/${encodeURIComponent(config.agentId)}/connection/ws`;
url.search = new URLSearchParams({ connection_id: randomUUID(), scope: 'all', filter: 'all', start_from: 'head' }).toString();
const socket = new WebSocket(url.href, { headers: { Authorization: `Bearer ${config.agentKey}` } });
const timer = setTimeout(() => { console.error('No Switch connection state within 8 seconds'); socket.terminate(); }, 8000);
socket.on('message', raw => {
  const frame = JSON.parse(raw.toString());
  console.log(`Switch frame: ${frame.event || frame.type || 'unknown'}; fields: ${Object.keys(frame).join(',')}`);
  if (frame.event === 'connection_state' || frame.type === 'connection_state') {
    console.log(`WebSocket authenticated; filter=${frame.data?.filter}; rooms=${frame.data?.rooms?.length || 0}; state fields=${Object.keys(frame.data || {}).join(',')}`);
  }
  if (frame.event === 'ping' || frame.type === 'ping') {
    socket.send(JSON.stringify({ type: 'pong', cursor: 0 }));
    console.log('Sent application-level pong');
    clearTimeout(timer); socket.close();
  }
});
socket.on('error', error => { clearTimeout(timer); console.error(`Switch WebSocket error: ${error.message}`); process.exitCode = 1; });
socket.on('close', () => clearTimeout(timer));
