import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('all-category CLI demo skips held signals and closes each expected card', () => {
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  const output = execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', cli, 'demo'], { encoding: 'utf8' });
  assert.match(output, /SIMULATED FIXTURE REPLAY/);
  for (const room of ['product', 'sales', 'support', 'founder']) {
    assert.match(output, new RegExp(`Internal verdict in simulated fixture-${room}-room`));
  }
  assert.match(output, /Cards: 4; outbound posts: 8; all closed: true/);
});
