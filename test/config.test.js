import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, validateLive } from '../src/config.js';

const base = {
  SWITCH_BASE_URL: 'http://127.0.0.1:18000', SWITCH_AGENT_ID: 'agent',
  SWITCH_AGENT_API_KEY: 'key', SWITCH_SOURCE_ROOM_ID: 'source',
  SWITCH_FOUNDER_ROOM_ID: 'founder', SWITCH_PRODUCT_ROOM_ID: 'product',
  FOUNDER_SWITCH_SENDER_ID: 'founder-user',
};

test('live defaults to Product only and does not require Sales or Support rooms', () => {
  const config = readConfig(base);
  assert.deepEqual(config.enabledCategories, ['PRODUCT']);
  assert.doesNotThrow(() => validateLive(config));
});

test('enabling another live category requires its destination room', () => {
  assert.throws(() => validateLive(readConfig({ ...base, FOUNDER_LOOP_ENABLED_CATEGORIES: 'PRODUCT,REVENUE' })), /salesRoomId/);
  assert.throws(() => validateLive(readConfig({ ...base, FOUNDER_LOOP_ENABLED_CATEGORIES: 'PRODUCT,COMMITMENT' })), /supportRoomId/);
  assert.throws(() => validateLive(readConfig({ ...base, FOUNDER_LOOP_ENABLED_CATEGORIES: 'UNKNOWN' })), /FOUNDER_LOOP_ENABLED_CATEGORIES/);
});

test('mixed source mappings constrain category and platform to configured rooms', () => {
  const config = readConfig({ ...base, SWITCH_SOURCE_ROOM_IDS: 'source,support',
    SWITCH_SUPPORT_ROOM_ID: 'support', FOUNDER_LOOP_ENABLED_CATEGORIES: 'PRODUCT,COMMITMENT',
    SWITCH_SOURCE_PLATFORMS: '{"source":"discord","support":"slack"}',
    SWITCH_SOURCE_CATEGORIES: '{"source":["PRODUCT"],"support":["COMMITMENT"]}',
    SLACK_SOURCE_CHANNELS: '{"support":"C12345678"}' });
  assert.doesNotThrow(() => validateLive(config));
  assert.deepEqual(config.sourceCategories.support, ['COMMITMENT']);
  assert.equal(config.slackSourceChannels.support, 'C12345678');
  assert.throws(() => validateLive({ ...config, sourceCategories: { other: ['COMMITMENT'] } }), /SWITCH_SOURCE_CATEGORIES/);
  assert.throws(() => validateLive({ ...config, slackSourceChannels: { other: 'C12345678' } }), /SLACK_SOURCE_CHANNELS/);
});
