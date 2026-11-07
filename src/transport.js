export class FixtureTransport {
  constructor() { this.posts = []; }

  async post(destination, body, key) {
    const ref = `fixture-post-${this.posts.length + 1}`;
    this.posts.push({ destination, body, key, ref, source_mode: 'simulated' });
    return ref;
  }
}

export class AmbiguousDeliveryError extends Error {}

export function closedFounderMessage(body) {
  return `${body.replace(/\nDECIDE: FL-\d+ ACCEPT \| FL-\d+ REJECT \| FL-\d+ COMMENT <text>\s*$/, '')}\n🎉 Decision made. Loop closed`;
}

export function founderBlocks(body, interactive = false) {
  const parts = body.split(/\n(?=SOURCE:|ORIGINAL MESSAGE|VIEW ORIGINAL:|PRODUCT KNOWLEDGE:|ROADMAP DECISION:|ROADMAP OWNER:|ROADMAP DEADLINE:|GOOGLE DOC:|DOCUMENT EXCERPT|LEAD SHEET:|REVENUE CONTEXT:|REVENUE ESCALATION:|GOOGLE SHEET:|COMMITMENT TYPE:|PROMISED DEADLINE|AI ASSESSMENT|DECIDE:|🎉 Decision made)/);
  const title = parts.shift() || 'Founder Loop decision';
  const header = title.replace(/^\[(?:LIVE|SIMULATED FIXTURE)\]\s*/, '').slice(0, 150);
  if (parts.some(part => part.length > 3000)) throw new Error('Founder card section exceeds Slack Block Kit limit');
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: header } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'Founder Loop · evidence-backed decision' }] },
    { type: 'divider' },
    ...parts.map(part => {
      const label = /^([^:\n]+):/.exec(part)?.[1];
      const text = label ? `*${label}:*${part.slice(label.length + 1)}` : part;
      return { type: 'section', text: { type: 'mrkdwn', text } };
    }),
  ];
  if (interactive) {
    const id = /\bFL-(\d+)\b/.exec(title)?.[1];
    if (!id) throw new Error('Founder card ID missing for interactive actions');
    blocks.push({ type: 'actions', elements: [
      { type: 'button', action_id: 'founder_accept', value: id,
        text: { type: 'plain_text', text: 'Accept' }, style: 'primary' },
      { type: 'button', action_id: 'founder_reject', value: id,
        text: { type: 'plain_text', text: 'Reject' }, style: 'danger' },
      { type: 'button', action_id: 'founder_comment', value: id,
        text: { type: 'plain_text', text: 'Comment' } },
    ] });
  }
  return blocks;
}

export class SwitchTransport {
  constructor(config, fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  async closeFounderMessage(ts, body) {
    const { slackFounderBotToken, slackFounderChannelId } = this.config;
    const text = closedFounderMessage(body);
    const response = await this.fetcher('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: { authorization: `Bearer ${slackFounderBotToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ channel: slackFounderChannelId, ts, text, blocks: founderBlocks(text),
        unfurl_links: false, unfurl_media: false }),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(`Slack founder card update failed: ${result.error || response.status}`);
  }

  async post(destination, body, key) {
    const { baseUrl, agentId, agentKey } = this.config;
    if (!baseUrl || !agentId || !agentKey) throw new Error('Switch agent configuration missing');
    if (key?.startsWith('card:') && destination === this.config.founderRoomId &&
        (this.config.slackFounderBotToken || this.config.slackBotToken) && this.config.slackFounderChannelId) {
      let response;
      const interactive = Boolean(this.config.slackFounderAppToken && this.config.slackFounderBotToken);
      try {
        response = await this.fetcher('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: { authorization: `Bearer ${this.config.slackFounderBotToken || this.config.slackBotToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ channel: this.config.slackFounderChannelId, text: body,
            blocks: founderBlocks(body, interactive), unfurl_links: false, unfurl_media: false }),
          signal: AbortSignal.timeout(12000),
        });
      } catch (error) {
        throw new AmbiguousDeliveryError(`Slack card post result unknown: ${error.message}`);
      }
      if (response.status >= 500) throw new AmbiguousDeliveryError(`Slack card post HTTP ${response.status}`);
      if (!response.ok) throw new Error(`Slack card post HTTP ${response.status}`);
      let result;
      try { result = await response.json(); }
      catch { throw new AmbiguousDeliveryError('Slack card post response could not be read'); }
      if (!result.ok || !result.ts) throw new Error(`Slack card post rejected: ${result.error || 'no message timestamp'}`);
      return result.ts;
    }
    let response;
    try {
      response = await this.fetcher(`${baseUrl.replace(/\/$/, '')}/agents/${encodeURIComponent(agentId)}/message`, {
        method: 'POST',
        headers: { authorization: `Bearer ${agentKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ room_id: destination, content: body }),
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      throw new AmbiguousDeliveryError(`Switch post result unknown: ${error.message}`);
    }
    if (!response.ok) {
      const message = `Switch post HTTP ${response.status}`;
      if (response.status >= 500) throw new AmbiguousDeliveryError(message);
      throw new Error(message);
    }
    let result = {};
    try { result = await response.json(); } catch { /* HTTP success is the best available acknowledgement. */ }
    return result.message_id || result.event_id || `accepted-http-${response.status}`;
  }
}
