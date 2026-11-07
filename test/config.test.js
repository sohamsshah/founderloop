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
