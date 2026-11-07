import { classifyProduct } from './product.js';

export function classifySignals(text) {
  if (typeof text !== 'string' || text.length < 8) return [];
  const lower = text.toLowerCase();
  if (/ignore (all|previous) instructions|reveal .*secret|paste .*discussions/.test(lower)) return [];

  const signals = [];
  const product = classifyProduct(text);
  if (product) signals.push(product);

  const revenueIntent = /\b(pricing|price|quote|proposal|buy|purchase|paid plan|enterprise plan|evaluation|trial|demo|procurement|contract)\b/i.test(text);
  const revenueAction = /\b(can we|could we|we (?:want|need|are looking)|interested|how much|send|schedule|start|discuss)\b/i.test(text);
  if (revenueIntent && revenueAction) {
    const topic = /\bsso\b/i.test(text) ? 'SSO evaluation' : /\benterprise\b/i.test(text) ? 'enterprise evaluation' : 'buying inquiry';
    signals.push({ category: 'REVENUE', kind: 'buying_signal', topic, confidence: 0.78,
      assessment: 'This message contains a possible buying signal. The founder should decide whether Sales should act.' });
  }

  const promise = /\b(we will|we'll|i will|i'll)\s+(investigate|look into|send|share|fix|follow up|update|check|restore|resolve)\b/i.test(text);
  const issue = /\b(outage|data loss|blocked|cannot access|can't access|failing|broken|not working|support|urgent|incident)\b/i.test(text);
  if (promise || issue) {
    signals.push({ category: 'COMMITMENT', kind: promise ? 'explicit_company_promise' : 'customer_issue_only',
      topic: promise ? 'explicit promise' : 'customer issue', confidence: promise ? 0.88 : 0.72,
      assessment: promise ? 'The original message contains an explicit promise to investigate or respond.'
        : 'The original message reports a customer-facing issue. No company promise is inferred.' });
  }
  return signals;
}

export function commitmentDecisionContext(event, config) {
  const text = event.text;
  const promise = /\b(?:we will|we'll|i will|i'll)\s+(?:investigate|look into|send|share|fix|follow up|update|check|restore|resolve)\b/i.test(text);
  const deadline = text.match(/\b(?:by|before)\s+(?:\d{4}-\d{2}-\d{2}|(?:end of day|EOD|tomorrow|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)?.[0];
  const sender = event.platform_sender_id || event.sender_id;
  const trusted = event.source_mode === 'simulated' || config.commitmentStaffIds?.includes(sender);
  if (promise && deadline && trusted) {
    return { kind: 'explicit_company_promise', deadline, mode: event.source_mode };
  }
  const impact = /\b(?:outage|data loss|security incident|customers? (?:are blocked|cannot access|can't access)|(?:cannot|can't) access (?:(?:our|their) accounts?|the product))\b/i.test(text);
  if (impact) return { kind: 'customer_issue_only', deadline: null, mode: event.source_mode };
  return null;
}
