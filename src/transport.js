export class FixtureTransport {
  constructor() { this.posts = []; }

  async post(destination, body, key) {
    const ref = `fixture-post-${this.posts.length + 1}`;
    this.posts.push({ destination, body, key, ref, source_mode: 'simulated' });
    return ref;
  }
}

export class AmbiguousDeliveryError extends Error {}

export class SwitchTransport {
  constructor(config, fetcher = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  async post(destination, body) {
    const { baseUrl, agentId, agentKey } = this.config;
    if (!baseUrl || !agentId || !agentKey) throw new Error('Switch agent configuration missing');
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
