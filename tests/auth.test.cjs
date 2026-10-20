const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const origin = 'https://market.test';
const env = {};
const writtenCookies = [], calls = [];
let cookieOptions, verifiedUser = null, platformUser = null, providerError = null;
const fake = { auth: {
  getUser: async () => ({ data: { user: verifiedUser }, error: providerError }),
  signUp: async value => { calls.push(['signup', value]); return { data: {}, error: providerError }; },
  signInWithPassword: async value => { calls.push(['login', value]); return { data: { user: verifiedUser }, error: providerError }; },
  resetPasswordForEmail: async (...value) => { calls.push(['reset', value]); return { error: providerError }; },
  updateUser: async value => { calls.push(['password', value]); return { error: providerError }; },
  signOut: async value => { calls.push(['logout', value]); return { error: providerError }; },
  signInWithOAuth: async value => { calls.push(['google', value]); return { data: { url: 'https://provider.test/auth/v1/authorize' }, error: providerError }; },
  exchangeCodeForSession: async code => { calls.push(['exchange', code]); return { error: providerError }; },
  verifyOtp: async value => { calls.push(['verify', value]); return { error: providerError }; },
} };
function load(path, modules) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const scope = { exports: {}, require: name => { if (!(name in modules)) throw Error('Unexpected import ' + name); return modules[name]; }, URL, Request, Response, atob, console };
  vm.createContext(scope); vm.runInContext(code, scope); return scope.exports;
}
const auth = load('lib/auth.ts', {
  'cloudflare:workers': { env },
  'next/headers': { cookies: async () => ({ getAll: () => [{ name: 'untrusted', value: 'fake' }], set: (...args) => writtenCookies.push(args) }) },
  '@supabase/ssr': { createServerClient: (_url, _key, options) => { cookieOptions = options; return fake; } },
});
const route = load('app/api/auth/[action]/route.ts', { '../../../../lib/auth': auth });
const callback = load('app/auth/callback/route.ts', { '../../../lib/auth': auth });
const confirm = load('app/auth/confirm/route.ts', { '../../../lib/auth': auth });
const market = load('app/market-auth.ts', { '../lib/auth': auth, './chatgpt-auth': { getChatGPTUser: async () => platformUser } });
function configure() { Object.assign(env, { SUPABASE_URL: 'https://provider.test', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', PUBLIC_SITE_URL: origin, GOOGLE_AUTH_ENABLED: 'true' }); }
async function post(action, body = {}, requestOrigin = origin, raw) {
  const r = await route.POST(new Request(origin + '/api/auth/' + action, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: raw === undefined ? JSON.stringify(body) : raw }));
  return { status: r.status, body: await r.json() };
}
(async () => {
  let response = await route.GET(new Request(origin + '/api/auth/status'));
  assert.equal((await response.json()).email, false);
  assert.equal((await post('signup', { email: 'user@test.invalid', password: 'long-secret-password' })).status, 503);
  configure();
  assert.equal(auth.authConfig().origin, origin);
  env.SUPABASE_PUBLISHABLE_KEY = 'sb_secret_admin'; assert.equal(auth.authConfig(), null);
  env.SUPABASE_PUBLISHABLE_KEY = 'a.' + Buffer.from('{"role":"service_role"}').toString('base64url') + '.z'; assert.equal(auth.authConfig(), null);
  configure(); env.PUBLIC_SITE_URL = 'https://evil.test/path'; assert.equal(auth.authConfig(), null);
  configure(); env.SUPABASE_URL = 'http://provider.test'; assert.equal(auth.authConfig(), null); configure();
  await auth.authClient();
  assert.equal(cookieOptions.cookieOptions.httpOnly, true);
  cookieOptions.cookies.setAll([{ name: 'session', value: 'token', options: { httpOnly: false, secure: false, sameSite: 'none' } }]);
  assert.equal(writtenCookies[0][2].httpOnly, true); assert.equal(writtenCookies[0][2].secure, true); assert.equal(writtenCookies[0][2].sameSite, 'lax');
  assert.equal((await post('login', {}, 'https://evil.test')).status, 403);
  assert.equal((await post('google', {}, '')).status, 403);
  assert.equal((await post('signup', {}, origin, '{bad')).status, 400);
  assert.equal((await post('signup', {}, origin, JSON.stringify({ data: 'x'.repeat(4200) }))).status, 413);
  assert.equal((await post('signup', { email: 'not-email', password: 'long-secret-password' })).status, 400);
  assert.equal((await post('signup', { email: 'user@test.invalid', password: 'short' })).status, 400);
  assert.equal((await post('signup', { email: 'User@Test.invalid', password: 'long-secret-password' })).status, 200);
  assert.equal(calls.at(-1)[1].email, 'user@test.invalid');
  assert.equal(calls.at(-1)[1].options.emailRedirectTo, origin + '/auth/callback');
  assert.equal((await post('login', { email: 'user@test.invalid', password: 'password' })).status, 401);
  verifiedUser = { id: 'verified', email: 'user@test.invalid', email_confirmed_at: null, app_metadata: { provider: 'email' } };
  assert.equal((await market.getMarketUser()), null);
  assert.equal((await post('login', { email: 'user@test.invalid', password: 'password' })).status, 401);
  verifiedUser.email_confirmed_at = '2026-10-20';
  assert.equal((await post('login', { email: 'user@test.invalid', password: 'password' })).status, 200);
  assert.equal((await market.getMarketUser()).userId, 'supabase:verified');
  assert.equal((await market.getMarketUser()).authProvider, 'email');
  verifiedUser.app_metadata.provider = 'google'; assert.equal((await market.getMarketUser()).authProvider, 'google');
  providerError = { status: 401 }; assert.equal((await market.getMarketUser()), null);
  platformUser = { userId: 'platform', email: 'platform@test.invalid' }; assert.equal((await market.getMarketUser()).userId, 'platform');
  platformUser = null; providerError = null;
  assert.equal((await post('reset', { email: 'unknown@test.invalid' })).status, 200);
  verifiedUser = null; assert.equal((await post('password', { password: 'new-long-password' })).status, 401);
  verifiedUser = { id: 'verified', email: 'user@test.invalid', email_confirmed_at: '2026-10-20', app_metadata: {} };
  assert.equal((await post('password', { password: 'new-long-password' })).status, 200);
  assert.equal((await post('logout')).status, 200);
  env.GOOGLE_AUTH_ENABLED = 'false'; assert.equal((await post('google')).status, 503); env.GOOGLE_AUTH_ENABLED = 'true';
  assert.equal((await post('google')).body.url, 'https://provider.test/auth/v1/authorize');
  assert.equal(calls.at(-1)[1].options.redirectTo, origin + '/auth/callback');
  const count = calls.length;
  response = await callback.GET(new Request(origin + '/auth/callback?next=https://evil.test'));
  assert.equal(response.headers.get('location'), origin + '/?auth=error'); assert.equal(calls.length, count);
  response = await callback.GET(new Request(origin + '/auth/callback?code=valid&next=https://evil.test'));
  assert.equal(response.headers.get('location'), origin + '/?auth=success');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  response = await confirm.GET(new Request(origin + '/auth/confirm?type=admin&token_hash=fake'));
  assert.equal(response.headers.get('location'), origin + '/?auth=error');
  response = await confirm.GET(new Request(origin + '/auth/confirm?type=recovery&token_hash=valid'));
  assert.equal(response.headers.get('location'), origin + '/?auth=recovery');
  providerError = { status: 400 };
  response = await confirm.GET(new Request(origin + '/auth/confirm?type=email&token_hash=expired'));
  assert.equal(response.headers.get('location'), origin + '/?auth=error');
  providerError = { status: 429 };
  assert.equal((await post('signup', { email: 'user@test.invalid', password: 'long-secret-password' })).status, 429);
  assert.equal((await post('reset', { email: 'user@test.invalid' })).status, 429);
  console.log('Passed: auth config, public keys only, secure cookies, CSRF, validation, verified identities, provider errors, recovery, PKCE callback wiring and redirect allowlist (mock provider).');
})().catch(e => { console.error(e); process.exitCode = 1; });
