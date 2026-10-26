import { env, requestURL } from '../../../../lib/server-env';
import { randomToken, tokenHash, hashPassword, verifyPassword } from '../../../../lib/auth-password.mjs';
import { sessionCookieName, sessionToken } from '../../../plaza-auth';
import { LEGAL_VERSION, legalReady } from '../../../../lib/legal-config';

export const dynamic = 'force-dynamic';
const LIFETIME = 7 * 86400000;
class Problem extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string): never => { throw new Problem(status, message); };
const reply = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
function cookie(request: Request, value: string, age = LIFETIME / 1000) {
  return `${sessionCookieName(request)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${requestURL(request).protocol === 'https:' ? '; Secure' : ''}`;
}
function field(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== 'string' || value.length < min || value.length > max) fail(400, label);
  return value as string;
}
function loginField(value: unknown) {
  const name = field(value, 3, 24, 'Ник: от 3 до 24 символов').trim();
  if (!/^[A-Za-z0-9_]{3,24}$/.test(name)) fail(400, 'Ник: латинские буквы, цифры и _');
  return name;
}
function passwordField(value: unknown) { return field(value, 10, 128, 'Пароль: от 10 до 128 символов'); }
export async function POST(request: Request) {
  try {
    const url = requestURL(request), action = url.pathname.split('/').filter(Boolean).at(-1);
    if (request.headers.get('Origin') !== url.origin) fail(403, 'Недопустимый источник запроса');
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, 'Ожидается JSON');
    if (Number(request.headers.get('Content-Length') || 0) > 4096) fail(413, 'Слишком большой запрос');
    const raw = await request.text(); if (raw.length > 4096) fail(413, 'Слишком большой запрос');
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return fail(400, 'Некорректный запрос'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Некорректный запрос');
    const db = env.DB; if (!db) fail(503, 'База временно недоступна');
    const now = Date.now();
    if (action === 'logout') {
      const token = sessionToken(request);
      if (token) await db!.batch([db!.prepare('DELETE FROM plaza_push_subscriptions WHERE session_hash=?').bind(tokenHash(token)), db!.prepare('DELETE FROM roskins_sessions WHERE token_hash=?').bind(tokenHash(token))]);
      return reply({ ok: true }, 200, cookie(request, '', 0));
    }
    if (!['register', 'login', 'recover'].includes(action || '')) fail(404, 'Действие не найдено');
    const nickname = loginField(body.nickname), login = nickname.toLowerCase();
    const password = passwordField(body.password);
    // CF-Connecting-IP is supplied by Cloudflare; arbitrary forwarded headers are never trusted.
    const ip = 'shared-pilot';
    const bucket = Math.floor(now / 900000), expires = (bucket + 2) * 900000;
    for (const [scope, maximum] of [[`ip:${ip}`, action === 'register' ? 10 : 40], [`name:${login}`, 8]] as const) {
      const key = tokenHash(`${action}:${bucket}:${scope}`);
      const row = await db!.prepare('INSERT INTO roskins_auth_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, expires).first<{ count: number }>();
      if (!row || row.count > maximum) fail(429, 'Слишком много попыток. Попробуй через 15 минут.');
    }
    await db!.prepare('DELETE FROM roskins_auth_limits WHERE expires_at<?').bind(now).run();
    const token = randomToken(), tokenDigest = tokenHash(token);
    if (action === 'register') {
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (!legalReady && !local) fail(503, 'Регистрация временно закрыта. Готовимся к открытию.');
      if (body.termsAccepted !== true || body.legalVersion !== LEGAL_VERSION) fail(400, 'Прими актуальное соглашение и правила площадки');
      const roblox = field(body.roblox, 3, 20, 'Укажи username Roblox: от 3 до 20 символов').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(roblox)) fail(400, 'Проверь username Roblox');
      if (await db!.prepare('SELECT id FROM profiles WHERE lower(nickname)=?').bind(login).first()) fail(409, 'Этот ник уже занят');
      const uid = 'ros_' + crypto.randomUUID(), recovery = randomToken(), passwordHash = await hashPassword(password);
      try {
        await db!.batch([
          db!.prepare('INSERT INTO profiles (id,nickname,email,roblox,created_at) VALUES (?,?,?,?,?)').bind(uid, nickname, '', roblox, now),
          db!.prepare('INSERT INTO roskins_accounts (id,login,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?)').bind(uid, login, passwordHash, tokenHash(recovery), now),
          db!.prepare('INSERT INTO roskins_terms_acceptance (user_id,version,accepted_at) VALUES (?,?,?)').bind(uid, LEGAL_VERSION, now),
          db!.prepare('INSERT INTO roskins_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(tokenDigest, uid, now, now + LIFETIME),
        ]);
      } catch { return fail(409, 'Не удалось создать аккаунт. Попробуй другой ник.'); }
      return reply({ ok: true, recoveryCode: recovery }, 201, cookie(request, token));
    }
    const account = await db!.prepare('SELECT id,password_hash,recovery_hash FROM roskins_accounts WHERE login=?').bind(login).first<{ id: string; password_hash: string; recovery_hash: string }>();
    if (action === 'recover') {
      const recovery = field(body.recoveryCode, 43, 43, 'Проверь код восстановления');
      if (!account || tokenHash(recovery) !== account.recovery_hash) fail(401, 'Неверный ник или код восстановления');
      const nextRecovery = randomToken(), nextHash = await hashPassword(password);
      const results = await db!.batch([
        db!.prepare('UPDATE roskins_accounts SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').bind(nextHash, tokenHash(nextRecovery), account!.id, tokenHash(recovery)),
        // Insert only if this request won recovery-code rotation. Concurrent replays cannot mint a session.
        db!.prepare('DELETE FROM roskins_sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM roskins_accounts WHERE id=? AND recovery_hash=?)').bind(account!.id, account!.id, tokenHash(nextRecovery)),
        db!.prepare('INSERT INTO roskins_sessions (token_hash,user_id,created_at,expires_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM roskins_accounts WHERE id=? AND recovery_hash=?)').bind(tokenDigest, account!.id, now, now + LIFETIME, account!.id, tokenHash(nextRecovery)),
      ]);
      if (!results[0].meta.changes) fail(401, 'Код уже использован. Используй новый код.');
      return reply({ ok: true, recoveryCode: nextRecovery }, 200, cookie(request, token));
    }
    // Always perform the KDF for unknown users to avoid a fast username-existence oracle.
    const dummy = 'scrypt-v1$00000000000000000000000000000000$' + '0'.repeat(64);
    if (!(await verifyPassword(password, account?.password_hash || dummy)) || !account) fail(401, 'Неверный ник или пароль');
    const loginResults = await db!.batch([
      db!.prepare('DELETE FROM roskins_sessions WHERE user_id=? AND expires_at<=?').bind(account!.id, now),
      db!.prepare('INSERT INTO roskins_sessions (token_hash,user_id,created_at,expires_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM roskins_accounts WHERE id=? AND password_hash=?)').bind(tokenDigest, account!.id, now, now + LIFETIME, account!.id, account!.password_hash),
    ]);
    if (!loginResults[1].meta.changes) fail(401, 'Пароль изменился. Войди с новым паролем.');
    return reply({ ok: true }, 200, cookie(request, token));
  } catch (error) {
    if (error instanceof Problem) return reply({ error: error.message }, error.status);
    console.error('roskins_account_error'); return reply({ error: 'Не удалось выполнить действие. Попробуй ещё раз.' }, 500);
  }
}
