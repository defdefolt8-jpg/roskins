import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function authConfig() {
  const vars = env as unknown as Record<string, unknown>;
  const url = String(vars.SUPABASE_URL || '').trim();
  const key = String(vars.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const site = String(vars.PUBLIC_SITE_URL || '').trim();
  if (!url || !key || !site) return null;
  try {
    const provider = new URL(url), origin = new URL(site);
    if (provider.protocol !== 'https:' || origin.protocol !== 'https:') return null;
    if (provider.username || provider.password || origin.username || origin.password) return null;
    if (provider.pathname !== '/' || provider.search || provider.hash || origin.pathname !== '/' || origin.search || origin.hash) return null;
    // Only a public client key is appropriate here; never use a service-role key.
    if (!key.startsWith('sb_publishable_')) {
      try {
        const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.role !== 'anon') return null;
      } catch { return null; }
    }
    return { url: provider.origin, key, origin: origin.origin, google: vars.GOOGLE_AUTH_ENABLED === 'true' };
  } catch { return null; }
}

export async function authClient() {
  const config = authConfig();
  if (!config) throw new AuthError(503, 'Вход по почте и Google временно недоступен.');
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { name: 'roskins-auth', path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => { for (const { name, value, options } of values) jar.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: 'lax', path: '/' }); },
    },
  });
}

export function authResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}

export function authRedirect(path: string) {
  const config = authConfig();
  if (!config) return authResponse({ error: 'Вход временно недоступен.' }, 503);
  return new Response(null, { status: 303, headers: { Location: new URL(path, config.origin).href, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}

export function checkAuthOrigin(request: Request) {
  const config = authConfig();
  if (!config) throw new AuthError(503, 'Вход по почте и Google временно недоступен.');
  if (new URL(request.url).origin !== config.origin || request.headers.get('origin') !== config.origin) throw new AuthError(403, 'Недопустимый источник запроса.');
  return config;
}

export function authFailure(error: unknown) {
  return error instanceof AuthError ? authResponse({ error: error.message }, error.status) : authResponse({ error: 'Сервис входа временно недоступен. Попробуй позже.' }, 503);
}
