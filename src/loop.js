import { escapeSlack, normalizeEvent, resolveMessageLink, sourceText, validSource } from './evidence.js';
import { classifyCandidate } from './model-classifier.js';
import { loadProductDoc, matchProductDoc } from './product.js';
import { leadGroupKey, loadRevenueSheet, matchRevenueSheet, upsertAcceptedLead } from './revenue.js';
import { AmbiguousDeliveryError } from './transport.js';

const label = id => `FL-${String(id).padStart(3, '0')}`;
const safe = escapeSlack;

function citation(link, text = 'View exact original message') {
  return link.startsWith('fixture:') ? `${link} (simulated, not a live permalink)` : `<${link}|${text}>`;
}

function contextLines(card, context) {
  if (card.category === 'PRODUCT') {
    if (context.mode === 'unavailable') return 'PRODUCT KNOWLEDGE: unavailable';
    return `PRODUCT KNOWLEDGE: ${safe(context.title)} — ${safe(context.heading || 'no matching section')} (${safe(context.status)}; ${safe(context.mode)})` +
      (context.url ? `\nGOOGLE DOC: <${context.url}|Open document>` : '\nGOOGLE DOC: no live document link (simulated snapshot)') +
      (context.excerpt ? `\nDOCUMENT EXCERPT (verbatim):\n“${safe(context.excerpt)}”` : '');
  }
  if (card.category === 'REVENUE') {
    const match = context.matchedLeadId ? `; matched lead ${safe(context.matchedLeadId)} in row ${context.matchedRow}` : '';
    return `LEAD SHEET: ${safe(context.status)} (${safe(context.mode)}${match})` +
      (context.url ? `\nGOOGLE SHEET: <${context.url}|Open Leads sheet>` : '\nGOOGLE SHEET: no live Sheet link');
  }
  return `COMMITMENT TYPE: ${safe(context.kind)}. No owner, deadline, or outcome is inferred.`;
}

export function renderFounderCard(card, event, context, link, evidence = []) {
  const mode = event.source_mode === 'simulated' ? '[SIMULATED FIXTURE] ' : '[LIVE] ';
  const source = `${safe(event.platform)} #${safe(event.channel_name)} · ${safe(event.sender_name)} · ${safe(event.timestamp)}`;
  const supporting = evidence.filter(item => item.source_key !== card.source_key).slice(0, 2)
    .map(item => `\nSUPPORTING ORIGINAL (verbatim excerpt): “${safe(item.quote.slice(0, 320))}”\nVIEW SUPPORTING: ${citation(item.permalink)}`).join('');
  return `${mode}${label(card.id)} · ${card.category} · ${safe(card.title)}\nSOURCE: ${source}\n` +
    `ORIGINAL MESSAGE (verbatim${event.text.length > 1200 ? ' excerpt' : ''}):\n“${safe(sourceText(event))}”\n` +
    `VIEW ORIGINAL: ${citation(link)}${supporting}\n${contextLines(card, context)}\n` +
    `AI ASSESSMENT (${safe(card.classification_method)}, not a quote): ${safe(card.assessment)}\n` +
    `DECIDE: ${label(card.id)} ACCEPT | ${label(card.id)} REJECT | ${label(card.id)} COMMENT <text>`;
}

export function renderVerdict(card, event, link, decision, context) {
  const mode = event.source_mode === 'simulated' ? '[SIMULATED FIXTURE] ' : '[LIVE] ';
  const quote = sourceText(event, 320);
  const sheet = card.category === 'REVENUE' && decision.sheetState
    ? `\nSHEET WRITE: ${safe(decision.sheetState)}` : '';
  return `${mode}${label(card.id)} · ${card.category} · ${decision.verdict}\n` +
    `ORIGINAL (verbatim${event.text.length > 320 ? ' excerpt' : ''}): “${safe(quote)}”\n` +
    `SOURCE: ${citation(link, 'Exact original message')}\n` +
    `FOUNDER COMMENT: ${decision.comment ? safe(decision.comment) : 'none'}${sheet}`;
}

