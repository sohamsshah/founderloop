import { readConfig } from '../src/config.js';
import { loadProductDoc, matchProductDoc } from '../src/product.js';
import { loadRevenueSheet } from '../src/revenue.js';

const config = readConfig();
if (process.argv[2] === 'revenue') {
  const sheet = await loadRevenueSheet(config);
  console.log(`Revenue Sheet mode=${sheet.mode}; pipeline=${Boolean(sheet.pipeline)}; rows=${sheet.rows.length}`);
  if (sheet.reason) console.error(sheet.reason);
  if (!sheet.pipeline || sheet.mode === 'unavailable') process.exitCode = 1;
} else {
  const doc = await loadProductDoc(config);
  console.log(`Product Doc mode=${doc.mode}; sections=${doc.sections.length}; title=${doc.title || 'unavailable'}`);
  if (doc.mode === 'unavailable') console.log(`Read error=${doc.reason}`);
  if (doc.mode !== 'unavailable') {
    const match = matchProductDoc({ topic: 'exports' }, doc);
    console.log(`Exports context status=${match.status}; heading=${match.heading || 'none'}; excerpt present=${Boolean(match.excerpt)}`);
  }
}
