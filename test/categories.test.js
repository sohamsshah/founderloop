import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { FounderLoop } from '../src/loop.js';
import { FixtureTransport } from '../src/transport.js';
import { classifySignals } from '../src/classify.js';
import { loadRevenueSheet, matchRevenueSheet, upsertAcceptedLead } from '../src/revenue.js';
import { resolveMessageLink } from '../src/evidence.js';
import { SwitchConnection } from '../src/switch-connection.js';
import { loadProductDoc, matchProductDoc } from '../src/product.js';
import { AmbiguousDeliveryError } from '../src/transport.js';
import { classifyCandidate } from '../src/model-classifier.js';

const base = JSON.parse(readFileSync(new URL('../fixtures/product-event.json', import.meta.url), 'utf8'));
const settings = {
  sourceMode: 'simulated', sourceRoomId: base.switch_room_id,
  founderRoomId: 'founder', productRoomId: 'product', salesRoomId: 'sales', supportRoomId: 'support',
  founderSenderId: 'founder-user', agentSenderId: 'agent', allowFixtureDoc: true, allowFixtureSheet: true,
};
const revenue = { ...base, sender_id: 'prospect-id', sender_name: 'Alex', platform_message_id: 'rev-1',
  text: 'We are interested in an enterprise evaluation. Could we get pricing?' };
const issue = { ...base, sender_id: 'customer-id', platform_message_id: 'support-1',
  text: 'We cannot access our account. Support is urgently needed.' };
const create = extra => {
  const store = new Store();
  const transport = new FixtureTransport();
  const config = { ...settings, ...extra };
  return { store, transport, config, loop: new FounderLoop({ store, transport, config }) };
};
const command = (card, verdict, config = settings) => ({ text: `FL-${String(card.id).padStart(3, '0')} ${verdict}`,
  actorId: config.founderSenderId, roomId: config.founderRoomId, sourceMode: 'simulated' });

test('Revenue fixture creates one cited card, routes one verdict to Sales, and closes', async () => {
  const { store, transport, loop, config } = create({ enabledCategories: ['REVENUE'] });
  const first = await loop.ingest(revenue);
  assert.equal(first.status, 'CARD_DELIVERED');
  assert.equal(first.card.category, 'REVENUE');
  assert.match(transport.posts[0].body, /ORIGINAL MESSAGE \(verbatim\):\n“We are interested/);
  assert.match(transport.posts[0].body, /LEAD SHEET: new \(simulated\)/);
  assert.equal((await loop.decide(command(first.card, 'REJECT', config))).status, 'CLOSED');
  assert.equal(transport.posts[1].destination, 'sales');
  assert.match(transport.posts[1].body, /fixture:\/\/discord\/fixture-guild/);
  assert.equal((await loop.decide(command(first.card, 'ACCEPT', config))).status, 'ALREADY_DECIDED');
  assert.equal(transport.posts.length, 2);
  store.close();
});

test('Repeated messages by stable prospect and topic attach evidence without another card', async () => {
  const { store, transport, loop } = create({ enabledCategories: ['REVENUE'] });
  const first = await loop.ingest(revenue);
  const second = await loop.ingest({ ...revenue, platform_message_id: 'rev-2', text: 'Could we get the pricing for our enterprise evaluation?' });
  assert.equal(first.card.id, second.card.id);
  assert.equal(second.status, 'GROUPED');
  assert.equal(store.getEvidence(first.card.id).length, 2);
  assert.equal(transport.posts.length, 1);
  store.close();
});

test('Matching a display name alone is only a possible existing lead', () => {
  const sheet = { mode: 'live', tab: 'Leads', url: 'https://docs.google.com/spreadsheets/d/id/edit',
    rows: [{ lead_id: 'L1', contact_name: 'Alex', platform: 'discord', platform_user_id: 'different-id', rowNumber: 2 }] };
  const context = matchRevenueSheet(revenue, { topic: 'buying inquiry' }, sheet);
  assert.equal(context.status, 'possibly_existing');
  assert.equal(context.matchedLeadId, null);
});

test('Sheet adapter reads one Leads tab and accepted write upserts by stable lead id', async () => {
  const calls = [];
  const config = { sheetId: 'sheet-id', googleToken: 'token' };
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if ((options.method || 'GET') === 'GET') return { ok: true, json: async () => ({ values: [
      ['lead_id', 'company', 'contact_name', 'platform', 'platform_user_id', 'email_if_supplied', 'source_ref', 'buying_signal', 'stage', 'notes', 'updated_at'],
    ] }) };
    return { ok: true, json: async () => ({}) };
  };
  const sheet = await loadRevenueSheet(config, fetcher);
  assert.equal(sheet.mode, 'live');
  const context = matchRevenueSheet(revenue, { topic: 'buying inquiry' }, sheet);
  context.sourceRef = 'fixture://discord/message';
  await upsertAcceptedLead({ event: revenue, classification: { topic: 'buying inquiry' }, context, config, fetcher });
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  assert.match(calls.at(-1).url, /:append\?/);
});