export class FounderLoop {
  constructor({ store, transport, config, docLoader = loadProductDoc, sheetLoader = loadRevenueSheet,
    sheetWriter = upsertAcceptedLead, linkResolver = resolveMessageLink, classifier = classifyCandidate }) {
    Object.assign(this, { store, transport, config, docLoader, sheetLoader, sheetWriter, linkResolver, classifier });
  }

  async ingest(input) {
    let event = normalizeEvent(input, this.config);
    if (!validSource(event, this.config)) return { status: 'IGNORED' };
    const sourceId = event.platform_message_id || event.platform_message_ts || event.switch_message_id;
    const key = `${event.platform}:${event.switch_room_id}:${sourceId}`;
    const prior = this.store.getEvent(key);
    if (prior) event = JSON.parse(prior.source_json);
    const link = prior?.permalink || await this.linkResolver(event, this.config);
    if (!prior) this.store.addEvent(key, event, link);

    const categories = (await this.classifier(event.text, this.config)).filter(item =>
      item.confidence >= (this.config.minConfidence ?? 0.65) &&
      (!this.config.enabledCategories || this.config.enabledCategories.includes(item.category)));
    if (!categories.length) return { status: 'NO_SIGNAL' };

    const results = [];
    for (const classification of categories) {
      const groupKey = classification.category === 'REVENUE' ? leadGroupKey(event, classification)
        : `${key}:${classification.category}`;
      const existing = this.store.getCardByGroup(groupKey);
      if (existing) {
        if (link) this.store.addEvidence(existing.id, key, event.text, link, 'supporting');
        results.push({ status: prior ? 'DUPLICATE' : 'GROUPED', card: existing });
        continue;
      }
      if (!link) {
        const card = this.store.createCard(key, classification, { mode: 'unavailable' }, 'EVIDENCE_BLOCKED', groupKey);
        results.push({ status: 'EVIDENCE_BLOCKED', card });
        continue;
      }

      let context;
      if (classification.category === 'PRODUCT') {
        context = matchProductDoc(classification, await this.docLoader(this.config));
      } else if (classification.category === 'REVENUE') {
        context = matchRevenueSheet(event, classification, await this.sheetLoader(this.config));
        context.sourceRef = link;
      } else {
        context = { kind: classification.kind, mode: event.source_mode };
      }
      const card = this.store.createCard(key, classification, context, 'OPEN', groupKey);
      this.store.addEvidence(card.id, key, event.text, link, 'primary');
      this.store.addOutbox(`card:${card.id}`, card.id, 'FOUNDER_CARD', this.config.founderRoomId,
        renderFounderCard(card, event, context, link, this.store.getEvidence(card.id)));
      results.push({ status: 'OPEN', card });
    }
    await this.flush();
    const updated = results.map(item => ({ ...item, status: item.status === 'OPEN' ? this.store.getCard(item.card.id).state : item.status }));
    return updated.length === 1 ? updated[0] : { status: 'MULTIPLE', cards: updated };
  }

