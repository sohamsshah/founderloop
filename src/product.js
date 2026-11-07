import { readFile } from 'node:fs/promises';
import { getGoogleToken } from './google-auth.js';

export function classifyProduct(text) {
  const lower = text.toLowerCase();
  if (/ignore (all|previous) instructions|paste .*discussions|reveal .*secret/.test(lower)) return null;
  const request = /\b((?:can|could) (?:you|we|product)|please add|feature request|we need|would like|wish (?:you|it)|support for)\b/.test(lower);
  const feature = /\b(export|schedule|sso|integration|api|dashboard|report|webhook|bug|error|broken|timeout)\w*/.test(lower);
  const bug = /\b(bug|error|broken|doesn.t work|timeout)\b/.test(lower);
  if (!(request && feature) && !bug && !/\b(please add|feature request|could product add|can product add)\b/.test(lower)) return null;

  const topic = /export/i.test(lower) ? 'exports' : /sso/i.test(lower) ? 'SSO'
    : /integration/i.test(lower) ? 'integration' : /api/i.test(lower) ? 'API'
      : /report/i.test(lower) ? 'reports' : 'product issue';
  const kind = bug ? 'bug' : 'request';
  return {
    category: 'PRODUCT', kind, topic, confidence: bug ? 0.72 : 0.82,
    assessment: bug
      ? `Customer reports a ${topic} problem. Founder should decide whether Product should investigate.`
      : `Customer requests ${topic}. Founder should decide whether Product should evaluate it.`,
  };
}

function allParagraphs(doc) {
  const result = [];
  const walkElements = (elements = [], tabTitle = '') => {
    let heading = tabTitle;
    for (const element of elements) {
      const paragraph = element.paragraph;
      if (paragraph) {
        const text = (paragraph.elements || []).map(part => part.textRun?.content || '').join('').trim();
        if (text) {
          if (paragraph.paragraphStyle?.namedStyleType?.startsWith('HEADING')) heading = text;
          result.push({ text, heading });
        }
      }
      if (element.table) {
        for (const row of element.table.tableRows || []) {
          for (const cell of row.tableCells || []) walkElements(cell.content, heading);
        }
      }
    }
  };
  const walkTab = tab => {
    walkElements(tab.documentTab?.body?.content, tab.tabProperties?.title || '');
    for (const child of tab.childTabs || []) walkTab(child);
  };
  if (doc.tabs?.length) for (const tab of doc.tabs) walkTab(tab);
  else walkElements(doc.body?.content);
  return result;
}

export async function loadProductDoc(config, fetcher = fetch) {
  if (config.docId && (config.googleToken || config.googleCredentialsPath)) {
    try {
      const token = await getGoogleToken(config, 'https://www.googleapis.com/auth/documents.readonly', fetcher);
      const response = await fetcher(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(config.docId)}?includeTabsContent=true`, {
        headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Google Docs HTTP ${response.status}`);
      const data = await response.json();
      if (data.documentId !== config.docId) throw new Error('Google Docs returned a different document ID');
      return { mode: 'live', title: data.title,
        url: `https://docs.google.com/document/d/${encodeURIComponent(config.docId)}/edit`,
        sections: allParagraphs(data) };
    } catch (error) {
      return { mode: 'unavailable', reason: error.message, sections: [] };
    }
  }
  if (config.docId && config.publicDocExport) {
    try {
      const response = await fetcher(`https://docs.google.com/document/d/${encodeURIComponent(config.docId)}/export?format=txt`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Google Doc public export HTTP ${response.status}`);
      const plain = await response.text();
      let heading = 'Document text';
      const sections = plain.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(text => {
        if (/^(Product overview|Current features|Known limitations|Roadmap|Engineering constraints)/i.test(text)) heading = text;
        return { text, heading };
      });
      if (!sections.length) throw new Error('Google Doc public export was empty');
      return { mode: 'public_export', title: config.docTitle || 'Configured Google Doc',
        url: `https://docs.google.com/document/d/${encodeURIComponent(config.docId)}/edit`, sections };
    } catch (error) {
      return { mode: 'unavailable', reason: error.message, sections: [] };
    }
  }
  if (config.allowFixtureDoc) {
    const data = JSON.parse(await readFile(new URL('../fixtures/product-doc.json', import.meta.url), 'utf8'));
    return { ...data, url: null };
  }
  return { mode: 'unavailable', reason: 'Google Doc ID or access token not configured', sections: [] };
}

export function matchProductDoc(classification, doc) {
  if (doc.mode === 'unavailable') {
    return { status: 'unavailable', excerpt: null, heading: null, url: null, mode: 'unavailable' };
  }
  const topic = classification.topic.toLowerCase().replace(/s$/, '');
  const candidate = doc.sections.find(section =>
    `${section.text} ${section.heading}`.toLowerCase().includes(topic));
  if (!candidate) return { status: 'unknown', excerpt: null, heading: null,
    url: doc.url, mode: doc.mode, title: doc.title };
  const text = candidate.text;
  const status = /not planned|^no .+ (?:are|is) planned|not in (?:the )?mvp/i.test(text) ? 'not_planned'
    : /under consideration|planned|roadmap|next/i.test(text) ? 'planned'
      : /currently|available|can /i.test(text) ? 'already_supported' : 'unknown';
  return { status, excerpt: text, heading: candidate.heading || 'Document text',
    url: doc.url, mode: doc.mode, title: doc.title };
}

const roadmapStatuses = new Set(['shipped', 'in_progress', 'planned', 'deferred', 'declined', 'proposed', 'blocked']);

export function productDecisionContext(text, doc, classification) {
  const words = value => ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const rows = (doc.sections || []).filter(section => /^ROADMAP\s*\|/i.test(section.text));
  const matched = rows.filter(section => {
    const aliases = section.text.split('|')[3] || '';
    return aliases.split(';').some(alias => /[a-z0-9]/i.test(alias) && words(text).includes(words(alias)));
  });
  if (!matched.length && (/(?:\b(?:can|could|should) product\b|\bfeature request\b|\bplease add\b)/i.test(text) ||
      (classification?.method === 'model' && classification.kind === 'request'))) {
    return { mode: doc.mode, title: doc.title, url: doc.url, status: 'unreviewed request',
      question: 'Should Product evaluate this request?' };
  }
  if (matched.length !== 1) return null;
  const section = matched[0];
  const fields = section.text.split('|').map(field => field.trim());
  const [, id, revision, , status, owner, deadline, action, question] = fields;
  if (fields.length !== 9 || !/^[a-z0-9-]+$/.test(id) || !/^[1-9]\d*$/.test(revision) ||
      rows.filter(row => row.text.split('|')[1]?.trim() === id).length !== 1 ||
      !roadmapStatuses.has(status) || !owner || !deadline ||
      (deadline !== 'TBD' && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
        !Number.isFinite(Date.parse(deadline)) || new Date(deadline).toISOString().slice(0, 10) !== deadline)) ||
      action !== 'founder_review' || !question || question === '-' ||
      !['proposed', 'blocked', 'in_progress', 'planned'].includes(status)) return null;
  return { id, revision, status, owner, deadline, question, excerpt: section.text,
    heading: 'Product roadmap', title: doc.title, url: doc.url, mode: doc.mode };
}