test('Commitment issue and explicit promise are distinguished; verdict only reaches Support', async () => {
  const types = classifySignals(issue.text);
  assert.equal(types.find(signal => signal.category === 'COMMITMENT').kind, 'customer_issue_only');
  const promised = classifySignals("We'll investigate the login issue.");
  assert.equal(promised.find(signal => signal.category === 'COMMITMENT').kind, 'explicit_company_promise');
  const { store, transport, loop, config } = create({ enabledCategories: ['COMMITMENT'] });
  const card = (await loop.ingest(issue)).card;
  assert.equal((await loop.decide(command(card, 'COMMENT Please review', config))).status, 'CLOSED');
  assert.equal(transport.posts[1].destination, 'support');
  assert.match(transport.posts[1].body, /FOUNDER COMMENT: Please review/);
  assert.equal(transport.posts.length, 2);
  store.close();
});

test('One source may create Product and Commitment cards with separate destinations', async () => {
  const { store, transport, loop, config } = create();
  const result = await loop.ingest({ ...issue, text: 'Our login is broken and we cannot access the product. Please help.' });
  assert.equal(result.status, 'MULTIPLE');
  assert.deepEqual(result.cards.map(item => item.card.category), ['PRODUCT', 'COMMITMENT']);
  for (const item of result.cards) await loop.decide(command(item.card, 'ACCEPT', config));
  assert.deepEqual(transport.posts.filter(post => post.key.startsWith('verdict:')).map(post => post.destination), ['product', 'support']);
  store.close();
});

test('Slack source permalink uses original channel and thread reply ts, and fails closed without IDs', async () => {
  const event = { ...base, source_mode: 'live', platform: 'slack', platform_channel_id: 'C12345678',
    platform_message_ts: '1762490100.123456', platform_message_id: null };
  let requested;
  const link = await resolveMessageLink(event, { slackBotToken: 'token' }, async (url, options) => {
    requested = new URL(url);
    assert.equal(options.headers.authorization, 'Bearer token');
    return { ok: true, json: async () => ({ ok: true, permalink: 'https://app.slack.com/archives/C12345678/p1762490100123456' }) };
  });
  assert.equal(requested.searchParams.get('channel'), 'C12345678');
  assert.equal(requested.searchParams.get('message_ts'), event.platform_message_ts);
  assert.match(link, /p1762490100123456/);
  assert.equal(await resolveMessageLink({ ...event, platform_channel_id: null }, { slackBotToken: 'token' }), null);
});

test('Accepted Revenue Sheet failure is visible and retries before one Sales verdict', async () => {
  const store = new Store();
  const transport = new FixtureTransport();
  const config = { ...settings, enabledCategories: ['REVENUE'], sheetId: 'sheet-id', enableSheetWrite: true };
  let fails = true;
  let writes = 0;
  const loop = new FounderLoop({ store, transport, config,
    sheetLoader: async () => ({ mode: 'live', rows: [], url: 'https://docs.google.com/spreadsheets/d/sheet-id/edit', tab: 'Leads' }),
    sheetWriter: async () => { writes++; if (fails) throw new Error('write unavailable'); },
  });
  const card = (await loop.ingest(revenue)).card;
  assert.equal((await loop.decide(command(card, 'ACCEPT', config))).status, 'SHEET_WRITE_FAILED');
  assert.equal(store.decision(card.id).sheet_state, 'FAILED');
  assert.equal(transport.posts.length, 1);
  assert.equal(writes, 1);
  fails = false;
  await loop.flush();
  assert.equal(store.getCard(card.id).state, 'CLOSED');
  assert.equal(store.decision(card.id).sheet_state, 'SENT');
  assert.equal(transport.posts.filter(post => post.destination === 'sales').length, 1);
  await loop.flush();
  assert.equal(writes, 2);
  store.close();
});

test('Configured native Slack founder ID is required as well as Switch actor and room', async () => {
  const { store, transport, loop, config } = create({ founderSlackUserId: 'U123FOUNDER' });
  const card = (await loop.ingest(base)).card;
  assert.equal((await loop.decide({ ...command(card, 'ACCEPT', config), platformSenderId: 'UIMPOSTOR' })).status, 'UNAUTHORIZED');
  assert.equal((await loop.decide({ ...command(card, 'ACCEPT', config), platformSenderId: 'U123FOUNDER' })).status, 'CLOSED');
  assert.equal(transport.posts.length, 2);
  store.close();
});

test('Switch connection uses documented passive WebSocket scope and persistent cursor', () => {
  const store = new Store();
  store.setMeta('switch_cursor', '4813');
  const connection = new SwitchConnection({ store, config: { baseUrl: 'http://127.0.0.1:18000',
    agentId: 'agent-id', agentKey: 'secret', sourceRoomIds: ['source'], founderRoomId: 'founder' },
  onEvent: async () => {} });
  const url = new URL(connection.url());
  assert.equal(url.protocol, 'ws:');
  assert.equal(url.pathname, '/agents/agent-id/connection/ws');
  assert.equal(url.searchParams.get('scope'), 'all');
  assert.equal(url.searchParams.get('filter'), 'all');
  assert.equal(url.searchParams.get('start_from'), '4813');
  assert.equal(url.searchParams.get('rooms'), 'source,founder');
  store.close();
});

