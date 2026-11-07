// Add the configured founder to the dedicated private Slack test channels.
const channels = [
  process.env.SLACK_FOUNDER_CHANNEL_ID,
  process.env.SLACK_PRODUCT_CHANNEL_ID,
  process.env.SLACK_SALES_CHANNEL_ID,
  process.env.SLACK_SUPPORT_CHANNEL_ID,
].filter(Boolean);
const founder = process.env.FOUNDER_SLACK_USER_ID;
if (!founder || channels.length !== 4) throw new Error('Founder or channel IDs missing');

for (const channel of channels) {
  const response = await fetch('https://slack.com/api/conversations.invite', {
    method: 'POST', headers: {
      authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'content-type': 'application/json; charset=utf-8',
    }, body: JSON.stringify({ channel, users: founder }),
  });
  const data = await response.json();
  console.log(`${channel}: ${data.ok ? 'invited' : data.error || response.status}`);
}
