import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/store.js';
import { FounderLoop } from '../src/loop.js';
import { FixtureTransport } from '../src/transport.js';
import { classifySignals } from '../src/classify.js';
import { loadRevenueSheet, matchRevenueSheet, revenueColumns, upsertAcceptedLead } from '../src/revenue.js';
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

test('authoritative Revenue rows group Discord, Sales, CSM and Support by decision revision', async () => {
  const discord = base.switch_room_id;
  const rooms = [discord, 'sales-intake', 'customer-success', 'support-alerts'];
  const revenueSources = { [discord]: 'discord', 'sales-intake': 'sales', 'customer-success': 'csm', 'support-alerts': 'csm' };
  const { store, transport, loop } = create({ sourceRoomIds: rooms, enabledCategories: ['REVENUE'], revenueSources,
    sourceCategories: Object.fromEntries(rooms.map(room => [room, ['REVENUE']])) });
  const row = {
    lead_id: 'ACME-001', company: 'Acme', owner: 'Sales', platform: 'discord', platform_user_id: 'native-prospect',
    stage: 'renewal', currency: 'USD', opportunity_value: '12000', current_mrr: '600', renewal_date: '2026-12-01',
    next_step: 'Prepare options', decision_status: 'founder_review', decision_revision: '1',
    decision_question: 'Approve an exception to retain the account?', notes: 'private note',
  };
  const fetcher = async () => ({ ok: true, json: async () => ({ values: [revenueColumns, revenueColumns.map(key => row[key] || '')] }) });
  loop.sheetLoader = () => loadRevenueSheet({ sheetId: 'sheet', googleToken: 'read-token' }, fetcher);
  const ingest = (room, id, text) => loop.ingest({ ...revenue, platform: room === discord ? 'discord' : 'slack',
    switch_room_id: room, platform_message_id: id, platform_sender_id: room === discord ? 'native-prospect' : 'employee', text });
  try {
    assert.equal((await ingest('sales-intake', 'unlinked', 'Can we approve the discount?')).status, 'NO_FOUNDER_DECISION');
    assert.equal((await ingest('sales-intake', 'routine', 'Lead ID: ACME-001. Sent the weekly update.')).status, 'NO_SIGNAL');
    const first = await ingest(discord, 'external', 'Could we get an enterprise quote?');
    assert.equal(first.status, 'CARD_DELIVERED');
    assert.match(transport.posts[0].body, /Opportunity value: USD 12000.*Current MRR: USD 600/);
    assert.match(transport.posts[0].body, /Approve an exception to retain the account/);
    assert.doesNotMatch(transport.posts[0].body, /private note/);
    for (const [room, text] of [
      ['sales-intake', 'Lead ID: ACME-001. Can we approve the discount?'],
      ['customer-success', 'Lead ID: ACME-001. The account is a churn risk.'],
      ['support-alerts', 'Lead ID: ACME-001. They will not renew.'],
    ]) {
      const followup = await ingest(room, room, text);
      assert.equal(followup.status, 'GROUPED');
      assert.equal(followup.card.id, first.card.id);
    }
    loop.config.enableSheetWrite = true;
    loop.sheetWriter = async () => assert.fail('Authoritative sheet must not be written');
    assert.equal((await loop.decide(command(first.card, 'ACCEPT'))).status, 'CLOSED');
    assert.match(transport.posts[1].body, /SHEET WRITE: READ_ONLY/);
    assert.equal(transport.posts[1].destination, 'sales');
    row.decision_status = 'hold';
    row.decision_revision = '2';
    assert.equal((await ingest('customer-success', 'held', 'Lead ID: ACME-001. Renewal risk.')).status, 'NO_FOUNDER_DECISION');
    row.decision_status = 'founder_review';
    assert.equal((await ingest('customer-success', 'new-revision', 'Lead ID: ACME-001. Renewal risk.')).status, 'CARD_DELIVERED');
    assert.equal(transport.posts.length, 3);
  } finally {
    store.close();
  }
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

test('urgent CSM signals bypass hold and missing IDs without borrowing ambiguous account figures', async () => {
  const room = base.switch_room_id;
  const { store, transport, loop } = create({ enabledCategories: ['REVENUE'],
    revenueSources: { [room]: 'csm' }, sourceCategories: { [room]: ['REVENUE'] } });
  const northwind = { lead_id: 'DEMO-002', company: 'Demo Northwind Studio', decision_status: 'hold',
    decision_revision: '1', currency: 'USD', current_mrr: '500' };
  const rows = [northwind];
  loop.sheetLoader = async () => ({ mode: 'simulated', pipeline: true, rows });
  const ingest = (id, text) => loop.ingest({ ...base, platform: 'slack', platform_message_id: id, text });
  try {
    assert.equal((await ingest('routine', 'Northwind has some renewal risk.')).status, 'NO_FOUNDER_DECISION');
    assert.equal((await ingest('urgent', 'Churn rate super high for northwind')).status, 'CARD_DELIVERED');
    assert.match(transport.posts[0].body, /REVENUE ESCALATION.*\nREVENUE CONTEXT:.*Current MRR: USD 500/);
    assert.equal((await ingest('follow-up', 'Northwind will not renew.')).status, 'GROUPED');
    assert.equal((await ingest('discount', 'Northwind may not renew. Can we approve a renewal discount?')).status, 'GROUPED');
    rows.push({ ...northwind, lead_id: 'OTHER', company: 'Northwind Labs', current_mrr: '900' });
    const ambiguous = 'Northwind needs founder approval today for a discount.';
    assert.equal((await ingest('ambiguous', ambiguous)).status, 'CARD_DELIVERED');
    assert.match(transport.posts[1].body, /no verified account match/);
    assert.doesNotMatch(transport.posts[1].body, /Current MRR/);
    assert.equal((await ingest('duplicate', ambiguous)).status, 'GROUPED');
  } finally {
    store.close();
  }
});

test('public Revenue export preserves quoted fields and is read-only', async () => {
  const cells = Object.fromEntries(revenueColumns.map(name => [name, '']));
  Object.assign(cells, { lead_id: 'DEMO-001', company: 'Demo, Inc.', decision_question: 'Approve "pilot" terms?\nConfirm scope.' });
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  const text = [revenueColumns, revenueColumns.map(name => cells[name])].map(row => row.map(quote).join(',')).join('\r\n');
  const fetcher = async (url, options) => {
    assert.match(String(url), /sheet=Leads/);
    assert.equal(options.headers.authorization, undefined);
    assert.equal(options.method, undefined);
    return { ok: true, text: async () => text };
  };
  const config = { sheetId: 'demo', publicRevenueExport: true };
  const result = await loadRevenueSheet(config, fetcher);
  assert.equal(result.mode, 'public_export');
  assert.equal(result.rows[0].company, cells.company);
  assert.equal(result.rows[0].decision_question, cells.decision_question);
  await assert.rejects(upsertAcceptedLead({ config, context: result, fetcher }), /write unavailable/);
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

test('support intake forwards only issues or promises to founder', async () => {
  const { store, transport, loop, config } = create({
    sourceRoomIds: [base.switch_room_id, 'support'], enabledCategories: ['PRODUCT', 'COMMITMENT'],
    sourceCategories: { [base.switch_room_id]: ['PRODUCT'], support: ['COMMITMENT'] },
  });
  const supportMessage = { ...issue, switch_room_id: 'support' };
  assert.equal((await loop.ingest({ ...supportMessage, platform_message_id: 'noise-1', text: 'build ui for button' })).status, 'NO_SIGNAL');
  assert.equal(transport.posts.length, 0);
  const result = await loop.ingest(supportMessage);
  assert.equal(result.status, 'CARD_DELIVERED');
  assert.equal(result.card.category, 'COMMITMENT');
  assert.equal(transport.posts[0].destination, config.founderRoomId);
  assert.equal((await loop.decide(command(result.card, 'ACCEPT', config))).status, 'CLOSED');
  assert.equal(transport.posts[1].destination, config.supportRoomId);
  assert.equal((await loop.ingest({ ...supportMessage, platform_message_id: 'product-1',
    text: 'Could Product add scheduled exports?' })).status, 'NO_SIGNAL');
  store.close();
});

test('One source may create Product and Commitment cards with separate destinations', async () => {
  const { store, transport, loop, config } = create();
  const result = await loop.ingest({ ...issue, text: 'Scheduled exports are broken and we cannot access the product. Please help.' });
  assert.equal(result.status, 'MULTIPLE');
  assert.deepEqual(result.cards.map(item => item.card.category), ['PRODUCT', 'COMMITMENT']);
  for (const item of result.cards) await loop.decide(command(item.card, 'ACCEPT', config));
  assert.deepEqual(transport.posts.filter(post => post.key.startsWith('verdict:')).map(post => post.destination), ['product', 'support']);
  store.close();
});

test('founder channel only receives actionable roadmap, buying, and support signals', async () => {
  const { store, transport, loop } = create();
  const roadmap = { mode: 'simulated', title: 'Roadmap', sections: [
    { text: 'ROADMAP | manual-exports | 1 | manual exports | shipped | Product | TBD | hold | -' },
    { text: 'ROADMAP | dashboard-reporting | 1 | dashboard reporting | proposed | Product | TBD | hold | -' },
    { text: 'ROADMAP | scheduled-exports | 1 | scheduled exports | proposed | Product | 2026-12-01 | founder_review | Approve a scoped pilot?' },
  ] };
  loop.docLoader = async () => roadmap;
  const ingest = (id, text) => loop.ingest({ ...base, platform_message_id: id, text });
  assert.equal((await ingest('hold', 'Could Product add manual exports?')).status, 'NO_FOUNDER_DECISION');
  assert.equal((await ingest('proposed-hold', 'Could Product add dashboard reporting?')).status, 'NO_FOUNDER_DECISION');
  assert.equal((await ingest('unknown', 'Could Product add new dashboard widgets?')).status, 'NO_FOUNDER_DECISION');
  assert.equal((await ingest('review', 'Could Product add scheduled exports?')).status, 'CARD_DELIVERED');
  assert.equal((await ingest('repeat', 'We need scheduled exports.')).status, 'GROUPED');
  assert.match(transport.posts[0].body, /ROADMAP DEADLINE: 2026-12-01/);
  assert.equal((await ingest('pricing', 'Could we get pricing?')).status, 'NO_FOUNDER_DECISION');
  loop.sheetLoader = async () => ({ mode: 'simulated', rows: [
    { lead_id: 'L1', platform: base.platform, platform_user_id: base.platform_sender_id || base.sender_id, stage: 'active' },
  ] });
  assert.equal((await ingest('existing', 'Could we get an enterprise quote?')).status, 'NO_FOUNDER_DECISION');
  assert.equal((await ingest('routine', 'The help page is not working. Can support check?')).status, 'NO_FOUNDER_DECISION');
  assert.equal((await ingest('promise', "We'll restore access by Friday.")).status, 'CARD_DELIVERED');
  assert.match(transport.posts[1].body, /PROMISED DEADLINE \(verbatim\): “by Friday”/);
  assert.equal(transport.posts.length, 2);
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

test('support Slack citation resolves only one exact human message', async () => {
  const event = { ...base, source_mode: 'live', platform: 'slack', switch_room_id: 'support',
    platform_channel_id: null, platform_message_ts: null, platform_message_id: null,
    timestamp: '2026-11-07T09:30:00.000Z', text: 'Our login is broken and we cannot access it.' };
  const config = { slackSourceChannels: { support: 'C12345678' }, slackBotToken: 'token' };
  const calls = [];
  const fetcher = async url => {
    const u = new URL(url); calls.push(u);
    return { ok: true, json: async () => u.pathname.endsWith('conversations.history')
      ? { ok: true, messages: [{ ts: '1794043800.123456', user: 'U12345678', text: event.text }] }
      : { ok: true, permalink: 'https://workspace.slack.com/archives/C12345678/p1794043800123456' } };
  };
  const link = await resolveMessageLink(event, config, fetcher);
  assert.match(link, /p1794043800123456/);
  assert.equal(event.platform_channel_id, 'C12345678');
  assert.equal(event.platform_message_ts, '1794043800.123456');
  assert.equal(calls[0].searchParams.get('channel'), 'C12345678');
  assert.equal(calls[1].searchParams.get('message_ts'), '1794043800.123456');
  const ambiguous = { ...event, platform_channel_id: null, platform_message_ts: null };
  assert.equal(await resolveMessageLink(ambiguous, config, async () => ({ ok: true, json: async () => ({
    ok: true, messages: [{ ts: '1794043800.123456', user: 'U12345678', text: event.text },
      { ts: '1794043800.654321', user: 'U12345678', text: event.text }],
  }) })), null);
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

test('Verified Switch founder identity works when bridge omits native ID, but a conflicting native ID is rejected', async () => {
  const { store, transport, loop, config } = create({ founderSlackUserId: 'U123FOUNDER' });
  const card = (await loop.ingest(base)).card;
  assert.equal((await loop.decide({ ...command(card, 'ACCEPT', config), platformSenderId: 'UIMPOSTOR' })).status, 'UNAUTHORIZED');
  assert.equal((await loop.decide({ ...command(card, 'ACCEPT', config), platformSenderId: undefined })).status, 'CLOSED');
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
    if (!options.method) return { ok: true, json: async () => ({ values: [
      ['lead_id', 'company', 'contact_name', 'platform', 'platform_user_id', 'email_if_supplied', 'source_ref', 'buying_signal', 'stage', 'notes', 'updated_at'],
    ] }) };
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