test('Named public Google Doc export is clearly labeled and does not invert a not-planned statement', async () => {
  const doc = await loadProductDoc({ docId: 'doc-id', publicDocExport: true }, async () => ({
    ok: true, text: async () => 'Roadmap — Later\nNo scheduled exports, reminders, or dashboards are planned for the MVP.\n',
  }));
  assert.equal(doc.mode, 'public_export');
  const match = matchProductDoc({ topic: 'exports' }, doc);
  assert.equal(match.status, 'not_planned');
  assert.match(match.excerpt, /No scheduled exports/);
  assert.equal(match.url, 'https://docs.google.com/document/d/doc-id/edit');
});

test('Interrupted outbound attempt is held after SQLite restart instead of reposted', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'founder-loop-interrupted-'));
  try {
    const path = join(dir, 'state.sqlite');
    const transport = new FixtureTransport();
    let store = new Store(path);
    let loop = new FounderLoop({ store, transport, config: settings });
    const card = (await loop.ingest(base)).card;
    store.addOutbox(`verdict:${card.id}`, card.id, 'INTERNAL_VERDICT', 'product', 'test');
    store.begin(`verdict:${card.id}`);
    store.close();
    store = new Store(path);
    loop = new FounderLoop({ store, transport, config: settings });
    assert.equal(store.getOutbox(`verdict:${card.id}`).state, 'UNCERTAIN');
    assert.equal(store.getCard(card.id).state, 'DELIVERY_UNCERTAIN');
    await loop.flush();
    assert.equal(transport.posts.length, 1);
    store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Interrupted Sheet write leaves the decision visibly uncertain after restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'founder-loop-sheet-interrupted-'));
  try {
    const path = join(dir, 'state.sqlite');
    let store = new Store(path);
    const card = (await new FounderLoop({ store, transport: new FixtureTransport(), config: settings }).ingest(revenue)).card;
    store.addDecision(card.id, settings.founderSenderId, 'ACCEPT', null);
    store.setSheetState(card.id, 'PENDING');
    store.addOutbox(`sheet:${card.id}`, card.id, 'SHEET_WRITE', 'sheet-id', '');
    store.begin(`sheet:${card.id}`);
    store.close();
    store = new Store(path);
    assert.equal(store.getOutbox(`sheet:${card.id}`).state, 'UNCERTAIN');
    assert.equal(store.getCard(card.id).state, 'SHEET_WRITE_UNCERTAIN');
    assert.equal(store.decision(card.id).sheet_state, 'UNCERTAIN');
    store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Ambiguous Google Sheet append stops automatic retries', async () => {
  const config = { sheetId: 'sheet-id', googleToken: 'token' };
  const context = { mode: 'live', leadId: 'FL-LEAD-1', sourceRef: 'fixture://source' };
  const fetcher = async (_url, options) => {
    if (!options.method) return { ok: true, json: async () => ({ values: [['lead_id']] }) };
    throw new Error('connection lost after send');
  };
  await assert.rejects(upsertAcceptedLead({ event: revenue, classification: { topic: 'buying inquiry' },
    context, config, fetcher }), AmbiguousDeliveryError);
});

test('Optional structured model classification validates exact evidence and falls back on failure', async () => {
  let calls = 0;
  const config = { llmApiKey: 'test-key', llmModel: 'configured-model' };
  const fetcher = async (_url, options) => {
    calls++;
    const request = JSON.parse(options.body);
    assert.equal(request.text.format.type, 'json_schema');
    assert.equal(request.store, false);
    return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text',
      text: JSON.stringify({ signals: [{ category: 'REVENUE', kind: 'buying_signal', topic: 'pricing',
        confidence: 0.9, assessment: 'Possible buying intent', evidence_excerpt: 'get pricing' }] }) }] }] }) };
  };
  const signals = await classifyCandidate('Could we get pricing?', config, fetcher);
  assert.equal(calls, 1);
  assert.equal(signals[0].method, 'model');
  assert.equal(signals[0].evidence_excerpt, 'get pricing');
  assert.deepEqual(await classifyCandidate('Thanks, works great!', config, fetcher), []);
  assert.equal(calls, 1);
  const fallback = await classifyCandidate('Could we get pricing?', config, async () => { throw new Error('network down'); });
  assert.equal(fallback[0].method, 'heuristic_fallback');
  assert.equal((await classifyCandidate('Please add CSV export.', {}))[0].category, 'PRODUCT');
});

test('Confidence threshold suppresses low-confidence founder cards', async () => {
  const { store, transport, loop } = create({ minConfidence: 0.95 });
  assert.equal((await loop.ingest(base)).status, 'NO_SIGNAL');
  assert.equal(transport.posts.length, 0);
  store.close();
});
