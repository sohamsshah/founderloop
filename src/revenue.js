import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getGoogleToken } from './google-auth.js';
import { AmbiguousDeliveryError } from './transport.js';

const columns = ['lead_id', 'company', 'contact_name', 'platform', 'platform_user_id', 'email_if_supplied',
  'source_ref', 'buying_signal', 'stage', 'notes', 'updated_at'];
export const revenueColumns = [...columns, 'owner', 'currency', 'opportunity_value', 'current_mrr',
  'renewal_date', 'next_step', 'decision_status', 'decision_revision', 'decision_question'];

export function leadId(event, classification) {
  const stable = `${event.platform}:${event.platform_sender_id || event.sender_id}:${classification.topic.toLowerCase()}`;
  return `FL-LEAD-${createHash('sha256').update(stable).digest('hex').slice(0, 12)}`;
}

export function leadGroupKey(event, classification) {
  return `REVENUE:${leadId(event, classification)}`;
}

export function emailIn(text) {
  return text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]?.toLowerCase() || null;
}

function readCsv(text) {
  const input = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  const cell = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/y;
  while (cell.lastIndex < input.length) {
    const match = cell.exec(input);
    if (!match) throw new Error('Invalid Leads CSV');
    row.push(match[1]?.replaceAll('""', '"') ?? match[2]);
    if (match[3] === ',') continue;
    rows.push(row);
    row = [];
  }
  if (row.length) rows.push([...row, '']);
  return rows;
}

