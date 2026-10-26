import { env, requestURL } from '../lib/server-env';
import { getChatGPTUser } from './chatgpt-auth';
import { tokenHash } from '../lib/auth-password.mjs';

export function sessionCookieName(request: Request) {
  return requestURL(request).protocol === 'https:' ? '__Host-roskins_session' : 'roskins_session';
}
export function sessionToken(request: Request): string | null {
  const name = sessionCookieName(request);
  const value = (request.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
export async function getPlazaUser(request: Request) {
  const token = sessionToken(request);
  if (token && env.DB) {
    const row = await env.DB.prepare('SELECT a.id FROM roskins_sessions s JOIN roskins_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(tokenHash(token), Date.now()).first<{ id: string }>();
    if (row) return { userId: row.id, email: '', displayName: '', fullName: null, provider: 'roskins' as const };
  }
  const user = await getChatGPTUser();
  return user ? { ...user, provider: 'chatgpt' as const } : null;
}
