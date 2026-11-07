import { resolveMattermostLink } from './mattermost-evidence.js';
import { resolveTelegramDbLink, resolveTelegramLink } from './telegram-evidence.js';

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
  return Boolean(event && ['discord', 'slack', 'mattermost', 'telegram'].includes(event.platform) &&
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
  if (event.platform === 'mattermost' && event.source_mode !== 'simulated') {
    return resolveMattermostLink(event, config, fetcher);
  }
  if (event.platform === 'telegram' && event.source_mode !== 'simulated') {
    if (config.telegramDbPassword) return resolveTelegramDbLink(event, config);
    return resolveTelegramLink(event, config, fetcher);
  }
  if (event.platform === 'discord' || event.source_mode === 'simulated') {
    const direct = exactMessageLink(event);
    if (direct || event.source_mode === 'simulated' || event.platform !== 'discord') return direct;
    if (!config.discordBotToken || !discordId.test(config.discordGuildId || '') ||
        !discordId.test(config.discordSourceChannelId || '') ||
        event.switch_room_id !== config.sourceRoomId) return null;
    try {
      const headers = { authorization: `Bot ${config.discordBotToken}` };
      const channelResponse = await fetcher(`https://discord.com/api/v10/channels/${config.discordSourceChannelId}`, {
        headers, signal: AbortSignal.timeout(12000),
      });
      if (!channelResponse.ok) return null;
      const channel = await channelResponse.json();
      if (channel.id !== config.discordSourceChannelId || channel.guild_id !== config.discordGuildId) return null;
      const messagesResponse = await fetcher(`https://discord.com/api/v10/channels/${config.discordSourceChannelId}/messages?limit=50`, {
        headers, signal: AbortSignal.timeout(12000),
      });
      if (!messagesResponse.ok) return null;
      const messages = await messagesResponse.json();
      if (!Array.isArray(messages)) return null;
      const originTime = Date.parse(event.timestamp);
      const matches = messages.filter(message =>
        discordId.test(message.id || '') && discordId.test(message.author?.id || '') &&
        message.channel_id === config.discordSourceChannelId &&
        message.content === event.text && message.author?.bot !== true &&
        (message.author?.username === event.sender_name || message.author?.global_name === event.sender_name) &&
        Number.isFinite(originTime) && Math.abs(Date.parse(message.timestamp) - originTime) <= 10000);
      if (matches.length !== 1) return null;
      event.platform_guild_id = config.discordGuildId;
      event.platform_channel_id = config.discordSourceChannelId;
      event.platform_message_id = matches[0].id;
      event.platform_sender_id = matches[0].author.id;
      return exactMessageLink(event);
    } catch {
      return null;
    }
  }
  if (event.platform !== 'slack') return null;
  let channel = event.platform_channel_id;
  let ts = event.platform_message_ts || event.platform_message_id;
  const configuredChannel = config.slackSourceChannels?.[event.switch_room_id];
  if (configuredChannel && slackChannelId.test(channel || '') && configuredChannel !== channel) return null;
  if ((!slackChannelId.test(channel || '') || !slackTimestamp.test(ts || '')) &&
      slackChannelId.test(configuredChannel || '') && config.slackBotToken) {
    try {
      const historyUrl = new URL('https://slack.com/api/conversations.history');
      historyUrl.searchParams.set('channel', configuredChannel);
      historyUrl.searchParams.set('limit', '100');
      const historyResponse = await fetcher(historyUrl, {
        headers: { authorization: `Bearer ${config.slackBotToken}` }, signal: AbortSignal.timeout(12000),
      });
      if (!historyResponse.ok) return null;
      const history = await historyResponse.json();
      if (!history.ok || !Array.isArray(history.messages)) return null;
      const originTime = Date.parse(event.timestamp);
      const matches = history.messages.filter(message =>
        slackTimestamp.test(message.ts || '') && typeof message.user === 'string' &&
        !message.bot_id && !message.subtype && message.text === event.text &&
        (!event.platform_sender_id || event.platform_sender_id === message.user) &&
        Number.isFinite(originTime) && Math.abs(Number(message.ts) * 1000 - originTime) <= 30000);
      if (matches.length !== 1) return null;
      channel = configuredChannel;
      ts = matches[0].ts;
      event.platform_channel_id = channel;
      event.platform_message_ts = ts;
      event.platform_sender_id = matches[0].user;
    } catch { return null; }
  }
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
    if (permalink.protocol !== 'https:' ||
        !(permalink.hostname === 'slack.com' || permalink.hostname.endsWith('.slack.com'))) return null;
    return permalink.href;
  } catch {
    return null;
  }
}
