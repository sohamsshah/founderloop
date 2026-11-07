import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { FounderLoop } from './loop.js';
import { FixtureTransport, SwitchTransport } from './transport.js';
import { SwitchConnection } from './switch-connection.js';
import { readConfig, validateLive } from './config.js';

const mode = process.argv[2];

async function demo() {
  const scope = process.argv[3] || 'all';
  const product = JSON.parse(await readFile(new URL('../fixtures/product-event.json', import.meta.url), 'utf8'));
  const examples = [
    product,
    { ...product, platform_message_id: 'fixture-revenue-001', sender_id: 'prospect-123',
      sender_name: 'Prospect', text: 'Could we schedule an enterprise evaluation and get pricing for SSO?' },
    { ...product, platform_message_id: 'fixture-commitment-001', sender_id: 'customer-789',
      sender_name: 'Customer', text: 'Our login is broken and we cannot access the product. Please help.' },
  ];
  const config = {
    sourceMode: 'simulated', sourceRoomId: product.switch_room_id,
    founderRoomId: 'fixture-founder-room', productRoomId: 'fixture-product-room',
    salesRoomId: 'fixture-sales-room', supportRoomId: 'fixture-support-room',
    founderSenderId: 'fixture-founder', agentSenderId: 'fixture-bot',
    allowFixtureDoc: true, allowFixtureSheet: true,
    enabledCategories: scope === 'product' ? ['PRODUCT'] : undefined,
  };
  const store = new Store(':memory:');
  const transport = new FixtureTransport();
  const loop = new FounderLoop({ store, transport, config });
  console.log('=== SIMULATED FIXTURE REPLAY: no live Switch, Discord, Slack, Google Doc or Sheet ===');
  for (const event of (scope === 'product' ? examples.slice(0, 1) : examples)) {
    const result = await loop.ingest(event);
    const cards = result.cards ? result.cards.map(item => item.card) : [result.card].filter(Boolean);
    for (const card of cards) {
      const founderPost = transport.posts.find(post => post.key === `card:${card.id}`);
      console.log(`\nFounder card in simulated #founder-loop:\n${founderPost?.body || '(none)'}`);
      const verdict = card.category === 'PRODUCT' ? 'ACCEPT' : card.category === 'REVENUE' ? 'REJECT' : 'COMMENT Please review this issue';
      const decision = await loop.decide({ text: `FL-${String(card.id).padStart(3, '0')} ${verdict}`,
        actorId: config.founderSenderId, roomId: config.founderRoomId, sourceMode: 'simulated' });
      console.log(`Decision: ${decision.status}`);
      const internal = transport.posts.find(post => post.key === `verdict:${card.id}`);
      console.log(`Internal verdict in simulated ${internal?.destination}:\n${internal?.body || '(none)'}`);
    }
  }
  console.log(`\nCards: ${store.listCards().length}; outbound posts: ${transport.posts.length}; all closed: ${store.listCards().every(card => card.state === 'CLOSED')}`);
  store.close();
}

async function live() {
  const config = readConfig();
  validateLive(config);
  const store = new Store(resolve(process.env.FOUNDER_LOOP_DB || './data/founder-loop.sqlite'));
  const loop = new FounderLoop({ store, transport: new SwitchTransport(config), config });
  await loop.flush();
  const retry = setInterval(() => loop.flush().catch(error => console.error(`Outbox retry: ${error.message}`)), 10000);
  const connection = new SwitchConnection({ config, store, onEvent: async frame => {
    if (frame.event !== 'message') return;
    const roomId = frame.data?.room_id;
    if (config.sourceRoomIds.includes(roomId)) {
      const result = await loop.ingest(frame);
      console.log(`Source event: ${result.status}`);
    } else if (roomId === config.founderRoomId) {
      const payload = frame.data?.payload || {};
      const result = await loop.decide({ text: payload.body || '', actorId: payload.sender,
        platformSenderId: payload.platform_sender_id, roomId, sourceMode: 'live' });
      if (result.status !== 'INVALID_COMMAND') console.log(`Founder command: ${result.status}`);
    }
  } });
  const shutdown = () => { clearInterval(retry); connection.stop(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  console.log('LIVE Switch adapter starting. Source rooms are read only; native source IDs are required for cards.');
  await connection.run();
  clearInterval(retry);
  store.close();
}

if (mode === 'demo') await demo();
else if (mode === 'live') await live();
else { console.error('Use `npm run demo`, `npm run demo:product`, or `npm run live`.'); process.exitCode = 2; }
