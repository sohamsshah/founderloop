const discordId = /^\d{15,22}$/;
const slackChannelId = /^[A-Z0-9]{8,}$/;
const slackTimestamp = /^\d{10,}\.\d+$/;

export function escapeSlack(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function sourceText(event, limit = 1200) {
  return event.text.length > limit ? event.text.slice(0, limit) : event.text;
}

export function normalizeEvent(input, config = {}) {
  if (input?.event !== 'message' || input.data?.type !== 'message') return input;

  const { data } = input;
  const payload = data.payload || {};
  const platform = config.sourcePlatforms?.[data.room_id] || config.sourcePlatform || 'discord';
  return {
    source_mode: 'live',
    platform,
    switch_room_id: data.room_id,
    switch_message_id: payload.message_id || null,
    platform_guild_id: payload.platform_guild_id || null,
    platform_workspace_id: payload.platform_workspace_id || null,
    platform_channel_id: payload.platform_channel_id || null,
    platform_message_id: payload.platform_message_id || null,
    platform_message_ts: payload.platform_message_ts || null,
    channel_name: payload.channel_name || data.room_id,
    sender_id: payload.sender || null,
    sender_name: payload.sender_name || payload.sender || 'unknown',
    platform_sender_id: payload.platform_sender_id || null,
    timestamp: Number.isFinite(payload.timestamp)
      ? new Date(payload.timestamp).toISOString()
      : typeof payload.timestamp === 'string' ? payload.timestamp : null,
    text: payload.body,
    addressed: payload.addressed,
    is_bot: payload.is_bot === true,
  };
}

export function validSource(event, config) {
  const rooms = config.sourceRoomIds || [config.sourceRoomId].filter(Boolean);
  return Boolean(event && ['discord', 'slack'].includes(event.platform) &&
    rooms.includes(event.switch_room_id) &&
    typeof event.text === 'string' && event.text.length > 0 && event.text.length <= 10000 &&
    typeof event.sender_id === 'string' && event.sender_id.length > 0 &&
    typeof event.timestamp === 'string' && !Number.isNaN(Date.parse(event.timestamp)) &&
    !event.is_bot && event.sender_id !== config.agentSenderId &&
    (event.platform_message_id || event.platform_message_ts || event.switch_message_id));
}

export function exactMessageLink(event) {
  if (event.source_mode === 'simulated') {
    const ids = [event.platform_guild_id, event.platform_channel_id, event.platform_message_id];
    return ids.every(Boolean) ? `fixture://discord/${ids.map(encodeURIComponent).join('/')}` : null;
  }
  if (event.platform !== 'discord') return null;
  const ids = [event.platform_guild_id, event.platform_channel_id, event.platform_message_id];
  return ids.every(id => typeof id === 'string' && discordId.test(id))
    ? `https://discord.com/channels/${ids.join('/')}` : null;
}

export async function resolveMessageLink(event, config = {}, fetcher = fetch) {
  if (event.platform === 'discord' || event.source_mode === 'simulated') return exactMessageLink(event);
  if (event.platform !== 'slack') return null;
  const channel = event.platform_channel_id;
  const ts = event.platform_message_ts || event.platform_message_id;
  if (!slackChannelId.test(channel || '') || !slackTimestamp.test(ts || '') || !config.slackBotToken) return null;

  try {
    const url = new URL('https://slack.com/api/chat.getPermalink');
    url.searchParams.set('channel', channel);
    url.searchParams.set('message_ts', ts);
    const response = await fetcher(url, {
      headers: { authorization: `Bearer ${config.slackBotToken}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (!result.ok || typeof result.permalink !== 'string') return null;
    const permalink = new URL(result.permalink);
    if (permalink.protocol !== 'https:' || !['slack.com', 'app.slack.com'].includes(permalink.hostname)) return null;
    return permalink.href;
  } catch {
    return null;
  }
}
