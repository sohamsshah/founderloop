import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class Store {
  constructor(path = ':memory:', { recover = true } = {}) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_events (
        source_key TEXT PRIMARY KEY, source_mode TEXT NOT NULL, platform TEXT NOT NULL,
        switch_room_id TEXT NOT NULL, sender_id TEXT NOT NULL, source_text TEXT NOT NULL,
        sender_name TEXT, source_timestamp TEXT, switch_message_id TEXT,
        platform_guild_id TEXT, platform_workspace_id TEXT, platform_channel_id TEXT,
        platform_message_id TEXT, platform_message_ts TEXT, platform_sender_id TEXT,
        source_json TEXT NOT NULL, permalink TEXT, evidence_status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_key TEXT NOT NULL REFERENCES source_events(source_key),
        group_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
        title TEXT NOT NULL, assessment TEXT NOT NULL, classification_method TEXT NOT NULL,
        context_json TEXT NOT NULL,
        state TEXT NOT NULL, founder_message_ref TEXT, created_at TEXT NOT NULL,
        UNIQUE(source_key, category)
      );
      CREATE TABLE IF NOT EXISTS card_evidence (
        card_id INTEGER NOT NULL REFERENCES cards(id), source_key TEXT NOT NULL REFERENCES source_events(source_key),
        quote TEXT NOT NULL, permalink TEXT NOT NULL, relation TEXT NOT NULL,
        PRIMARY KEY(card_id, source_key)
      );
      CREATE TABLE IF NOT EXISTS decisions (
        card_id INTEGER PRIMARY KEY REFERENCES cards(id), actor_id TEXT NOT NULL,
        verdict TEXT NOT NULL, comment TEXT, decided_at TEXT NOT NULL,
        sheet_state TEXT, sheet_error TEXT
      );
      CREATE TABLE IF NOT EXISTS outbox (
        key TEXT PRIMARY KEY, card_id INTEGER NOT NULL REFERENCES cards(id), kind TEXT NOT NULL,
        destination TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'PENDING',
        attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT, external_ref TEXT
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER, event TEXT NOT NULL,
        actor_id TEXT, detail TEXT, at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    if (recover) this.recoverInterrupted();
  }

  close() { this.db.close(); }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  getEvent(key) { return this.db.prepare('SELECT * FROM source_events WHERE source_key=?').get(key); }
  getCard(id) { return this.db.prepare('SELECT * FROM cards WHERE id=?').get(id); }
  getCardBySource(key, category = 'PRODUCT') {
    return this.db.prepare('SELECT * FROM cards WHERE source_key=? AND category=?').get(key, category);
  }
  getCardByGroup(groupKey) { return this.db.prepare('SELECT * FROM cards WHERE group_key=?').get(groupKey); }
  listCards() { return this.db.prepare('SELECT * FROM cards ORDER BY id').all(); }
  listOutbox() { return this.db.prepare('SELECT * FROM outbox ORDER BY key').all(); }
  listAudit() { return this.db.prepare('SELECT * FROM audit ORDER BY id').all(); }
  getMeta(key) { return this.db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value; }
  setMeta(key, value) {
    this.db.prepare('INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      .run(key, String(value));
  }

  addEvent(key, event, link) {
    const result = this.db.prepare(`INSERT OR IGNORE INTO source_events
      (source_key,source_mode,platform,switch_room_id,sender_id,source_text,
       sender_name,source_timestamp,switch_message_id,platform_guild_id,platform_workspace_id,
       platform_channel_id,platform_message_id,platform_message_ts,platform_sender_id,
       source_json,permalink,evidence_status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(key, event.source_mode, event.platform, event.switch_room_id, event.sender_id,
        event.text, event.sender_name ?? null, event.timestamp ?? null, event.switch_message_id ?? null,
        event.platform_guild_id ?? null, event.platform_workspace_id ?? null, event.platform_channel_id ?? null,
        event.platform_message_id ?? null, event.platform_message_ts ?? null, event.platform_sender_id ?? null,
        JSON.stringify(event), link, link ? 'FORMAT_VALID' : 'EVIDENCE_BLOCKED', new Date().toISOString());
    return result.changes > 0;
  }

  createCard(key, classification, context, state, groupKey = `${key}:${classification.category}`) {
    const result = this.db.prepare(`INSERT OR IGNORE INTO cards
      (source_key,group_key,category,title,assessment,classification_method,context_json,state,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(key, groupKey, classification.category, `${classification.topic} ${classification.kind}`,
        classification.assessment, classification.method || 'heuristic', JSON.stringify(context), state, new Date().toISOString());
    const card = result.changes ? this.getCard(Number(result.lastInsertRowid)) : this.getCardByGroup(groupKey);
    if (result.changes) this.audit(card.id, 'CARD_CREATED', null, state);
    return card;
  }

  addEvidence(cardId, sourceKey, quote, permalink, relation = 'primary') {
    if (!permalink) return false;
    const result = this.db.prepare(`INSERT OR IGNORE INTO card_evidence
      (card_id,source_key,quote,permalink,relation) VALUES (?,?,?,?,?)`)
      .run(cardId, sourceKey, quote, permalink, relation);
    return result.changes > 0;
  }
  getEvidence(cardId) {
    return this.db.prepare('SELECT * FROM card_evidence WHERE card_id=? ORDER BY relation DESC, source_key LIMIT 3').all(cardId);
  }
  setCardState(id, state) {
    this.db.prepare('UPDATE cards SET state=? WHERE id=?').run(state, id);
    this.audit(id, 'STATE', null, state);
  }
  setFounderRef(id, ref) { this.db.prepare('UPDATE cards SET founder_message_ref=? WHERE id=?').run(ref, id); }
  addOutbox(key, cardId, kind, destination, body) {
    this.db.prepare('INSERT OR IGNORE INTO outbox (key,card_id,kind,destination,body) VALUES (?,?,?,?,?)')
      .run(key, cardId, kind, destination || '', body);
  }
  pending() {
    return this.db.prepare(`SELECT * FROM outbox WHERE state IN ('PENDING','FAILED')
      ORDER BY CASE kind WHEN 'FOUNDER_CARD' THEN 0 WHEN 'SHEET_WRITE' THEN 1
        WHEN 'INTERNAL_VERDICT' THEN 2 ELSE 3 END, key`).all();
  }
  begin(key) {
    this.db.prepare("UPDATE outbox SET state='IN_FLIGHT' WHERE key=? AND state IN ('PENDING','FAILED')").run(key);
  }
  recoverInterrupted() {
    const interrupted = this.db.prepare("SELECT key,card_id,kind FROM outbox WHERE state='IN_FLIGHT'").all();
    for (const item of interrupted) {
      if (item.kind === 'CLOSE_CARD') {
        this.failed(item.key, 'Interrupted edit of the same Slack message');
        continue;
      }
      this.db.prepare("UPDATE outbox SET state='UNCERTAIN', last_error='Process stopped during external operation' WHERE key=?")
        .run(item.key);
      this.db.prepare('UPDATE cards SET state=? WHERE id=?')
        .run(item.kind === 'SHEET_WRITE' ? 'SHEET_WRITE_UNCERTAIN' : 'DELIVERY_UNCERTAIN', item.card_id);
      if (item.kind === 'SHEET_WRITE') {
        this.db.prepare("UPDATE decisions SET sheet_state='UNCERTAIN', sheet_error='Process stopped during external operation' WHERE card_id=?")
          .run(item.card_id);
      }
      this.audit(item.card_id, 'INTERRUPTED_OUTBOX', null, item.key);
    }
  }
  sent(key, ref) {
    this.db.prepare(`UPDATE outbox SET state='SENT', attempt_count=attempt_count+1,
      last_error=NULL, external_ref=? WHERE key=?`).run(ref, key);
  }
  failed(key, error) {
    this.db.prepare(`UPDATE outbox SET state='FAILED', attempt_count=attempt_count+1,
      last_error=? WHERE key=?`).run(String(error).slice(0, 300), key);
  }
  uncertain(key, error) {
    this.db.prepare(`UPDATE outbox SET state='UNCERTAIN', attempt_count=attempt_count+1,
      last_error=? WHERE key=?`).run(String(error).slice(0, 300), key);
  }
  retryUncertain(key) {
    this.db.prepare("UPDATE outbox SET state='PENDING', last_error=NULL WHERE key=? AND state='UNCERTAIN'").run(key);
  }
  getOutbox(key) { return this.db.prepare('SELECT * FROM outbox WHERE key=?').get(key); }
  decisionsWithoutHandoff() {
    return this.db.prepare(`SELECT c.* FROM cards c JOIN decisions d ON d.card_id=c.id
      WHERE c.state <> 'CLOSED'
      AND NOT EXISTS (SELECT 1 FROM outbox WHERE key='verdict:' || c.id)
      AND NOT EXISTS (SELECT 1 FROM outbox WHERE key='sheet:' || c.id AND state <> 'SENT')`).all();
  }
  decision(id) { return this.db.prepare('SELECT * FROM decisions WHERE card_id=?').get(id); }
  addDecision(id, actor, verdict, comment) {
    const result = this.db.prepare(`INSERT OR IGNORE INTO decisions
      (card_id,actor_id,verdict,comment,decided_at) VALUES (?,?,?,?,?)`)
      .run(id, actor, verdict, comment, new Date().toISOString());
    if (result.changes) this.audit(id, 'DECISION', actor, verdict);
    return result.changes > 0;
  }
  setSheetState(id, state, error = null) {
    this.db.prepare('UPDATE decisions SET sheet_state=?, sheet_error=? WHERE card_id=?')
      .run(state, error?.slice(0, 300) || null, id);
  }
  audit(id, event, actor, detail) {
    this.db.prepare('INSERT INTO audit (card_id,event,actor_id,detail,at) VALUES (?,?,?,?,?)')
      .run(id, event, actor, detail, new Date().toISOString());
  }
}
