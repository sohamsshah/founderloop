import { escapeSlack } from './evidence.js';

const categories = {
  PRODUCT: { emoji: '📦', name: 'Product' },
  REVENUE: { emoji: '💰', name: 'Revenue' },
  COMMITMENT: { emoji: '🛟', name: 'Commitment' },
  GENERAL: { emoji: '🤝', name: 'General' },
};
const verdicts = { ACCEPT: '✅ Accepted', REJECT: '❌ Rejected', COMMENT: '💬 Commented' };
const sourcePlatforms = { discord: 'Discord', slack: 'Slack', mattermost: 'Mattermost', telegram: 'Telegram' };
const sourceDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const oneLine = (value, limit = 160) => escapeSlack(String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit));
const sentence = value => value.charAt(0).toUpperCase() + value.slice(1);
const words = value => String(value || '').replace(/[_-]+/g, ' ');
const simulated = event => event.source_mode === 'simulated' ? '[SIMULATED FIXTURE] ' : '';

function citation(link, text) {
  return link.startsWith('fixture:') ? `${link} (simulated)` : `<${link}|${text}>`;
}

function quote(text, limit, heading) {
  let excerpt = text.slice(0, limit);
  while (escapeSlack(excerpt).length > 2000) excerpt = excerpt.slice(0, Math.floor(excerpt.length * 0.8));
  return `${heading}${excerpt.length < text.length ? ' (excerpt)' : ''}\n${escapeSlack(excerpt).replace(/^/gm, '> ')}`;
}

function subject(card, context) {
  if (card.category === 'GENERAL') return 'Founder follow-up';
  if (card.category === 'PRODUCT') return sentence(words(context.id || card.title));
  if (card.category === 'COMMITMENT') {
    if (context.incident) return 'Reported incident';
    if (context.outage) return 'Reported outage';
    return context.kind === 'explicit_company_promise' ? 'Company promise' : 'Customer issue';
  }
  const title = card.title.replace(/ (?:renewal_risk|commercial_approval|expansion|buying_signal)$/, '');
  return context.urgent ? `Urgent ${title.toLowerCase()}` : sentence(title);
}

function sourceDetails(event) {
  const name = event.channel_name?.replace(/^#/, '');
  const knownIds = [event.switch_room_id, event.platform_channel_id, event.platform_message_id];
  const channel = name && !knownIds.includes(name) && !/^(?:[\da-f-]{32,}|-?\d{8,}|[CGD][A-Z0-9]{8,})$/i.test(name)
    ? `#${oneLine(name, 60)}` : null;
  const author = event.sender_name !== event.sender_id && event.sender_name !== event.platform_sender_id
    ? oneLine(event.sender_name, 60) : null;
  return [sourcePlatforms[event.platform], channel, author, `${sourceDate.format(new Date(event.timestamp))} UTC`].filter(Boolean).join(' · ');
}

function amount(value, currency) {
  if (!value) return null;
  const formatted = /^-?\d+(?:\.\d{1,2})?$/.test(value) ? number.format(Number(value)) : oneLine(value, 32);
  return [oneLine(currency, 8), formatted].filter(Boolean).join(' ');
}

function accountSummary(context) {
  const value = amount(context.opportunityValue, context.currency);
  const mrr = amount(context.currentMrr, context.currency);
  return [oneLine(context.company, 100), value && `${value} opportunity`, mrr && `${mrr} MRR`].filter(Boolean).join(' · ');
}

function referenceContext(card, context) {
  if (card.category === 'PRODUCT') {
    if (context.mode === 'unavailable') return '*Roadmap* · Unavailable';
    const details = [sentence(oneLine(words(context.status), 40)), context.owner && `Owner: ${oneLine(context.owner, 70)}`,
      context.deadline && `Target: ${oneLine(context.deadline, 24)}`].filter(Boolean).join(' · ');
    const reference = context.url ? citation(context.url, 'Open roadmap in Google Docs') : oneLine(context.title);
    return `*📋 Roadmap*\n${details}\n${reference}${context.mode === 'simulated' ? ' · simulated snapshot' : ''}`;
  }
  if (card.category === 'REVENUE') {
    const account = accountSummary(context) || (context.status === 'existing' ? 'Matched lead' : 'No verified account match');
    const details = [context.stage && sentence(oneLine(words(context.stage), 40)), context.owner && `Owner: ${oneLine(context.owner, 70)}`,
      context.renewalDate && `Renews: ${oneLine(context.renewalDate, 24)}`].filter(Boolean).join(' · ');
    return ['*📊 Lead context*', account, details, context.url && citation(context.url, 'Open Leads sheet'),
      context.mode === 'simulated' && 'Simulated Leads sheet'].filter(Boolean).join('\n');
  }
  return context.deadline ? `*🗓️ Promised timing*\n“${oneLine(context.deadline)}”` : '';
}

export function renderFounderCard(card, event, context, link, evidence = []) {
  const { emoji, name } = categories[card.category];
  const id = `FL-${String(card.id).padStart(3, '0')}`;
  const supporting = evidence.filter(item => item.source_key !== card.source_key).slice(0, 2)
    .map(item => `${quote(item.quote, 320, '*Supporting message*')}\n${citation(item.permalink, 'Open supporting message')}`);
  return [
    `${simulated(event)}${emoji} ${name} · ${oneLine(subject(card, context), 80)}`,
    context.question && `*🎯 Decision needed*\n${oneLine(context.question, 240)}`,
    `${quote(event.text, 1200, '*💬 Original message*')}\n${sourceDetails(event)}\n${citation(link, '🔗 Open original message')}`,
    referenceContext(card, context),
    context.claudeReviewQuestion && `*🔎 Claude Code review*\n${oneLine(context.claudeReviewQuestion, 200)}`,
    card.assessment && `*Assessment* · ${oneLine(card.assessment, 200)}`,
    ...supporting,
    `Decide in Slack\n\`${id} ACCEPT\` · \`${id} REJECT\` · \`${id} COMMENT &lt;text&gt;\``,
  ].filter(Boolean).join('\n\n');
}

export function renderVerdict(card, event, link, decision, context) {
  const account = card.category === 'REVENUE' && accountSummary(context);
  return [
    `${simulated(event)}${verdicts[decision.verdict]} · ${categories[card.category].name}`,
    `*${oneLine(context.question || subject(card, context), 240)}*`,
    decision.comment && `*Founder comment*\n${escapeSlack(decision.comment)}`,
    account,
    decision.sheetState === 'SENT' && '✓ Leads sheet updated',
    decision.sheetState === 'READ_ONLY' && 'Leads sheet · Read only',
    decision.sheetState === 'UNAVAILABLE' && 'Leads sheet update unavailable',
    `${quote(event.text, 320, '*💬 Original message*')}\n${citation(link, '🔗 Open original message')}`,
  ].filter(Boolean).join('\n\n');
}
