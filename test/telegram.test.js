import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, validateLive } from '../src/config.js';
import { resolveMessageLink } from '../src/evidence.js';
import { FounderLoop } from '../src/loop.js';
import { Store } from '../src/store.js';
import { FixtureTransport } from '../src/transport.js';
import { loadProductDoc } from '../src/product.js';

const chatId = '-1001234567890';
const timestamp = Date.UTC(2026, 10, 7);
const body = 'Could Product add scheduled exports for our team?';
const config = readConfig({
  SWITCH_BASE_URL: 'http://localhost:18000', SWITCH_AGENT_ID: 'agent', SWITCH_AGENT_API_KEY: 'fixture',
  SWITCH_FOUNDER_ROOM_ID: 'founder', SWITCH_PRODUCT_ROOM_ID: 'product', FOUNDER_SWITCH_SENDER_ID: 'founder-user',
  SWITCH_SOURCE_ROOM_IDS: 'discord-room,tg-room',
  SWITCH_SOURCE_PLATFORMS: '{"discord-room":"discord","tg-room":"telegram"}',
  TELEGRAM_SOURCE_CHATS: JSON.stringify({ 'tg-room': chatId }), TELEGRAM_EVIDENCE_BOT_TOKEN: 'fixture',
});
const frame = { event: 'message', data: { type: 'message', room_id: 'tg-room', payload: {
  sender: 'switch-customer', sender_name: 'customer_example', message_id: 'switch-message',
  body, timestamp, addressed: false,
} } };
const message = { message_id: 42, date: timestamp / 1000, text: body,
  chat: { id: Number(chatId), type: 'supergroup' },
  from: { id: 123456789, username: 'customer_example', is_bot: false } };

test('Telegram post reaches the shared founder flow with a verified original link', async () => {
  validateLive(config);
  const store = new Store(':memory:');
  const transport = new FixtureTransport();
  config.telegramEvidenceStore = store;
  try {
    const fetcher = async () => ({ ok: true, json: async () =>
      ({ ok: true, result: [{ update_id: 7, message }] }) });
    const loop = new FounderLoop({ store, transport, config,
      docLoader: () => loadProductDoc({ sourceMode: 'simulated', allowFixtureDoc: true }),
      linkResolver: (event, options) => resolveMessageLink(event, options, fetcher),
    });
    const result = await loop.ingest(frame);
    assert.equal(result.status, 'CARD_DELIVERED');
    assert.match(transport.posts[0].body, /https:\/\/t\.me\/c\/1234567890\/42/);
    assert.equal((await loop.ingest(frame)).status, 'DUPLICATE');
    assert.equal(store.getMeta('telegram_update_offset'), '8');
    assert.equal((await loop.decide({ text: 'FL-001 ACCEPT', actorId: 'founder-user', roomId: 'founder' })).status, 'CLOSED');
    assert.deepEqual(transport.posts.map(post => post.destination), ['founder', 'product']);
  } finally { store.close(); delete config.telegramEvidenceStore; }
});

test('Telegram rejects unmapped chats, ambiguous messages, and bot authors', async () => {
  assert.throws(() => validateLive({ ...config, telegramSourceChats: {} }), /TELEGRAM_SOURCE_CHATS/);
  const event = { platform: 'telegram', source_mode: 'live', switch_room_id: 'tg-room',
    sender_name: 'customer_example', text: body, timestamp: new Date(timestamp).toISOString() };
  assert.equal(await resolveMessageLink({ ...event, platform_channel_id: '-1009999999999' }, config,
    () => assert.fail('wrong chat must be rejected before lookup')), null);
  const respond = messages => async () => ({ ok: true, json: async () =>
    ({ ok: true, result: messages.map((item, index) => ({ update_id: index + 1, message: item })) }) });
  assert.equal(await resolveMessageLink(event, config, respond([message, { ...message, message_id: 43 }])), null);
  assert.equal(await resolveMessageLink(event, config, respond([{ ...message, from: { ...message.from, is_bot: true } }])), null);
  assert.equal(await resolveMessageLink(event, config, respond([{ ...message, text: 'different' }])), null);
});

test('Telegram can cite the Switch correlation table with one bot and a scoped DB role', async () => {
  const queries = [];
  class FakeClient {
    async connect() {}
    async query(sql, params) {
      queries.push([sql, params]);
      if (sql.startsWith('SELECT external_post_id')) return { rows: [{ external_post_id: `${chatId}:42` }] };
      return { rows: [] };
    }
    async end() {}
  }
  const dbConfig = { ...config, telegramEvidenceBotToken: '', telegramDbHost: 'postgres',
    telegramDbName: 'switch', telegramDbUser: 'evidence', telegramDbPassword: 'fixture',
    telegramDbTenantId: 'tenant', telegramDbClientClass: FakeClient };
  validateLive(dbConfig);
  const event = { platform: 'telegram', source_mode: 'live', switch_room_id: 'tg-room',
    switch_message_id: 'sw_event', timestamp: new Date(timestamp).toISOString(), text: body };
  assert.equal(await resolveMessageLink(event, dbConfig), 'https://t.me/c/1234567890/42');
  assert.equal(event.platform_message_id, '42');
  assert.ok(queries.some(([sql, params]) => sql.includes('transport_event_id=$1') &&
    params[0] === 'sw_event' && params[1] === chatId));
  assert.equal(await resolveMessageLink({ ...event, platform_channel_id: '-1009999999999' }, dbConfig), null);
});
