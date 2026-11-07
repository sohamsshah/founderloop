const base = 'http://127.0.0.1:18000/gateway';
const login = await fetch(`${base}/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.GATEWAY_ADMIN_EMAIL, password: process.env.GATEWAY_ADMIN_PASSWORD }),
});
const cookie = login.headers.get('set-cookie')?.split(';')[0];
if (!login.ok || !cookie) throw new Error(`Switch login failed: HTTP ${login.status}`);
const response = await fetch(`${base}/collaborations`, { headers: { cookie } });
if (!response.ok) throw new Error(`Switch connections failed: HTTP ${response.status}`);
const bridges = await response.json();
for (const item of bridges) {
  console.log(`${item.bridge_type || item.type}: ${item.status || item.state || 'unknown'}`);
}
const telegram = bridges.find(item => item.bridge_type === 'telegram');
if (telegram) {
  const roomsResponse = await fetch(`${base}/rooms`, { headers: { cookie } });
  if (!roomsResponse.ok) throw new Error(`Switch rooms failed: HTTP ${roomsResponse.status}`);
  for (const room of await roomsResponse.json()) {
    if (room.bridge_id === telegram.bridge_id) {
      console.log(`Telegram room: ${room.name} | id=${room.room_id || room.id} | chat=${room.external_channel_id || '(missing)'}`);
    }
  }
}
