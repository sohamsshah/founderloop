import { mattermostBaseUrl, mattermostId, mattermostTeam } from './mattermost-evidence.js';
import { telegramChatId } from './telegram-evidence.js';

const sourcePlatformNames = ['discord', 'slack', 'mattermost', 'telegram'];

export function readConfig(env = process.env) {
  const enabledCategories = (env.FOUNDER_LOOP_ENABLED_CATEGORIES || 'PRODUCT')
    .split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
  const sourceRoomIds = (env.SWITCH_SOURCE_ROOM_IDS || env.SWITCH_SOURCE_ROOM_ID || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  let sourcePlatforms = {};
  if (env.SWITCH_SOURCE_PLATFORMS) {
    try { sourcePlatforms = JSON.parse(env.SWITCH_SOURCE_PLATFORMS); }
    catch { throw new Error('SWITCH_SOURCE_PLATFORMS must be a JSON object'); }
  }
  let sourceCategories = {};
  if (env.SWITCH_SOURCE_CATEGORIES) {
    try { sourceCategories = JSON.parse(env.SWITCH_SOURCE_CATEGORIES); }
    catch { throw new Error('SWITCH_SOURCE_CATEGORIES must be a JSON object'); }
  }
  let slackSourceChannels = {};
  if (env.SLACK_SOURCE_CHANNELS) {
    try { slackSourceChannels = JSON.parse(env.SLACK_SOURCE_CHANNELS); }
    catch { throw new Error('SLACK_SOURCE_CHANNELS must be a JSON object'); }
  }
  let mattermostSourceChannels = {};
  if (env.MATTERMOST_SOURCE_CHANNELS) {
    try { mattermostSourceChannels = JSON.parse(env.MATTERMOST_SOURCE_CHANNELS); }
    catch { throw new Error('MATTERMOST_SOURCE_CHANNELS must be a JSON object'); }
  }
  let telegramSourceChats = {};
  if (env.TELEGRAM_SOURCE_CHATS) {
    try { telegramSourceChats = JSON.parse(env.TELEGRAM_SOURCE_CHATS); }
    catch { throw new Error('TELEGRAM_SOURCE_CHATS must be a JSON object'); }
  }
  return {
    baseUrl: env.SWITCH_BASE_URL,
    agentId: env.SWITCH_AGENT_ID,
    agentKey: env.SWITCH_AGENT_API_KEY,
    sourceRoomId: sourceRoomIds[0], sourceRoomIds, sourcePlatforms, sourceCategories, slackSourceChannels,
    sourcePlatform: env.SWITCH_SOURCE_PLATFORM || 'discord',
    revenueSources: JSON.parse(env.REVENUE_SOURCES || '{}'),
    founderRoomId: env.SWITCH_FOUNDER_ROOM_ID,
    productRoomId: env.SWITCH_PRODUCT_ROOM_ID,
    salesRoomId: env.SWITCH_SALES_ROOM_ID,
    supportRoomId: env.SWITCH_SUPPORT_ROOM_ID,
    founderSenderId: env.FOUNDER_SWITCH_SENDER_ID,
    founderSlackUserId: env.FOUNDER_SLACK_USER_ID,
    agentSenderId: env.SWITCH_AGENT_SENDER_ID,
    slackBotToken: env.SLACK_BOT_TOKEN,
    slackAppToken: env.SLACK_APP_TOKEN,
    slackFounderChannelId: env.SLACK_FOUNDER_CHANNEL_ID,
    slackSupportChannelId: env.SLACK_SUPPORT_CHANNEL_ID,
    slackFounderAppToken: env.SLACK_FOUNDER_APP_TOKEN,
    slackFounderBotToken: env.SLACK_FOUNDER_BOT_TOKEN,
    slackWorkspaceId: env.SLACK_WORKSPACE_ID,
    discordBotToken: env.DISCORD_BOT_TOKEN,
    discordGuildId: env.DISCORD_GUILD_ID,
    discordSourceChannelId: env.DISCORD_SOURCE_CHANNEL_ID,
    mattermostSourceChannels,
    mattermostUrl: env.MATTERMOST_URL,
    mattermostPublicUrl: env.MATTERMOST_PUBLIC_URL,
    mattermostTeam: env.MATTERMOST_TEAM,
    mattermostReadToken: env.MATTERMOST_READ_TOKEN,
    telegramSourceChats,
    telegramEvidenceBotToken: env.TELEGRAM_EVIDENCE_BOT_TOKEN,
    telegramDbHost: env.TELEGRAM_DB_HOST,
    telegramDbPort: env.TELEGRAM_DB_PORT ? Number(env.TELEGRAM_DB_PORT) : undefined,
    telegramDbName: env.TELEGRAM_DB_NAME,
    telegramDbUser: env.TELEGRAM_DB_USER,
    telegramDbPassword: env.TELEGRAM_DB_PASSWORD,
    telegramDbTenantId: env.TELEGRAM_DB_TENANT_ID,
    docId: env.GOOGLE_PRODUCT_DOC_ID,
    docTitle: env.GOOGLE_PRODUCT_DOC_TITLE,
    publicDocExport: env.GOOGLE_DOC_PUBLIC_EXPORT === 'true',
    sheetId: env.GOOGLE_REVENUE_SHEET_ID,
    revenueCredentialsPath: env.GOOGLE_REVENUE_CREDENTIALS,
    publicRevenueExport: env.GOOGLE_REVENUE_PUBLIC_EXPORT === 'true',
    googleToken: env.GOOGLE_ACCESS_TOKEN,
    googleCredentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS,
    enableSheetWrite: env.ENABLE_SHEET_WRITE === 'true',
    commitmentStaffIds: (env.COMMITMENT_STAFF_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    llmApiKey: env.OPENAI_API_KEY,
    llmModel: env.OPENAI_MODEL,
    claudeRevenueReview: env.FOUNDER_LOOP_CLAUDE_REVIEW === 'true',
    claudeCodeExecutable: env.CLAUDE_CODE_EXECUTABLE || undefined,
    minConfidence: env.MIN_SIGNAL_CONFIDENCE ? Number(env.MIN_SIGNAL_CONFIDENCE) : 0.65,
    enabledCategories,
    sourceMode: 'live',
  };
}

export function validateLive(config) {
  const categories = config.enabledCategories || ['PRODUCT'];
  if (!categories.length || categories.some(category => !['PRODUCT', 'REVENUE', 'COMMITMENT', 'GENERAL'].includes(category))) {
    throw new Error('FOUNDER_LOOP_ENABLED_CATEGORIES must list PRODUCT, REVENUE, COMMITMENT, or GENERAL');
  }
  const required = ['baseUrl', 'agentId', 'agentKey', 'founderRoomId', 'founderSenderId'];
  if (categories.includes('PRODUCT')) required.push('productRoomId');
  if (categories.includes('REVENUE')) required.push('salesRoomId');
  if (categories.includes('COMMITMENT')) required.push('supportRoomId');
  const missing = required.filter(key => !config[key]);
  if (!config.sourceRoomIds.length) missing.push('sourceRoomIds');
  if (missing.length) throw new Error(`Missing live configuration: ${missing.join(', ')}`);
  const revenueSources = config.revenueSources ?? {};
  if (typeof revenueSources !== 'object' || Array.isArray(revenueSources) ||
      Object.entries(revenueSources).some(([room, source]) => {
        const platform = config.sourcePlatforms?.[room] || config.sourcePlatform;
        return !config.sourceRoomIds.includes(room) || !config.sourceCategories?.[room]?.includes('REVENUE') ||
          (source === 'discord' ? platform !== 'discord'
            : !['sales', 'csm'].includes(source) || platform !== 'slack' || !config.slackSourceChannels?.[room]);
      })) throw new Error('REVENUE_SOURCES must map Revenue-enabled source rooms to discord, sales, or csm');
  if (Object.keys(revenueSources).length &&
      (!config.sheetId || !(config.revenueCredentialsPath || config.googleToken || config.googleCredentialsPath || config.publicRevenueExport))) {
    throw new Error('Configured Revenue sources require a Sheet ID and a configured read mode');
  }
  if (config.sourceCategories && (typeof config.sourceCategories !== 'object' || Array.isArray(config.sourceCategories) ||
      Object.entries(config.sourceCategories).some(([room, values]) => !config.sourceRoomIds.includes(room) ||
        !Array.isArray(values) || values.some(value => !categories.includes(value))))) {
    throw new Error('SWITCH_SOURCE_CATEGORIES must map configured source rooms to enabled categories');
  }
  if (config.sourcePlatform && !sourcePlatformNames.includes(config.sourcePlatform)) {
    throw new Error('SWITCH_SOURCE_PLATFORM must be discord, slack, mattermost, or telegram');
  }
  if (config.sourcePlatforms && (typeof config.sourcePlatforms !== 'object' || Array.isArray(config.sourcePlatforms) ||
      Object.entries(config.sourcePlatforms).some(([room, platform]) => !config.sourceRoomIds.includes(room) ||
        !sourcePlatformNames.includes(platform)))) {
    throw new Error('SWITCH_SOURCE_PLATFORMS must map configured source rooms to discord, slack, mattermost, or telegram');
  }
  const telegramRooms = config.sourceRoomIds.filter(room =>
    (config.sourcePlatforms?.[room] || config.sourcePlatform) === 'telegram');
  const telegramChats = config.telegramSourceChats;
  if (telegramRooms.length || Object.keys(telegramChats || {}).length) {
    if (!telegramChats || typeof telegramChats !== 'object' || Array.isArray(telegramChats) ||
        Object.keys(telegramChats).length !== telegramRooms.length ||
        telegramRooms.some(room => !telegramChatId.test(telegramChats[room] || ''))) {
      throw new Error('TELEGRAM_SOURCE_CHATS must map each Telegram source room to its native supergroup chat ID');
    }
    if (!config.telegramEvidenceBotToken && (!config.telegramDbName || !config.telegramDbUser ||
        !config.telegramDbPassword || !config.telegramDbTenantId)) {
      throw new Error('Telegram intake requires an evidence bot or a read-only Switch database connection');
    }
  }
  const mattermostRooms = config.sourceRoomIds.filter(room =>
    (config.sourcePlatforms?.[room] || config.sourcePlatform) === 'mattermost');
  const mattermostChannels = config.mattermostSourceChannels;
  if (mattermostRooms.length || Object.keys(mattermostChannels || {}).length) {
    if (!mattermostChannels || typeof mattermostChannels !== 'object' || Array.isArray(mattermostChannels) ||
        Object.keys(mattermostChannels).length !== mattermostRooms.length ||
        mattermostRooms.some(room => typeof mattermostChannels[room] !== 'string' ||
          !mattermostId.test(mattermostChannels[room]))) {
      throw new Error('MATTERMOST_SOURCE_CHANNELS must map each Mattermost source room to its native channel ID');
    }
    if (!mattermostBaseUrl(config.mattermostUrl) ||
        (config.mattermostPublicUrl && !mattermostBaseUrl(config.mattermostPublicUrl)) ||
        !mattermostTeam.test(config.mattermostTeam || '') || !config.mattermostReadToken) {
      throw new Error('Mattermost intake requires MATTERMOST_URL, MATTERMOST_TEAM and MATTERMOST_READ_TOKEN');
    }
  }
  if (config.slackSourceChannels && (typeof config.slackSourceChannels !== 'object' || Array.isArray(config.slackSourceChannels) ||
      Object.entries(config.slackSourceChannels).some(([room, channel]) =>
        !config.sourceRoomIds.includes(room) || config.sourcePlatforms?.[room] !== 'slack' ||
        typeof channel !== 'string' || !/^[A-Z0-9]{8,}$/.test(channel)))) {
    throw new Error('SLACK_SOURCE_CHANNELS must map Slack source rooms to native channel IDs');
  }
  if (Boolean(config.slackFounderAppToken) !== Boolean(config.slackFounderBotToken)) {
    throw new Error('Interactive founder Slack requires both app and bot tokens');
  }
  if (config.slackFounderAppToken && (!config.slackFounderChannelId || !config.founderSlackUserId)) {
    throw new Error('Interactive founder Slack requires channel and founder user IDs');
  }
  if ((config.slackFounderAppToken && config.slackFounderAppToken === config.slackAppToken) ||
      (config.slackFounderBotToken && config.slackFounderBotToken === config.slackBotToken)) {
    throw new Error('Interactive founder Slack must use a separate app from the Switch bridge');
  }
  if (!Number.isFinite(config.minConfidence) || config.minConfidence < 0 || config.minConfidence > 1) {
    throw new Error('MIN_SIGNAL_CONFIDENCE must be between 0 and 1');
  }
}
