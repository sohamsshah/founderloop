import { readConfig } from '../src/config.js';
import { loadProductDoc, matchProductDoc } from '../src/product.js';

const config = readConfig();
const doc = await loadProductDoc(config);
console.log(`Product Doc mode=${doc.mode}; sections=${doc.sections.length}; title=${doc.title || 'unavailable'}`);
if (doc.mode === 'unavailable') console.log(`Read error=${doc.reason}`);
if (doc.mode !== 'unavailable') {
  const match = matchProductDoc({ topic: 'exports' }, doc);
  console.log(`Exports context status=${match.status}; heading=${match.heading || 'none'}; excerpt present=${Boolean(match.excerpt)}`);
}
