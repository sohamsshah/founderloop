import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

export class SwitchConnection {
  constructor({ config, store, onEvent, log = console }) {
    Object.assign(this, { config, store, onEvent, log });
    this.connectionId = store.getMeta('switch_connection_id') || randomUUID();
    store.setMeta('switch_connection_id', this.connectionId);
    this.cursor = Number(store.getMeta('switch_cursor') || 0);
    this.generation = store.getMeta('switch_generation') || null;
    this.running = false;
    this.queue = Promise.resolve();
    this.processingFailed = false;
  }

  url() {
    const base = new URL(this.config.baseUrl);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = `/agents/${encodeURIComponent(this.config.agentId)}/connection/ws`;
    base.search = '';
    base.searchParams.set('connection_id', this.connectionId);
    base.searchParams.set('scope', 'all');
    base.searchParams.set('filter', 'all');
    base.searchParams.set('start_from', this.cursor ? String(this.cursor) : 'head');
    if (this.generation) base.searchParams.set('expected_generation', this.generation);
    const rooms = [...new Set([...(this.config.sourceRoomIds || [this.config.sourceRoomId]), this.config.founderRoomId].filter(Boolean))];
    base.searchParams.set('rooms', rooms.join(','));
    base.searchParams.set('client', 'founder-loop');
    return base.href;
  }

  async connectOnce() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url(), { headers: { Authorization: `Bearer ${this.config.agentKey}` } });
      this.socket = socket;
      this.processingFailed = false;
      let opened = false;
      let fatal = false;
      socket.on('open', () => { opened = true; this.log.info('Switch WebSocket connected'); });
      socket.on('error', error => { if (!opened) reject(error); else this.log.error(`Switch socket error: ${error.message}`); });
      socket.on('message', raw => {
        let frame;
        try { frame = JSON.parse(raw.toString()); }
        catch { this.log.error('Switch sent invalid JSON'); return; }
        const control = frame.data || {};
        if (frame.event === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', cursor: this.cursor }));
          return;
        }
        if (frame.event === 'connection_state') {
          this.generation = String(control.generation);
          this.store.setMeta('switch_generation', this.generation);
          this.log.info(`Switch covers ${control.rooms?.length || 0} rooms with filter=${control.filter}`);
          return;
        }
        if (frame.event === 'gap') {
          this.store.audit(null, 'SWITCH_GAP', null, JSON.stringify({ reason: control.reason, rooms: control.rooms }));
          this.cursor = Number(control.resumed_at || this.cursor);
          this.store.setMeta('switch_cursor', this.cursor);
          this.log.error('Switch event gap detected; affected history needs manual review');
          return;
        }
        if (frame.event === 'evicted' || frame.event === 'refused') {
          if (control.code === 'taken_over' || frame.event === 'refused' || control.code === 'closed') fatal = true;
          this.log.error(`Switch ${frame.event}: ${control.code || control.status || 'unknown'}`);
          return;
        }
        if (typeof frame.id === 'number') {
          this.queue = this.queue.then(async () => {
            if (this.processingFailed) return;
            await this.onEvent(frame);
            this.cursor = Math.max(this.cursor, frame.id);
            this.store.setMeta('switch_cursor', this.cursor);
          }).catch(error => {
            this.processingFailed = true;
            this.log.error(`Switch event processing failed; reconnecting from last cursor: ${error.message}`);
            socket.close();
          });
        }
      });
      socket.on('close', (code) => {
        this.queue.finally(() => {
          if (fatal) reject(new Error(`Switch connection refused or evicted (${code})`));
          else resolve();
        });
      });
    });
  }

  async run() {
    this.running = true;
    while (this.running) {
      try { await this.connectOnce(); }
      catch (error) { this.log.error(error.message); if (/refused or evicted/.test(error.message)) break; }
      if (this.running) await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  stop() { this.running = false; this.socket?.close(); }
}
