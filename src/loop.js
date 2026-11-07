import { createHash } from 'node:crypto';
import { normalizeEvent, resolveMessageLink, validSource } from './evidence.js';
import { classifySignals, commitmentDecisionContext } from './classify.js';
import { classifyCandidate } from './model-classifier.js';
import { loadProductDoc, productDecisionContext } from './product.js';
import { classifyRevenue, leadGroupKey, loadRevenueSheet, matchRevenueSheet, revenueNeedsDecision, upsertAcceptedLead, urgentRevenueSignal } from './revenue.js';
import { AmbiguousDeliveryError } from './transport.js';
import { renderFounderCard, renderVerdict } from './messages.js';
import { reviewUrgentRevenue } from './claude-review.js';

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
    const roomCategories = this.config.sourceCategories?.[event.switch_room_id];
    const revenueSource = this.config.revenueSources?.[event.switch_room_id];
    const enabled = category => (!roomCategories || roomCategories.includes(category)) &&
      (!this.config.enabledCategories || this.config.enabledCategories.includes(category));
    const signals = roomCategories?.length === 1 && roomCategories[0] === 'REVENUE'
      ? classifySignals(event.text) : await this.classifier(event.text, {
        ...this.config, incidentIntake: enabled('COMMITMENT'), generalIntake: enabled('GENERAL'),
      });
    if (revenueSource) {
      const signal = classifyRevenue(event.text);
      const index = signals.findIndex(item => item.category === 'REVENUE');
      if (index >= 0 && (signal || signals[index].method !== 'model')) signals.splice(index, 1);
      if (signal) signals.push(signal);
    }
    const categories = signals.filter(item =>
      ((item.category === 'COMMITMENT' && item.kind === 'active_incident') ||
        (item.category === 'GENERAL' && item.kind === 'founder_request') || item.confidence >= (this.config.minConfidence ?? 0.65)) &&
      enabled(item.category));
    if (!categories.length) return { status: 'NO_SIGNAL' };

    const results = [];
    const ordered = [...categories.filter(item => item.category !== 'GENERAL'), ...categories.filter(item => item.category === 'GENERAL')];
    const day = event.timestamp.slice(0, 10);
    const fingerprint = () => createHash('sha256').update(event.text.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
    for (const classification of ordered) {
      if (classification.category === 'GENERAL' && results.some(item => item.card)) continue;
      const legacyGroup = classification.category === 'REVENUE' && !revenueSource ? leadGroupKey(event, classification)
        : `${key}:${classification.category}`;
      let groupKey = legacyGroup;
      let existing = this.store.getCardBySource(key, classification.category) || this.store.getCardByGroup(legacyGroup);
      let context;
      if (!existing && link) {
        if (classification.category === 'PRODUCT') {
          context = productDecisionContext(event.text, await this.docLoader(this.config), classification);
          if (context) groupKey = context.id ? `PRODUCT:${context.id}:${context.revision}` : `PRODUCT:unreviewed:${day}:${fingerprint()}`;
        } else if (classification.category === 'REVENUE') {
          context = matchRevenueSheet(event, classification, await this.sheetLoader(this.config), revenueSource);
          context.sourceRef = link;
          context.urgent = urgentRevenueSignal(event.text, classification, revenueSource);
          if (context.matchedLeadId) {
            groupKey = `REVENUE:lead:${context.matchedLeadId}${context.pipeline ? `:${context.revision}` : ''}`;
          } else if (context.urgent) {
            groupKey = `REVENUE:urgent:${day}:${fingerprint()}`;
          } else if (revenueSource === 'sales' || revenueSource === 'csm') {
            groupKey = `REVENUE:intake:${event.switch_room_id}:${day}:${fingerprint()}`;
          } else {
            groupKey = `REVENUE:sender:${event.platform}:${event.platform_sender_id || event.sender_id}`;
          }
        } else if (classification.category === 'COMMITMENT') {
          context = commitmentDecisionContext(event, this.config, classification);
          if (context) groupKey = `COMMITMENT:${event.switch_room_id}:${event.sender_id}:${day}:${fingerprint()}`;
        } else {
          context = { question: 'Should the founder follow up on this request?' };
          groupKey = `GENERAL:${event.platform}:${event.platform_sender_id || event.sender_id}:${day}:${fingerprint()}`;
        }
        existing = this.store.getCardByGroup(groupKey);
        if (!existing && (!context || (classification.category === 'REVENUE' && !revenueNeedsDecision(event.text, context, classification, revenueSource)))) {
          results.push({ status: 'NO_FOUNDER_DECISION', category: classification.category });
          continue;
        }
      }
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

      if (classification.category === 'REVENUE' && context.urgent && event.source_mode === 'live' && this.config.claudeRevenueReview) {
        const question = await reviewUrgentRevenue(event, context, this.config.claudeCodeExecutable).catch(() => null);
        if (question) context.claudeReviewQuestion = question;
      }

      const reviewed = classification.category === 'COMMITMENT' ? {
        ...classification, kind: context.kind,
        topic: context.incident ? 'reported incident' : context.kind === 'explicit_company_promise' ? 'company promise' : 'customer impact',
        assessment: context.incident ? classification.assessment : context.kind === 'explicit_company_promise' ? 'A trusted sender explicitly promised action in the source message.'
          : 'The source reports a customer impact that needs review.',
      } : classification;
      const card = this.store.transaction(() => {
        const created = this.store.createCard(key, reviewed, context, 'OPEN', groupKey);
        this.store.addEvidence(created.id, key, event.text, link, 'primary');
        this.store.addOutbox(`card:${created.id}`, created.id, 'FOUNDER_CARD', this.config.founderRoomId,
          renderFounderCard(created, event, context, link, this.store.getEvidence(created.id)));
        return created;
      });
      results.push({ status: 'OPEN', card });
    }
    await this.flush();
    const updated = results.map(item => ({ ...item, status: item.status === 'OPEN' ? this.store.getCard(item.card.id).state : item.status }));
    return updated.length === 1 ? updated[0] : { status: 'MULTIPLE', cards: updated };
  }

  async decide({ text, actorId, roomId, platformSenderId, sourceMode = 'live' }) {
    const actorAllowed = actorId === this.config.founderSenderId &&
      (!this.config.founderSlackUserId || !platformSenderId || platformSenderId === this.config.founderSlackUserId);
    if (!actorAllowed || roomId !== this.config.founderRoomId) {
      this.store.audit(null, 'UNAUTHORIZED_COMMAND', actorId || null, roomId || null);
      return { status: 'UNAUTHORIZED' };
    }
    if (sourceMode !== this.config.sourceMode) return { status: 'WRONG_MODE' };
    const trimmed = text.trim();
    const commandText = /^`{1,3}([\s\S]*?)`{1,3}$/.exec(trimmed)?.[1].trim() || trimmed;
    const match = /^FL-(\d+)\s+(ACCEPT|REJECT|COMMENT)(?:\s+([\s\S]+))?$/i.exec(commandText);
    if (!match) return { status: 'INVALID_COMMAND' };
    const id = Number(match[1]);
    const verdict = match[2].toUpperCase();
    const comment = match[3]?.trim() || null;
    if (verdict === 'COMMENT' && !comment) return { status: 'COMMENT_REQUIRED' };
    if (verdict !== 'COMMENT' && comment) return { status: 'INVALID_COMMAND' };
    const card = this.store.getCard(id);
    if (!card || this.store.getOutbox(`card:${id}`)?.state !== 'SENT') return { status: 'CARD_NOT_DELIVERED' };
    const recorded = this.store.transaction(() => {
      if (!this.store.addDecision(id, actorId, verdict, comment)) return false;
      this.queueDecision(card, verdict);
      return true;
    });
    if (!recorded) return { status: 'ALREADY_DECIDED' };
    await this.flush();
    return { status: this.store.getCard(id).state, card: this.store.getCard(id) };
  }

  queueDecision(card, verdict) {
    const id = card.id;
    this.store.setCardState(id, 'DECIDED');
    const context = JSON.parse(card.context_json);
    if (card.category === 'REVENUE' && verdict === 'ACCEPT') {
      if (context.mode === 'live' && !context.pipeline && !context.urgent &&
          !this.config.revenueCredentialsPath && this.config.enableSheetWrite) {
        this.store.setSheetState(id, 'PENDING');
        this.store.addOutbox(`sheet:${id}`, id, 'SHEET_WRITE', this.config.sheetId, '');
      } else {
        this.store.setSheetState(id, context.pipeline ? 'READ_ONLY' : context.mode === 'simulated' ? 'SIMULATED' : 'UNAVAILABLE');
        this.queueVerdict(card);
      }
    } else {
      this.queueVerdict(card);
    }
  }

  recoverDecisions() {
    this.store.transaction(() => {
      for (const card of this.store.decisionsWithoutHandoff()) {
        const decision = this.store.decision(card.id);
        const sheet = this.store.getOutbox(`sheet:${card.id}`);
        if (sheet?.state === 'SENT') this.store.setSheetState(card.id, 'SENT');
        if (sheet || decision.sheet_state) {
          this.store.setCardState(card.id, 'DECIDED');
          this.queueVerdict(card);
        } else {
          this.queueDecision(card, decision.verdict);
        }
      }
    });
  }

  queueVerdict(card) {
    const eventRow = this.store.getEvent(card.source_key);
    const event = JSON.parse(eventRow.source_json);
    const decision = this.store.decision(card.id);
    const destination = ({ PRODUCT: this.config.productRoomId, REVENUE: this.config.salesRoomId,
      COMMITMENT: this.config.supportRoomId, GENERAL: this.config.founderRoomId })[card.category];
    this.store.addOutbox(`verdict:${card.id}`, card.id, 'INTERNAL_VERDICT', destination,
      renderVerdict(card, event, eventRow.permalink,
        { ...decision, sheetState: decision.sheet_state }, JSON.parse(card.context_json)));
  }

  acknowledge(item, ref) {
    const id = item.card_id;
    this.store.sent(item.key, ref);
    if (item.kind === 'FOUNDER_CARD') {
      this.store.setFounderRef(id, ref);
      this.store.setCardState(id, 'CARD_DELIVERED');
    } else if (item.kind === 'SHEET_WRITE') {
      this.store.setSheetState(id, 'SENT');
      this.queueVerdict(this.store.getCard(id));
      this.store.setCardState(id, 'DECIDED');
    } else if (item.kind === 'INTERNAL_VERDICT') {
      this.store.setCardState(id, 'CLOSED');
      const card = this.store.getCard(id);
      const { founder_message_ref: ts } = card;
      if (this.config.slackFounderBotToken && this.config.slackFounderChannelId && /^\d+\.\d+$/.test(ts)) {
        const source = this.store.getEvent(card.source_key);
        const body = renderFounderCard(card, JSON.parse(source.source_json), JSON.parse(card.context_json),
          source.permalink, this.store.getEvidence(id));
        this.store.addOutbox(`close:${id}`, id, 'CLOSE_CARD', ts, body);
      }
    }
  }

  reconcileDelivery(key, resolution, ref) {
    this.store.transaction(() => {
      const item = this.store.getOutbox(key);
      if (item?.state !== 'UNCERTAIN') throw new Error('Only uncertain deliveries can be reconciled');
      if (resolution === 'delivered' && ref) {
        if (item.kind === 'FOUNDER_CARD' && this.config.slackFounderBotToken && !/^\d+\.\d+$/.test(ref)) {
          throw new Error('Use the original Slack message timestamp as the founder card reference');
        }
        this.acknowledge(item, ref);
      } else if (resolution === 'retry' && !ref) {
        this.store.retryUncertain(key);
      } else {
        throw new Error('Use delivered with a verified reference, or retry after verifying absence');
      }
      this.store.audit(item.card_id, 'OUTBOX_RECONCILED', null, `${key}: ${resolution}`);
    });
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const attempted = new Set();
      for (let round = 0; round < 3; round++) {
        const pending = this.store.pending().filter(item => !attempted.has(item.key));
        if (!pending.length) break;
        for (const item of pending) {
          attempted.add(item.key);
          try {
            this.store.begin(item.key);
            let ref;
            if (item.kind === 'SHEET_WRITE') {
              const card = this.store.getCard(item.card_id);
              const event = JSON.parse(this.store.getEvent(card.source_key).source_json);
              const context = JSON.parse(card.context_json);
              await this.sheetWriter({ event, classification: { topic: card.title }, context, config: this.config });
              ref = context.leadId;
            } else if (item.kind === 'CLOSE_CARD') {
              await this.transport.closeFounderMessage(item.destination, item.body);
              ref = item.destination;
            } else {
              if (!item.destination) throw new Error('Destination room is not configured');
              ref = await this.transport.post(item.destination, item.body, item.key);
            }
            try {
              this.store.transaction(() => this.acknowledge(item, ref));
            } catch (error) {
              throw new AmbiguousDeliveryError(`Delivery succeeded but SQLite acknowledgement failed: ${error.message}`);
            }
          } catch (error) {
            if (item.kind === 'CLOSE_CARD') {
              this.store.failed(item.key, error.message);
            } else if (error instanceof AmbiguousDeliveryError) {
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
      }
    } finally {
      this.flushing = false;
    }
  }
}
