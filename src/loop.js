import { createHash } from 'node:crypto';
import { escapeSlack, normalizeEvent, resolveMessageLink, sourceText, validSource } from './evidence.js';
import { classifySignals, commitmentDecisionContext } from './classify.js';
import { classifyCandidate } from './model-classifier.js';
import { loadProductDoc, productDecisionContext } from './product.js';
import { classifyRevenue, leadGroupKey, loadRevenueSheet, matchRevenueSheet, revenueNeedsDecision, upsertAcceptedLead, urgentRevenueSignal } from './revenue.js';
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
      (context.question ? `\nROADMAP DECISION: ${safe(context.question)}\nROADMAP OWNER: ${safe(context.owner)}\nROADMAP DEADLINE: ${safe(context.deadline)}` : '') +
      (context.url ? `\nGOOGLE DOC: <${context.url}|Open document>` : '\nGOOGLE DOC: no live document link (simulated snapshot)') +
      (context.excerpt ? `\nDOCUMENT EXCERPT (verbatim):\n“${safe(context.excerpt)}”` : '');
  }
  if (card.category === 'REVENUE') {
    const match = context.matchedLeadId ? `; matched lead ${safe(context.matchedLeadId)} in row ${context.matchedRow}` : '';
    const status = context.urgent && !context.matchedLeadId ? 'no verified account match' : context.status;
    return `LEAD SHEET: ${safe(status)} (${safe(context.mode)}${match})` +
      (context.urgent ? '\nREVENUE ESCALATION: Urgent commercial signal reported in the source message.' : '') +
      (context.pipeline && context.status === 'existing' ? '\nREVENUE CONTEXT: ' + [
        ['Account', context.company], ['Stage', context.stage], ['Owner', context.owner],
        ['Opportunity value', context.opportunityValue && [context.currency, context.opportunityValue].filter(Boolean).join(' ')],
        ['Current MRR', context.currentMrr && [context.currency, context.currentMrr].filter(Boolean).join(' ')],
        ['Renewal', context.renewalDate], ['Next step', context.nextStep], ['Decision', context.question],
      ].filter(([, value]) => value).map(([label, value]) => `${label}: ${safe(value.slice(0, 240))}`).join(' · ') : '') +
      (context.url ? `\nGOOGLE SHEET: <${context.url}|Open Leads sheet>` : '\nGOOGLE SHEET: no live Sheet link');
  }
  return `COMMITMENT TYPE: ${safe(context.kind)}` +
    (context.deadline ? `\nPROMISED DEADLINE (verbatim): “${safe(context.deadline)}”` : '');
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
    `FOUNDER COMMENT: ${decision.comment ? safe(decision.comment) : 'none'}${sheet}` +
    (card.category === 'REVENUE' && context.pipeline ? `\n${contextLines(card, context)}` : '');
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
    const roomCategories = this.config.sourceCategories?.[event.switch_room_id];
    const revenueSource = this.config.revenueSources?.[event.switch_room_id];
    const signals = roomCategories?.length === 1 && ['COMMITMENT', 'REVENUE'].includes(roomCategories[0])
      ? classifySignals(event.text) : await this.classifier(event.text, this.config);
    if (revenueSource) {
      const signal = classifyRevenue(event.text);
      const index = signals.findIndex(item => item.category === 'REVENUE');
      if (index >= 0) signals.splice(index, 1);
      if (signal) signals.push(signal);
    }
    const categories = signals.filter(item =>
      item.confidence >= (this.config.minConfidence ?? 0.65) &&
      (!this.config.enabledCategories || this.config.enabledCategories.includes(item.category)) &&
      (!roomCategories || roomCategories.includes(item.category)));
    if (!categories.length) return { status: 'NO_SIGNAL' };

    const results = [];
    for (const classification of categories) {
      const legacyGroup = classification.category === 'REVENUE' && !revenueSource ? leadGroupKey(event, classification)
        : `${key}:${classification.category}`;
      let groupKey = legacyGroup;
      let existing = this.store.getCardBySource(key, classification.category) || this.store.getCardByGroup(legacyGroup);
      let context;
      if (!existing && link) {
        if (classification.category === 'PRODUCT') {
          context = productDecisionContext(event.text, await this.docLoader(this.config));
          if (context) groupKey = `PRODUCT:${context.id}:${context.revision}`;
        } else if (classification.category === 'REVENUE') {
          context = matchRevenueSheet(event, classification, await this.sheetLoader(this.config), revenueSource);
          context.sourceRef = link;
          context.urgent = urgentRevenueSignal(event.text, classification, revenueSource);
          if (context.matchedLeadId) {
            groupKey = `REVENUE:lead:${context.matchedLeadId}${context.pipeline ? `:${context.revision}` : ''}`;
          } else if (context.urgent) {
            const fingerprint = createHash('sha256').update(event.text.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex');
            groupKey = `REVENUE:urgent:${event.timestamp.slice(0, 10)}:${fingerprint}`;
          } else {
            groupKey = `REVENUE:sender:${event.platform}:${event.platform_sender_id || event.sender_id}`;
          }
        } else {
          context = commitmentDecisionContext(event, this.config);
          if (context) {
            const normalized = event.text.trim().toLowerCase().replace(/\s+/g, ' ');
            const fingerprint = createHash('sha256').update(normalized).digest('hex');
            groupKey = `COMMITMENT:${event.switch_room_id}:${event.sender_id}:${event.timestamp.slice(0, 10)}:${fingerprint}`;
          }
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

      const reviewed = classification.category === 'COMMITMENT' ? {
        ...classification, kind: context.kind,
        topic: context.deadline ? 'time-bound promise' : 'customer impact',
        assessment: context.deadline ? 'A configured staff sender explicitly promised action by the quoted deadline.'
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
      COMMITMENT: this.config.supportRoomId })[card.category];
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
      const { founder_message_ref: ts } = this.store.getCard(id);
      if (this.config.slackFounderBotToken && this.config.slackFounderChannelId && /^\d+\.\d+$/.test(ts)) {
        this.store.addOutbox(`close:${id}`, id, 'CLOSE_CARD', ts, this.store.getOutbox(`card:${id}`).body);
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
