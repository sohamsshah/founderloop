// Read-only inventory of channels visible to the configured Slack and Discord bots.
const slackToken = process.env.SLACK_BOT_TOKEN;
const discordToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

async function slack(method, query = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { authorization: `Bearer ${slackToken}` } });
  const json = await response.json();
  if (!json.ok) throw new Error(`${method}: ${json.error || response.status}`);
  return json;
}

if (slackToken) {
  try {
    const auth = await slack('auth.test');
    console.log(`Slack workspace: ${auth.team} (${auth.team_id}); bot: ${auth.user_id}`);
    let cursor;
    do {
      const page = await slack('conversations.list', {
        types: 'public_channel,private_channel', limit: '200', exclude_archived: 'true',
        ...(cursor ? { cursor } : {}),
      });
      for (const channel of page.channels || []) {
        console.log(`Slack ${channel.is_private ? 'private' : 'public'} ${channel.name} ${channel.id} member=${channel.is_member}`);
      }
      cursor = page.response_metadata?.next_cursor;
    } while (cursor);
    const people = await slack('users.list', { limit: '200' });
    for (const user of people.members || []) {
      if (!user.is_bot && !user.deleted) {
        console.log(`Slack person ${user.name} ${user.real_name || ''} ${user.id}`);
      }
    }
  } catch (error) { console.log(`Slack inventory failed: ${error.message}`); }
}

if (discordToken && guildId) {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { authorization: `Bot ${discordToken}` },
    });
    const channels = await response.json();
    if (!response.ok) throw new Error(`${response.status} ${channels.code || ''} ${channels.message || ''}`);
    console.log(`Discord guild: ${guildId}`);
    for (const channel of channels) {
      console.log(`Discord type=${channel.type} ${channel.name} ${channel.id} parent=${channel.parent_id || '-'}`);
    }
  } catch (error) { console.log(`Discord inventory failed: ${error.message}`); }
}
