export function readConfig(env = process.env) {
  const sourceRoomIds = (env.SWITCH_SOURCE_ROOM_IDS || env.SWITCH_SOURCE_ROOM_ID || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  let sourcePlatforms = {};
  if (env.SWITCH_SOURCE_PLATFORMS) {
    try { sourcePlatforms = JSON.parse(env.SWITCH_SOURCE_PLATFORMS); }
    catch { throw new Error('SWITCH_SOURCE_PLATFORMS must be a JSON object'); }
  }
  return {
    baseUrl: env.SWITCH_BASE_URL,
    agentId: env.SWITCH_AGENT_ID,
    agentKey: env.SWITCH_AGENT_API_KEY,
    sourceRoomId: sourceRoomIds[0], sourceRoomIds, sourcePlatforms,
    sourcePlatform: env.SWITCH_SOURCE_PLATFORM || 'discord',
    founderRoomId: env.SWITCH_FOUNDER_ROOM_ID,
    productRoomId: env.SWITCH_PRODUCT_ROOM_ID,
    salesRoomId: env.SWITCH_SALES_ROOM_ID,
    supportRoomId: env.SWITCH_SUPPORT_ROOM_ID,
    founderSenderId: env.FOUNDER_SWITCH_SENDER_ID,
    founderSlackUserId: env.FOUNDER_SLACK_USER_ID,
    agentSenderId: env.SWITCH_AGENT_SENDER_ID,
    slackBotToken: env.SLACK_BOT_TOKEN,
    docId: env.GOOGLE_PRODUCT_DOC_ID,
    docTitle: env.GOOGLE_PRODUCT_DOC_TITLE,
    publicDocExport: env.GOOGLE_DOC_PUBLIC_EXPORT === 'true',
    sheetId: env.GOOGLE_REVENUE_SHEET_ID,
    googleToken: env.GOOGLE_ACCESS_TOKEN,
    googleCredentialsPath: env.GOOGLE_APPLICATION_CREDENTIALS,
    enableSheetWrite: env.ENABLE_SHEET_WRITE === 'true',
    llmApiKey: env.OPENAI_API_KEY,
    llmModel: env.OPENAI_MODEL,
    minConfidence: env.MIN_SIGNAL_CONFIDENCE ? Number(env.MIN_SIGNAL_CONFIDENCE) : 0.65,
    sourceMode: 'live',
  };
}

export function validateLive(config) {
  const required = ['baseUrl', 'agentId', 'agentKey', 'founderRoomId', 'productRoomId',
    'salesRoomId', 'supportRoomId', 'founderSenderId'];
  const missing = required.filter(key => !config[key]);
  if (!config.sourceRoomIds.length) missing.push('sourceRoomIds');
  if (missing.length) throw new Error(`Missing live configuration: ${missing.join(', ')}`);
  if (!Number.isFinite(config.minConfidence) || config.minConfidence < 0 || config.minConfidence > 1) {
    throw new Error('MIN_SIGNAL_CONFIDENCE must be between 0 and 1');
  }
}
