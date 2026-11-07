import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, validateLive } from '../src/config.js';
import { resolveMessageLink } from '../src/evidence.js';
import { FounderLoop } from '../src/loop.js';
import { Store } from '../src/store.js';
import { FixtureTransport } from '../src/transport.js';
import { loadProductDoc } from '../src/product.js';

const channelId = 'c'.repeat(26);
const postId = 'p'.repeat(26);
const userId = 'u'.repeat(26);
const timestamp = Date.UTC(2026, 10, 7);
const body = 'Could Product add scheduled exports for our team?';
const config = readConfig({
  SWITCH_BASE_URL: 'http://localhost:18000', SWITCH_AGENT_ID: 'agent', SWITCH_AGENT_API_KEY: 'fixture',
  SWITCH_FOUNDER_ROOM_ID: 'founder', SWITCH_PRODUCT_ROOM_ID: 'product', FOUNDER_SWITCH_SENDER_ID: 'founder-user',
  SWITCH_SOURCE_ROOM_IDS: 'discord-room,mm-room',
  SWITCH_SOURCE_PLATFORMS: '{"discord-room":"discord","mm-room":"mattermost"}',
  SWITCH_SOURCE_CATEGORIES: '{"discord-room":["PRODUCT"],"mm-room":["PRODUCT"]}',
  MATTERMOST_SOURCE_CHANNELS: JSON.stringify({ 'mm-room': channelId }),
  MATTERMOST_URL: 'http://mattermost:8065', MATTERMOST_PUBLIC_URL: 'http://127.0.0.1:55572',
  MATTERMOST_TEAM: 'customers', MATTERMOST_READ_TOKEN: 'fixture',
});
const frame = { event: 'message', data: { type: 'message', room_id: 'mm-room', payload: {
  sender: 'switch-customer', sender_name: 'Customer Example', message_id: 'switch-message',
  body, timestamp, addressed: false,
} } };
const post = { id: postId, user_id: userId, channel_id: channelId, message: body, create_at: timestamp };
const author = { id: userId, first_name: 'Customer', last_name: 'Example', is_bot: false };

test('unmentioned Mattermost post without native IDs reaches the shared founder decision flow', async () => {
  validateLive(config);
  const store = new Store(':memory:');
  const transport = new FixtureTransport();
  try {
    const requests = [];
    const fetcher = async url => {
      requests.push(url);
      return { ok: true, json: async () => url.includes('/users/') ? author : { posts: { [postId]: post } } };
    };
    const loop = new FounderLoop({ store, transport, config,
      docLoader: () => loadProductDoc({ sourceMode: 'simulated', allowFixtureDoc: true }),
      linkResolver: (event, options) => resolveMessageLink(event, options, fetcher),
    });
    const result = await loop.ingest(frame);
    assert.equal(result.status, 'CARD_DELIVERED');
    const permalink = `http://127.0.0.1:55572/customers/pl/${postId}`;
    assert.ok(transport.posts[0].body.includes(permalink));
    assert.ok(transport.posts[0].body.includes(body));
    assert.equal((await loop.ingest(frame)).status, 'DUPLICATE');
    assert.equal(requests.length, 2);
    const decision = await loop.decide({ text: 'FL-001 ACCEPT', actorId: 'founder-user', roomId: 'founder' });
    assert.equal(decision.status, 'CLOSED');
    assert.deepEqual(transport.posts.map(item => item.destination), ['founder', 'product']);
    assert.ok(transport.posts[1].body.includes(permalink));
  } finally {
    store.close();
  }
});

test('Mattermost requires a scoped channel map and rejects wrong channels, ambiguous history and bots', async () => {
  assert.throws(() => validateLive({ ...config, mattermostSourceChannels: {} }), /MATTERMOST_SOURCE_CHANNELS/);
  const event = { platform: 'mattermost', source_mode: 'live', switch_room_id: 'mm-room',
    sender_name: 'Customer Example', text: body, timestamp: new Date(timestamp).toISOString() };
  assert.equal(await resolveMessageLink({ ...event, platform_channel_id: 'x'.repeat(26) }, config,
    () => assert.fail('wrong channel must be rejected before lookup')), null);
  const duplicate = { ...post, id: 'd'.repeat(26) };
  assert.equal(await resolveMessageLink(event, config, async () =>
    ({ ok: true, json: async () => ({ posts: { [postId]: post, [duplicate.id]: duplicate } }) })), null);
  assert.equal(await resolveMessageLink({ ...event, platform_message_id: postId }, config, async url =>
    ({ ok: true, json: async () => url.endsWith(`/posts/${postId}`) ? post : { ...author, is_bot: true } })), null);
});
