import { classifyProduct } from './product.js';

export function isIncidentReport(text) {
  if (typeof text !== 'string') return false;
  const symptom = /\b(?:down|offline|unreachable|unavailable|outage|broken|hacked|compromised|data loss|(?:data|security) (?:leak|breach)|security incident|crash(?:ed|es|ing)?|not (?:working|loading|responding)|stopped working|timing out|(?:http|error) 5\d\d)\b/i;
  return text.split(/\r?\n|(?<=[.!?])\s+/).some(part => {
    const statement = part.trim();
    return symptom.test(statement) && !/[?!]*\?[?!]*$/.test(statement) &&
      !/^(?:if|what if|in case)\b/i.test(statement) &&
      !/\b(?:no outage|not (?:down|broken|hacked|offline)|down to|(?:down|offline|unavailable) for (?:(?:planned|scheduled) )?maintenance|back (?:up|online)|resolved now)\b/i.test(statement);
  });
}

export function founderRequest(text) {
  const leader = /\b(?:co[- ]?founders?|founders?|ceo|leadership|leaders)\b/i;
  const ask = /\b(?:want(?:ed)?|need(?:s|ed)?|would (?:like|love)|looking|hope|can|could|may i|please|request(?:ing)?|asking|any chance|set up|schedule|arrange|put me in touch)\b/i;
  const action = /\b(?:contact|connect|meet(?:ing)?|talk|speak|chat|call|intro(?:duce|duction)?|in touch|reach out|reply|respond|review|check|approve|decide|decision|discuss|help|take a look|take action|follow up|feedback|input|attention|sign[- ]?off)\b/i;
  const imperative = /(?:^|[.!?]\s+)(?:(?:urgent|asap)\s*[:–—-]\s*)?(?:contact|connect|introduce|call|ask|tell|send|loop in)\b/i;
  const companyMatter = /\b(?:investor|funding|partnership|press|legal|business opportunity)\b/i.test(text) &&
    /\b(?:urgent|important|strategic|time[- ]sensitive|confidential)\b/i.test(text);
  if (!(leader.test(text) || companyMatter) || !action.test(text) || !(ask.test(text) || imperative.test(text))) return null;
  return { category: 'GENERAL', kind: 'founder_request', topic: 'founder request', confidence: 0.9,
    assessment: 'The sender is asking for the founder or leadership to respond or take action.' };
}

export function classifySignals(text) {
  if (typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  if (/ignore (all|previous) instructions|reveal .*secret|paste .*discussions/.test(lower)) return [];

  const signals = [];
  const product = classifyProduct(text);
  if (product) signals.push(product);
  const general = founderRequest(text);
  if (general) signals.push(general);

  const revenueIntent = /\b(pricing|price|quote|proposal|buy|purchase|paid plan|enterprise plan|evaluation|trial|demo|procurement|contract)\b/i.test(text);
  const revenueAction = /\b(can we|could we|we (?:want|need|are looking)|interested|how much|send|schedule|start|discuss)\b/i.test(text);
  if (revenueIntent && revenueAction) {
    const topic = /\bsso\b/i.test(text) ? 'SSO evaluation' : /\benterprise\b/i.test(text) ? 'enterprise evaluation' : 'buying inquiry';
    signals.push({ category: 'REVENUE', kind: 'buying_signal', topic, confidence: 0.78,
      assessment: 'This message contains a possible buying signal. The founder should decide whether Sales should act.' });
  }

  const promise = /\b(we will|we'll|i will|i'll)\s+(investigate|look into|send|share|fix|follow up|update|check|restore|resolve)\b/i.test(text);
  if (isIncidentReport(text)) {
    signals.push({ category: 'COMMITMENT', kind: 'active_incident', topic: 'reported incident', confidence: 0.9,
      assessment: 'The source reports a possible outage, breakage, or security incident.' });
  } else if (promise || /\b(blocked|cannot access|can't access|failing|support|urgent|incident)\b/i.test(text)) {
    signals.push({ category: 'COMMITMENT', kind: promise ? 'explicit_company_promise' : 'customer_issue_only',
      topic: promise ? 'explicit promise' : 'customer issue', confidence: promise ? 0.88 : 0.72,
      assessment: promise ? 'The original message contains an explicit promise to investigate or respond.'
        : 'The original message reports a customer-facing issue. No company promise is inferred.' });
  }
  return signals;
}

export function commitmentDecisionContext(event, config, classification) {
  if (classification?.kind === 'active_incident') {
    return { kind: 'customer_issue_only', deadline: null, mode: event.source_mode, incident: true };
  }
  const text = event.text;
  const promise = /\b(?:we will|we'll|i will|i'll)\s+(?:investigate|look into|send|share|fix|follow up|update|check|restore|resolve)\b/i.test(text);
  const deadline = text.match(/\b(?:by|before)\s+(?:\d{4}-\d{2}-\d{2}|(?:end of day|EOD|tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)?.[0];
  const sender = event.platform_sender_id || event.sender_id;
  const trusted = event.source_mode === 'simulated' || config.commitmentStaffIds?.includes(sender);
  if (promise && trusted && (deadline || /\b(?:customers?|clients?|accounts?|issue|incident|refund|delivery)\b/i.test(text))) {
    return { kind: 'explicit_company_promise', deadline, mode: event.source_mode };
  }
  const impact = /\b(?:customers? (?:(?:is|are) (?:blocked|locked out|unable to access)|cannot access|can't access)|(?:cannot|can't) access (?:(?:our|their) accounts?|the product))\b/i.test(text);
  if (impact) return { kind: 'customer_issue_only', deadline: null, mode: event.source_mode };
  return null;
}
