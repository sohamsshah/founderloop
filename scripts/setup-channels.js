// Create dedicated Founder Loop test channels. Re-running Slack calls reports name_taken.
const slackToken = process.env.SLACK_BOT_TOKEN;
const discordToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

async function slack(method, body) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST', headers: {
      authorization: `Bearer ${slackToken}`, 'content-type': 'application/json; charset=utf-8',
    }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.error || response.status}`);
  return data;
}

const slackNames = ['founder-loop-founder', 'founder-loop-product',
  'founder-loop-sales', 'founder-loop-support'];
for (const name of slackNames) {
  try {
    const result = await slack('conversations.create', { name, is_private: true });
    console.log(`Slack created ${name} ${result.channel.id}`);
  } catch (error) {
    console.log(`Slack ${name}: ${error.message}`);
  }
}

try {
  const listResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { authorization: `Bot ${discordToken}` },
  });
  const existingChannels = await listResponse.json();
  if (!listResponse.ok) throw new Error(`${listResponse.status} ${existingChannels.message || ''}`);
  const existing = existingChannels.find(channel => channel.name === 'founder-loop-source' && channel.type === 0);
  if (existing) {
    console.log(`Discord existing ${existing.name} ${existing.id}`);
    process.exit(0);
  }
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    method: 'POST', headers: {
      authorization: `Bot ${discordToken}`, 'content-type': 'application/json',
    }, body: JSON.stringify({ name: 'founder-loop-source', type: 0,
      topic: 'Isolated Founder Loop test source. Ordinary customer-signal messages are observed passively.' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${data.code || ''} ${data.message || ''}`);
  console.log(`Discord created ${data.name} ${data.id}`);
} catch (error) { console.log(`Discord founder-loop-source: ${error.message}`); }
