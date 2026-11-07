import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const cache = new Map();

export async function getGoogleToken(config, scope, fetcher = fetch) {
  if (config.googleToken) return config.googleToken;
  if (!config.googleCredentialsPath) return null;
  const key = `${config.googleCredentialsPath}:${scope}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const account = JSON.parse(await readFile(config.googleCredentialsPath, 'utf8'));
  if (account.type !== 'service_account' || !account.client_email || !account.private_key) {
    throw new Error('Invalid Google service account file');
  }
  const audience = 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', typ: 'JWT', kid: account.private_key_id });
  const claim = encode({ iss: account.client_email, scope, aud: audience, iat: now, exp: now + 3600 });
  const unsigned = `${header}.${claim}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` });
  const response = await fetcher(audience, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Google OAuth HTTP ${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error('Google OAuth response lacked access token');
  cache.set(key, { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 });
  return data.access_token;
}
