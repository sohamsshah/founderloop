import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getGoogleToken } from './google-auth.js';
import { AmbiguousDeliveryError } from './transport.js';

const columns = ['lead_id', 'company', 'contact_name', 'platform', 'platform_user_id', 'email_if_supplied',
  'source_ref', 'buying_signal', 'stage', 'notes', 'updated_at'];

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

export async function loadRevenueSheet(config, fetcher = fetch) {
  if (config.sheetId && (config.googleToken || config.googleCredentialsPath)) {
    try {
      const token = await getGoogleToken(config, 'https://www.googleapis.com/auth/spreadsheets.readonly', fetcher);
      const range = encodeURIComponent('Leads!A:K');
      const response = await fetcher(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}/values/${range}`, {
        headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
      const data = await response.json();
      const rows = (data.values || []).slice(1).map((cells, index) => ({
        ...Object.fromEntries(columns.map((column, i) => [column, cells[i] || ''])), rowNumber: index + 2,
      }));
      return { mode: 'live', rows, url: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.sheetId)}/edit`, tab: 'Leads' };
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

export function matchRevenueSheet(event, classification, sheet) {
  if (sheet.mode === 'unavailable') return { mode: 'unavailable', status: 'unknown', reason: sheet.reason, url: null, tab: 'Leads' };
  const email = emailIn(event.text);
  const senderId = event.platform_sender_id || event.sender_id;
  const exact = sheet.rows.find(row =>
    (row.platform === event.platform && row.platform_user_id && row.platform_user_id === senderId) ||
    (email && row.email_if_supplied?.toLowerCase() === email));
  const possible = !exact && sheet.rows.some(row => row.contact_name &&
    row.contact_name.toLowerCase() === event.sender_name?.toLowerCase());
  return {
    mode: sheet.mode, status: exact ? 'existing' : possible ? 'possibly_existing' : 'new',
    matchedLeadId: exact?.lead_id || null, matchedRow: exact?.rowNumber || null,
    url: sheet.url, tab: sheet.tab, leadId: exact?.lead_id || leadId(event, classification),
  };
}

export async function upsertAcceptedLead({ event, classification, context, config, fetcher = fetch }) {
  if (!config.sheetId || (!config.googleToken && !config.googleCredentialsPath) || context.mode !== 'live') throw new Error('Live Sheet write unavailable');
  const sheet = await loadRevenueSheet(config, fetcher);
  if (sheet.mode !== 'live') throw new Error(sheet.reason || 'Could not read Sheet before write');
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