  async decide({ text, actorId, roomId, platformSenderId, sourceMode = 'live' }) {
    const actorAllowed = actorId === this.config.founderSenderId &&
      (!this.config.founderSlackUserId || platformSenderId === this.config.founderSlackUserId);
    if (!actorAllowed || roomId !== this.config.founderRoomId) {
      this.store.audit(null, 'UNAUTHORIZED_COMMAND', actorId || null, roomId || null);
      return { status: 'UNAUTHORIZED' };
    }
    if (sourceMode !== this.config.sourceMode) return { status: 'WRONG_MODE' };
    const match = /^FL-(\d+)\s+(ACCEPT|REJECT|COMMENT)(?:\s+([\s\S]+))?$/i.exec(text.trim());
    if (!match) return { status: 'INVALID_COMMAND' };
    const id = Number(match[1]);
    const verdict = match[2].toUpperCase();
    const comment = match[3]?.trim() || null;
    if (verdict === 'COMMENT' && !comment) return { status: 'COMMENT_REQUIRED' };
    if (verdict !== 'COMMENT' && comment) return { status: 'INVALID_COMMAND' };
    const card = this.store.getCard(id);
    if (!card || this.store.getOutbox(`card:${id}`)?.state !== 'SENT') return { status: 'CARD_NOT_DELIVERED' };
    if (this.store.decision(id)) return { status: 'ALREADY_DECIDED' };
    if (!this.store.addDecision(id, actorId, verdict, comment)) return { status: 'ALREADY_DECIDED' };
    this.store.setCardState(id, 'DECIDED');

    const context = JSON.parse(card.context_json);
    if (card.category === 'REVENUE' && verdict === 'ACCEPT') {
      if (context.mode === 'live' && this.config.enableSheetWrite) {
        this.store.setSheetState(id, 'PENDING');
        this.store.addOutbox(`sheet:${id}`, id, 'SHEET_WRITE', this.config.sheetId, '');
      } else {
        this.store.setSheetState(id, context.mode === 'simulated' ? 'SIMULATED' : 'UNAVAILABLE');
        this.queueVerdict(card);
      }
    } else {
      this.queueVerdict(card);
    }
    await this.flush();
    return { status: this.store.getCard(id).state, card: this.store.getCard(id) };
  }

  queueVerdict(card) {
    const eventRow = this.store.getEvent(card.source_key);
    const event = JSON.parse(eventRow.source_json);
    const decision = this.store.decision(card.id);
    const destination = ({ PRODUCT: this.config.productRoomId, REVENUE: this.config.salesRoomId,
      COMMITMENT: this.config.supportRoomId })[card.category];
    this.store.addOutbox(`verdict:${card.id}`, card.id, 'INTERNAL_VERDICT', destination,
      renderVerdict(card, event, eventRow.permalink,
        { ...decision, sheetState: decision.sheet_state }, JSON.parse(card.context_json)));
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      for (let round = 0; round < 2; round++) {
        const pending = this.store.pending();
        if (!pending.length) break;
        let queuedVerdict = false;
        for (const item of pending) {
          try {
            this.store.begin(item.key);
            if (item.kind === 'SHEET_WRITE') {
              const card = this.store.getCard(item.card_id);
              const event = JSON.parse(this.store.getEvent(card.source_key).source_json);
              const context = JSON.parse(card.context_json);
              await this.sheetWriter({ event, classification: { topic: card.title }, context, config: this.config });
              this.store.sent(item.key, context.leadId);
              this.store.setSheetState(card.id, 'SENT');
              this.queueVerdict(card);
              queuedVerdict = true;
              this.store.setCardState(card.id, 'DECIDED');
              continue;
            }
            if (!item.destination) throw new Error('Destination room is not configured');
            const ref = await this.transport.post(item.destination, item.body, item.key);
            this.store.sent(item.key, ref);
            if (item.kind === 'FOUNDER_CARD') {
              this.store.setFounderRef(item.card_id, ref);
              this.store.setCardState(item.card_id, 'CARD_DELIVERED');
            } else {
              this.store.setCardState(item.card_id, 'CLOSED');
            }
          } catch (error) {
            if (error instanceof AmbiguousDeliveryError) {
              this.store.uncertain(item.key, error.message);
              this.store.setCardState(item.card_id, item.kind === 'SHEET_WRITE' ? 'SHEET_WRITE_UNCERTAIN' : 'DELIVERY_UNCERTAIN');
              if (item.kind === 'SHEET_WRITE') this.store.setSheetState(item.card_id, 'UNCERTAIN', error.message);
            } else {
              this.store.failed(item.key, error.message);
              if (item.kind === 'SHEET_WRITE') {
                this.store.setSheetState(item.card_id, 'FAILED', error.message);
                this.store.setCardState(item.card_id, 'SHEET_WRITE_FAILED');
              } else {
                this.store.setCardState(item.card_id, 'DELIVERY_FAILED');
              }
            }
          }
        }
        if (!queuedVerdict) break;
      }
    } finally {
      this.flushing = false;
    }
  }
}
