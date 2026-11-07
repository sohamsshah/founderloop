export const telegramChatId = /^-100\d{5,20}$/;
const messageId = /^[1-9]\d*$/;
const username = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

export async function resolveTelegramDbLink(event, config) {
  const chatId = config.telegramSourceChats?.[event.switch_room_id];
  if (!telegramChatId.test(chatId || '') || !config.telegramDbPassword ||
      !config.telegramDbTenantId || !event.switch_message_id ||
      (event.platform_channel_id && String(event.platform_channel_id) !== chatId)) return null;
  const { Client } = await import('pg');
  const client = new (config.telegramDbClientClass || Client)({
    host: config.telegramDbHost || 'postgres', port: config.telegramDbPort || 5432,
    database: config.telegramDbName, user: config.telegramDbUser,
    password: config.telegramDbPassword, connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [config.telegramDbTenantId]);
    const result = await client.query(
      'SELECT external_post_id FROM bridge_message_map WHERE transport_event_id=$1 AND external_channel_id=$2',
      [event.switch_message_id, chatId],
    );
    await client.query('COMMIT');
    if (result.rows.length !== 1) return null;
    const raw = String(result.rows[0].external_post_id);
    const nativeId = raw.startsWith(`${chatId}:`) ? raw.slice(chatId.length + 1) : raw;
    if (!messageId.test(nativeId)) return null;
    if (event.platform_message_id && String(event.platform_message_id) !== nativeId) return null;
    event.platform_channel_id = chatId;
    event.platform_message_id = nativeId;
    const publicName = config.telegramSourceUsernames?.[event.switch_room_id];
    return username.test(publicName || '')
      ? `https://t.me/${publicName}/${nativeId}`
      : `https://t.me/c/${chatId.slice(4)}/${nativeId}`;
  } catch {
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

export async function resolveTelegramLink(event, config, fetcher = fetch) {
  const chatId = config.telegramSourceChats?.[event.switch_room_id];
  if (!telegramChatId.test(chatId || '') || !config.telegramEvidenceBotToken ||
      (event.platform_channel_id && String(event.platform_channel_id) !== chatId)) return null;
  try {
    const offset = Number(config.telegramEvidenceStore?.getMeta('telegram_update_offset') || 0);
    const url = new URL(`https://api.telegram.org/bot${config.telegramEvidenceBotToken}/getUpdates`);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', '100');
    url.searchParams.set('timeout', '0');
    url.searchParams.set('allowed_updates', JSON.stringify(['message']));
    const response = await fetcher(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return null;
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.result)) return null;
    const previous = JSON.parse(config.telegramEvidenceStore?.getMeta('telegram_recent_messages') || '[]');
    const allowedChats = new Set(Object.values(config.telegramSourceChats || {}));
    const recent = [...previous, ...result.result.filter(update => Number.isSafeInteger(update.update_id))
      .map(update => update.message).filter(message => message &&
        allowedChats.has(String(message.chat?.id)))].slice(-200);
    const nextOffset = Math.max(offset, ...result.result.map(update => update.update_id + 1));
    config.telegramEvidenceStore?.setMeta('telegram_recent_messages', JSON.stringify(recent));
    config.telegramEvidenceStore?.setMeta('telegram_update_offset', nextOffset);
    const originTime = Date.parse(event.timestamp);
    const matches = recent.filter(message => {
      const author = message.from;
      const names = [author?.username, [author?.first_name, author?.last_name].filter(Boolean).join(' ')];
      return message.chat?.type === 'supergroup' && String(message.chat.id) === chatId &&
        messageId.test(String(message.message_id)) && Number.isSafeInteger(author?.id) && !author.is_bot &&
        message.text === event.text && Number.isFinite(originTime) &&
        Math.abs(message.date * 1000 - originTime) <= 10000 &&
        (!event.platform_message_id || String(event.platform_message_id) === String(message.message_id)) &&
        (!event.platform_sender_id || String(event.platform_sender_id) === String(author.id)) &&
        (event.platform_sender_id || names.includes(event.sender_name?.replace(/^@/, '')));
    });
    if (matches.length !== 1) return null;
    const message = matches[0];
    event.platform_channel_id = chatId;
    event.platform_message_id = String(message.message_id);
    event.platform_sender_id = String(message.from.id);
    const link = username.test(message.chat.username || '')
      ? `https://t.me/${message.chat.username}/${message.message_id}`
      : `https://t.me/c/${chatId.slice(4)}/${message.message_id}`;
    return link;
  } catch {
    return null;
  }
}