export async function loadRevenueSheet(config, fetcher = fetch) {
  if (config.revenueCredentialsPath) {
    config = { ...config, googleCredentialsPath: config.revenueCredentialsPath, googleToken: undefined };
  }
  const authenticated = config.googleToken || config.googleCredentialsPath;
  if (config.sheetId && (authenticated || config.publicRevenueExport)) {
    try {
      const id = encodeURIComponent(config.sheetId);
      const token = authenticated && await getGoogleToken(config, 'https://www.googleapis.com/auth/spreadsheets.readonly', fetcher);
      const url = authenticated
        ? `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent('Leads!A:T')}`
        : `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=Leads&headers=1`;
      const response = await fetcher(url, {
        headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
      const values = authenticated ? (await response.json()).values : readCsv(await response.text());
      if (!columns.every((column, i) => values?.[0]?.[i] === column)) {
        throw new Error('Leads tab header does not match the configured schema');
      }
      const pipeline = revenueColumns.every((column, i) => values[0][i] === column);
      if (!pipeline && (!authenticated || values[0].slice(columns.length).some(Boolean))) {
        throw new Error('Leads tab has incomplete or reordered Revenue columns');
      }
      const fields = pipeline ? revenueColumns : columns;
      const rows = values.slice(1).map((cells, index) => ({
        ...Object.fromEntries(fields.map((column, i) => [column, String(cells[i] ?? '').trim()])), rowNumber: index + 2,
      }));
      return { mode: authenticated ? 'live' : 'public_export', pipeline, rows,
        url: `https://docs.google.com/spreadsheets/d/${id}/edit`, tab: 'Leads' };
    } catch (error) {
      return { mode: 'unavailable', rows: [], reason: error.message };
    }
  }
  if (config.allowFixtureSheet) {
    const data = JSON.parse(await readFile(new URL('../fixtures/revenue-sheet.json', import.meta.url), 'utf8'));
    return { ...data, mode: 'simulated', url: null, tab: 'Leads' };
  }
  return { mode: 'unavailable', rows: [], reason: 'Google Sheet ID or access token not configured' };
}

export function matchRevenueSheet(event, classification, sheet, source) {
  if (sheet.mode === 'unavailable') return { mode: 'unavailable', status: 'unknown', pipeline: Boolean(source), url: null, tab: 'Leads' };
  const email = source ? null : emailIn(event.text);
  const internal = source === 'sales' || source === 'csm';
  const leadRefs = internal ? [...new Set([...event.text.matchAll(/\blead[ _-]?(?:id)?\s*[:#]\s*([\w-]+)/gi)].map(match => match[1]))] : [];
  const senderId = internal ? null : event.platform_sender_id || (source ? null : event.sender_id);
  const words = value => ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const message = words(event.text);
  const matches = sheet.rows.filter(row =>
    leadRefs.includes(row.lead_id) ||
    (internal && !leadRefs.length && row.company && companyMention(row.company, message, words)) ||
    (senderId && row.platform === event.platform && row.platform_user_id === senderId) ||
    (email && row.email_if_supplied?.toLowerCase() === email));
  const exact = leadRefs.length <= 1 && matches.length === 1 && matches[0].lead_id &&
    sheet.rows.filter(row => row.lead_id === matches[0].lead_id).length === 1 ? matches[0] : null;
  const possible = !exact && (internal || matches.length > 0 || sheet.rows.some(row => row.contact_name &&
    row.contact_name.toLowerCase() === event.sender_name?.toLowerCase()));
  return {
    mode: sheet.mode, status: exact ? 'existing' : possible ? 'possibly_existing' : 'new',
    matchedLeadId: exact?.lead_id || null, matchedRow: exact?.rowNumber || null,
    stage: exact?.stage?.trim().toLowerCase() || null,
    ...(sheet.pipeline ? { pipeline: true, source, company: exact?.company, owner: exact?.owner,
      currency: exact?.currency, opportunityValue: exact?.opportunity_value, currentMrr: exact?.current_mrr,
      renewalDate: exact?.renewal_date, nextStep: exact?.next_step, decisionStatus: exact?.decision_status,
      revision: exact?.decision_revision, question: exact?.decision_question } : {}),
    url: sheet.url, tab: sheet.tab, leadId: exact?.lead_id || leadId(event, classification),
  };
}

function companyMention(company, message, words) {
  const name = words(company).trim().replace(/^demo /, '');
  const firstWord = name.split(' ')[0];
  return (name.length >= 4 && message.includes(` ${name} `)) ||
    (firstWord.length >= 5 && new RegExp(
      ` (?:for|from|at|account) ${firstWord} | ${firstWord} (?:is|has|will|may|needs|requested|wants) `
    ).test(message));
}

export function urgentRevenueSignal(text, classification, source) {
  if (!['sales', 'csm'].includes(source)) return false;
  const deadline = /\b(?:urgent|asap|today|tomorrow|this week|end of day|eod|within \d+ (?:hours?|days?))\b/i.test(text);
  const founderRequested = /\b(?:needs?|requires?|asking for|waiting for|can we get)\s+(?:the\s+)?founder(?:['’]s)?\s+(?:approval|decision|sign-off)\b/i.test(text);
  if (classification?.kind === 'renewal_risk') {
    return deadline || founderRequested ||
      /\b(?:approve|approval|sign-off)\b[^.!?\n]*\b(?:discount|exception|payment terms)\b/i.test(text) ||
      /\b(?:won't renew|will not renew|decided not to renew|requested (?:to cancel|cancellation)|(?:critical|severe|very high|super high)\s+(?:churn|renewal risk)|(?:churn(?: rate| risk)?|renewal risk)\s+(?:is\s+)?(?:critical|severe|very high|super high))\b/i.test(text);
  }
  return ['commercial_approval', 'expansion', 'buying_signal'].includes(classification?.kind) &&
    (founderRequested || (deadline && /\b(?:approval|approve|sign-off|decision|blocked)\b/i.test(text)));
}

export function classifyRevenue(text) {
  if (/ignore (all|previous) instructions|reveal .*secret|paste .*discussions/i.test(text)) return null;
  const buyingAction = /\b(quote|proposal|purchase order|procurement|contract|buy|purchase|enterprise evaluation|enterprise pricing|pricing for (?:our|my|the) (?:enterprise|team|company))\b/i;
  const request = /\b(?:can|could|please|(?:we|i) (?:want|need|are interested)|we'd like|i'd like|how (?:much|do we)|ready to|looking (?:for|to)|request(?:ing)?)\b/i;
  const kind = /\b(churn|cancel(?:lation|ling)?|non-renewal|renewal risk|won['’]t renew|not renew(?:ing)?)\b/i.test(text) ? 'renewal_risk'
    : /\b(discount|pricing exception|commercial exception|payment terms|legal approval|founder approval|founder decision|need approval|approve)\b/i.test(text) ? 'commercial_approval'
    : /\b(expansion|upgrade|additional seats|more seats|add seats)\b/i.test(text) && request.test(text) ? 'expansion'
    : buyingAction.test(text) && request.test(text) ? 'buying_signal' : null;
  return kind && { category: 'REVENUE', kind, topic: kind.replaceAll('_', ' '), confidence: 0.85,
    method: 'heuristic', assessment: 'The source reports a commercial signal. The Leads Sheet supplies the recorded account and decision context.' };
}

export function revenueNeedsDecision(text, context, classification, source) {
  if (urgentRevenueSignal(text, classification, source)) return true;
  if (source && !context.matchedLeadId && classification?.kind === 'buying_signal') return true;
  if (source && !context.pipeline) return false;
  if (context.pipeline) {
    if (context.status === 'new') return classification?.kind === 'buying_signal' && source === 'discord';
    return context.status === 'existing' && context.decisionStatus?.toLowerCase() === 'founder_review' &&
      /^[1-9]\d*$/.test(context.revision || '') && Boolean(context.question && context.question !== '-');
  }
  const buyingAction = /\b(quote|proposal|purchase order|procurement|contract|buy|purchase|enterprise evaluation|enterprise pricing|pricing for (?:our|my|the) (?:enterprise|team|company))\b/i;
  const request = /\b(?:can|could|please|we (?:want|need|are interested)|how (?:much|do we)|ready to|looking (?:for|to))\b/i;
  return buyingAction.test(text) && request.test(text) && (context.status === 'new' ||
    (context.status === 'existing' && context.stage === 'founder_review'));
}

export async function upsertAcceptedLead({ event, classification, context, config, fetcher = fetch }) {
  if (config.revenueCredentialsPath) throw new Error('The Revenue service account is read-only');
  if (!config.sheetId || (!config.googleToken && !config.googleCredentialsPath) || context.mode !== 'live') throw new Error('Live Sheet write unavailable');
  const sheet = await loadRevenueSheet(config, fetcher);
  if (sheet.mode !== 'live') throw new Error(sheet.reason || 'Could not read Sheet before write');
  if (sheet.pipeline) throw new Error('Authoritative Revenue pipeline rows are read-only to the agent');
  const current = sheet.rows.find(row => row.lead_id === context.leadId);
  const now = new Date().toISOString();
  const values = [[context.leadId, current?.company || '', current?.contact_name || '', event.platform,
    event.platform_sender_id || event.sender_id, emailIn(event.text) || current?.email_if_supplied || '',
    context.sourceRef, event.text, 'founder_accepted', current?.notes || '', now]];
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}/values/`;
  const range = current ? `Leads!A${current.rowNumber}:K${current.rowNumber}` : 'Leads!A:K';
  const url = `${base}${encodeURIComponent(range)}${current ? '?valueInputOption=RAW' : ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'}`;
  const token = await getGoogleToken(config, 'https://www.googleapis.com/auth/spreadsheets', fetcher);
  let response;
  try {
    response = await fetcher(url, {
      method: current ? 'PUT' : 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }), signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    throw new AmbiguousDeliveryError(`Google Sheets write result unknown: ${error.message}`);
  }
  if (!response.ok) {
    if (response.status >= 500) throw new AmbiguousDeliveryError(`Google Sheets write HTTP ${response.status}`);
    throw new Error(`Google Sheets write HTTP ${response.status}`);
  }
  return { leadId: context.leadId, updated: Boolean(current) };
}
