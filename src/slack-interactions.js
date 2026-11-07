import WebSocket from 'ws';

const cardNumber = value => /^\d+$/.test(String(value || '')) ? Number(value) : null;


export function authorizedAction(payload, config, store) {
  if (payload?.user?.id !== config.founderSlackUserId ||
      (config.slackWorkspaceId && payload?.team?.id !== config.slackWorkspaceId)) return null;
  let id;
  let messageTs;
  if (payload.type === 'block_actions') {
    if (payload.channel?.id !== config.slackFounderChannelId || payload.actions?.length !== 1) return null;
    id = cardNumber(payload.actions[0].value);
    messageTs = payload.message?.ts;
  } else if (payload.type === 'view_submission' && payload.view?.callback_id === 'founder_comment_submit') {
    try {
      const meta = JSON.parse(payload.view.private_metadata || '{}');
      id = cardNumber(meta.cardId);
      messageTs = meta.messageTs;
    } catch { return null; }
  } else return null;
  const card = id && store.getCard(id);
  if (!card || card.founder_message_ref !== messageTs || !messageTs) return null;
  return { card, id };
}

export async function handleSlackInteraction(payload, { config, store, loop, fetcher = fetch, log = console }) {
  const verified = authorizedAction(payload, config, store);
  if (!verified) { log.warn('Ignored unauthorized or unmatched Slack interaction'); return 'UNAUTHORIZED'; }
  const { id } = verified;
  if (payload.type === 'block_actions') {
    const action = payload.actions[0].action_id;
    if (action === 'founder_comment') {
      const response = await fetcher('https://slack.com/api/views.open', {
        method: 'POST',
        headers: { authorization: `Bearer ${config.slackFounderBotToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ trigger_id: payload.trigger_id, view: {
          type: 'modal', callback_id: 'founder_comment_submit',
          private_metadata: JSON.stringify({ cardId: id, messageTs: payload.message.ts }),
          title: { type: 'plain_text', text: 'Add a comment' },
          submit: { type: 'plain_text', text: 'Send comment' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [{ type: 'input', block_id: 'comment',
            label: { type: 'plain_text', text: 'Founder comment' },
            element: { type: 'plain_text_input', action_id: 'text', multiline: true } }],
        } }),
        signal: AbortSignal.timeout(2500),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(`Slack comment modal failed: ${result.error || response.status}`);
      log.info(`Slack comment modal opened for FL-${String(id).padStart(3, '0')}`);
      return 'MODAL_OPENED';
    }
    if (!['founder_accept', 'founder_reject'].includes(action)) return 'INVALID_ACTION';
    const verdict = action === 'founder_accept' ? 'ACCEPT' : 'REJECT';
    const result = await loop.decide({ text: `FL-${String(id).padStart(3, '0')} ${verdict}`,
      actorId: config.founderSenderId, platformSenderId: payload.user.id,
      roomId: config.founderRoomId, sourceMode: 'live' });
    log.info(`Slack button decision: ${result.status}`);
    return result.status;
  }
  const comment = payload.view.state?.values?.comment?.text?.value?.trim();
  if (!comment) return 'COMMENT_REQUIRED';
  const result = await loop.decide({ text: `FL-${String(id).padStart(3, '0')} COMMENT ${comment}`,
    actorId: config.founderSenderId, platformSenderId: payload.user.id,
    roomId: config.founderRoomId, sourceMode: 'live' });
  log.info(`Slack modal decision: ${result.status}`);
  return result.status;
}

export class SlackInteractionConnection {
  constructor({ config, store, loop, fetcher = fetch, log = console, WebSocketClass = WebSocket }) {
    Object.assign(this, { config, store, loop, fetcher, log, WebSocketClass });
    this.running = false;
  }

  async connectOnce() {
    const response = await this.fetcher('https://slack.com/api/apps.connections.open', {
      method: 'POST', headers: { authorization: `Bearer ${this.config.slackFounderAppToken}` },
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(`Slack Socket Mode open failed: ${result.error || response.status}`);
    const url = new URL(result.url);
    if (url.protocol !== 'wss:' || !url.hostname.endsWith('.slack.com')) throw new Error('Unexpected Slack Socket Mode host');
    await new Promise((resolve, reject) => {
      const socket = new this.WebSocketClass(url.href);
      this.socket = socket;
      let opened = false;
      socket.on('open', () => { opened = true; this.log.info('Founder Slack actions connected'); });
      socket.on('error', error => { if (!opened) reject(error); else this.log.error(`Founder Slack socket: ${error.message}`); });
      socket.on('message', raw => {
        let envelope;
        try { envelope = JSON.parse(raw.toString()); } catch { return; }
        if (envelope.type === 'disconnect') { socket.close(); return; }
        if (!envelope.envelope_id) return;
        const payload = envelope.payload || {};
        const emptyComment = payload.type === 'view_submission' &&
          payload.view?.callback_id === 'founder_comment_submit' &&
          !payload.view.state?.values?.comment?.text?.value?.trim();
        socket.send(JSON.stringify({ envelope_id: envelope.envelope_id,
          ...(emptyComment ? { payload: { response_action: 'errors', errors: { comment: 'Enter a comment' } } } : {}) }));
        if (!emptyComment) handleSlackInteraction(payload, this)
          .catch(error => this.log.error(`Founder Slack action failed: ${error.message}`));
      });
      socket.on('close', () => resolve());
    });
  }

  async run() {
    this.running = true;
    while (this.running) {
      try { await this.connectOnce(); }
      catch (error) { this.log.error(error.message); }
      if (this.running) await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  stop() { this.running = false; this.socket?.close(); }
}
