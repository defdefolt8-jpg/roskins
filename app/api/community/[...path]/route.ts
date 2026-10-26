import { env, requestURL } from '../../../../lib/server-env';
import { getPlazaUser, sessionToken } from '../../../plaza-auth';
import { CATALOG } from '../../../../lib/plaza-model.mjs';
import { tokenHash } from '../../../../lib/auth-password.mjs';
import { deliverPush, isPushEndpoint } from '../../../../lib/push-delivery.mjs';

export const dynamic = 'force-dynamic';
type DB = NonNullable<typeof env.DB>;
type Row = Record<string, unknown>;
class Problem extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (status: number, message: string): never => { throw new Problem(status, message); };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
function database(): DB { if (!env.DB) fail(503, 'База временно недоступна'); return env.DB!; }
function string(value: unknown, min = 1, max = 64) { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, 'Проверь длину текста'); return (value as string).trim(); }
function identifier(value: unknown) { const result = string(value); if (!/^[A-Za-z0-9_-]+$/.test(result)) fail(400, 'Некорректный идентификатор'); return result; }
const actionOf = (request: Request) => requestURL(request).pathname.replace(/^\/api\/community\//, '').replace(/\/$/, '');
const settings = () => env as unknown as Record<string, string>;
const listingSelect = 'SELECT l.*,p.nickname,p.roblox,COALESCE(m.hidden,0) AS hidden,m.reason AS moderation_reason FROM plaza_listings l JOIN profiles p ON p.id=l.owner_id LEFT JOIN plaza_listing_moderation m ON m.listing_id=l.id';
const parseListing = (row: Row) => ({ ...row, have: JSON.parse(String(row.have)), want: JSON.parse(String(row.want)) });
async function ensureProfile(db: DB, user: NonNullable<Awaited<ReturnType<typeof getPlazaUser>>>) {
  await db.prepare('INSERT OR IGNORE INTO profiles (id,nickname,email,roblox,created_at) VALUES (?,?,?,?,?)').bind(user.userId, 'player_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12), user.email || '', '', Date.now()).run();
}
async function permission(db: DB, uid: string) {
  const role = await db.prepare('SELECT role FROM plaza_roles WHERE user_id=?').bind(uid).first<{ role: string }>();
  const ban = await db.prepare('SELECT banned,reason FROM plaza_user_moderation WHERE user_id=?').bind(uid).first<{ banned: number; reason: string }>();
  return { role: role?.role || 'member', banned: Boolean(ban?.banned), banReason: ban?.banned ? ban.reason : '' };
}
async function principal(request: Request) {
  const user = await getPlazaUser(request); if (!user) fail(401, 'Войди в аккаунт');
  const db = database(); await ensureProfile(db, user!); const access = await permission(db, user!.userId);
  return { db, user: user!, uid: user!.userId, access };
}
function requireAdmin(access: { role: string; banned: boolean }) { if (access.banned || access.role !== 'admin') fail(403, 'Только для администратора'); }
async function rate(db: DB, key: string, max: number, seconds = 60) {
  const now = Date.now(), bucket = Math.floor(now / (seconds * 1000));
  const row = await db.prepare('INSERT INTO roskins_auth_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(tokenHash(`community:${key}:${bucket}`), (bucket + 2) * seconds * 1000).first<{ count: number }>();
  if (!row || row.count > max) fail(429, 'Слишком много действий. Попробуй чуть позже.');
}
export async function GET(request: Request) {
  try {
    const url = requestURL(request), action = actionOf(request);
    if (action === 'roblox-profile') {
      const name = string(url.searchParams.get('username'), 3, 20);
      if (!/^[A-Za-z0-9_]+$/.test(name)) fail(400, 'Проверь username Roblox');
      const db = database(); await rate(db, 'roblox:shared-pilot', 30);
      let cached = await db.prepare('SELECT roblox_id FROM plaza_roblox_cache WHERE username=? AND expires_at>?').bind(name.toLowerCase(), Date.now()).first<{ roblox_id: string }>();
      if (!cached) {
        const remote = await fetch('https://users.roblox.com/v1/usernames/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }), signal: AbortSignal.timeout(5000), redirect: 'manual' });
        if (!remote.ok) fail(502, 'Roblox временно не отвечает. Попробуй позже.');
        const payload = await remote.json() as { data?: { id?: number; name?: string; requestedUsername?: string }[] };
        const found = payload.data?.find(row => (row.requestedUsername || row.name || '').toLowerCase() === name.toLowerCase());
        if (!found?.id || !Number.isSafeInteger(found.id) || found.id < 1) fail(404, 'Игрок с таким username не найден в Roblox');
        cached = { roblox_id: String(found!.id) };
        await db.prepare('INSERT INTO plaza_roblox_cache (username,roblox_id,expires_at) VALUES (?,?,?) ON CONFLICT(username) DO UPDATE SET roblox_id=excluded.roblox_id,expires_at=excluded.expires_at').bind(name.toLowerCase(), cached.roblox_id, Date.now() + 86400000).run();
      }
      if (!/^\d+$/.test(cached!.roblox_id)) fail(502, 'Не удалось открыть профиль');
      return Response.redirect('https://www.roblox.com/users/' + cached!.roblox_id + '/profile', 302);
    }
    const { db, user, uid, access } = await principal(request);
    if (action === 'me') {
      const bookmarks = await db.prepare('SELECT listing_id FROM plaza_bookmarks WHERE user_id=? ORDER BY created_at DESC LIMIT 300').bind(uid).all<Row>();
      const count = await db.prepare('SELECT COUNT(*) AS n FROM plaza_notifications WHERE user_id=? AND read_at=0').bind(uid).first<{ n: number }>();
      return json({ ...access, favorites: bookmarks.results.map(row => row.listing_id), unread: count?.n || 0, pushConfigured: Boolean(settings().ROSKINS_VAPID_PUBLIC_KEY), pushEligible: user.provider === 'roskins' });
    }
    if (action === 'favorites') {
      const rows = await db.prepare(listingSelect + ' JOIN plaza_bookmarks b ON b.listing_id=l.id WHERE b.user_id=? AND COALESCE(m.hidden,0)=0 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation um WHERE um.user_id=l.owner_id AND um.banned=1) ORDER BY b.created_at DESC LIMIT 300').bind(uid).all<Row>();
      return json({ listings: rows.results.map(parseListing) });
    }
    if (action === 'searches') { const rows = await db.prepare('SELECT * FROM plaza_searches WHERE user_id=? ORDER BY created_at DESC LIMIT 10').bind(uid).all<Row>(); return json({ searches: rows.results }); }
    if (action === 'notifications') {
      const rows = await db.prepare('SELECT id,kind,ref_id,title,body,created_at,read_at FROM plaza_notifications WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 150').bind(uid).all<Row>();
      const count = await db.prepare('SELECT COUNT(*) AS n FROM plaza_notifications WHERE user_id=? AND read_at=0').bind(uid).first<{ n: number }>();
      return json({ notifications: rows.results, unread: count?.n || 0 });
    }
    if (action === 'listing') {
      const row = await db.prepare(listingSelect + ' WHERE l.id=? AND COALESCE(m.hidden,0)=0 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation um WHERE um.user_id=l.owner_id AND um.banned=1)').bind(identifier(url.searchParams.get('id'))).first<Row>();
      if (!row) fail(404, 'Объявление скрыто или больше недоступно');
      return json({ listing: parseListing(row!) });
    }
    if (action === 'push-config') {
      const token = sessionToken(request);
      const subscriptions = token ? await db.prepare('SELECT id FROM plaza_push_subscriptions WHERE user_id=? AND session_hash=?').bind(uid, tokenHash(token)).all<Row>() : { results: [] };
      return json({ publicKey: settings().ROSKINS_VAPID_PUBLIC_KEY || null, enabled: subscriptions.results.length > 0, eligible: user.provider === 'roskins' });
    }
    if (action.startsWith('admin/')) {
      requireAdmin(access);
      const query = (url.searchParams.get('q') || '').trim().slice(0, 40), search = '%' + query.replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_') + '%';
      if (action === 'admin/reports') {
        const rows = await db.prepare("SELECT r.*,p.nickname AS reporter_name,COALESCE(v.status,'open') AS review_status,v.note AS review_note,l.note AS listing_note,COALESCE(l.owner_id,CASE WHEN r.reporter_id=o.from_id THEN o.to_id ELSE o.from_id END) AS target_user_id,t.nickname AS target_nickname FROM plaza_reports r JOIN profiles p ON p.id=r.reporter_id LEFT JOIN plaza_report_review v ON v.report_id=r.id LEFT JOIN plaza_listings l ON l.id=r.listing_id LEFT JOIN plaza_offers o ON o.id=r.offer_id LEFT JOIN profiles t ON t.id=COALESCE(l.owner_id,CASE WHEN r.reporter_id=o.from_id THEN o.to_id ELSE o.from_id END) ORDER BY CASE WHEN v.status IS NULL OR v.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100").all<Row>();
        return json({ reports: rows.results });
      }
      if (action === 'admin/report-context') {
        const report = await db.prepare('SELECT offer_id FROM plaza_reports WHERE id=?').bind(identifier(url.searchParams.get('id'))).first<{ offer_id: string | null }>();
        if (!report) fail(404, 'Жалоба не найдена');
        const rows = report!.offer_id ? await db.prepare('SELECT p.nickname,m.body,m.created_at FROM plaza_messages m JOIN profiles p ON p.id=m.sender_id WHERE m.offer_id=? ORDER BY m.created_at DESC LIMIT 30').bind(report!.offer_id).all<Row>() : { results: [] };
        return json({ messages: rows.results.reverse() });
      }
      if (action === 'admin/users') {
        const rows = await db.prepare("SELECT p.id,p.nickname,p.roblox,p.created_at,COALESCE(m.banned,0) AS banned,m.reason,COALESCE(r.role,'member') AS role FROM profiles p LEFT JOIN plaza_user_moderation m ON m.user_id=p.id LEFT JOIN plaza_roles r ON r.user_id=p.id WHERE p.nickname LIKE ? ESCAPE '!' ORDER BY p.created_at DESC LIMIT 100").bind(search).all<Row>();
        return json({ users: rows.results });
      }
      if (action === 'admin/listings') {
        const rows = await db.prepare(listingSelect + " WHERE p.nickname LIKE ? ESCAPE '!' ORDER BY l.created_at DESC LIMIT 100").bind(search).all<Row>(); return json({ listings: rows.results.map(parseListing) });
      }
      if (action === 'admin/audit') {
        const rows = await db.prepare('SELECT a.*,p.nickname AS actor_name FROM plaza_audit a JOIN profiles p ON p.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100').all<Row>(); return json({ audit: rows.results });
      }
    }
    return json({ error: 'Раздел не найден' }, 404);
  } catch (e) {
    if (actionOf(request) === 'roblox-profile' && request.headers.get('Accept')?.includes('text/html')) {
      const status = e instanceof Problem ? e.status : 502;
      const message = e instanceof Problem && e.status === 404 ? 'В Roblox не найден игрок с таким username. Проверь имя в профиле Roskins.' : 'Сейчас не удалось получить профиль Roblox. Попробуй открыть его ещё раз немного позже.';
      return new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Профиль Roblox — Roskins</title><body style="background:#0b100d;color:#e0edd6;font:16px/1.7 system-ui;max-width:600px;padding:50px 24px;margin:auto"><h1>Не удалось открыть профиль Roblox</h1><p>${message}</p><p>Имя игрока введено пользователем Roskins; владение игровым аккаунтом не подтверждено.</p><a href="/" style="color:#b0fb72">Вернуться на трейд-плазу</a></body></html>`, {status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    return failure(e);
  }
}
async function mutate(request: Request) {
  try {
    if (request.headers.get('Origin') !== requestURL(request).origin) fail(403, 'Недопустимый источник запроса');
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) fail(415, 'Ожидается JSON');
    if (Number(request.headers.get('Content-Length') || 0) > 6000) fail(413, 'Слишком большой запрос');
    const raw = await request.text(); if (raw.length > 6000) fail(413, 'Слишком большой запрос');
    let body: Record<string, unknown>; try { body = JSON.parse(raw); } catch { return fail(400, 'Некорректный JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Некорректный запрос');
    const { db, user, uid, access } = await principal(request), action = actionOf(request), now = Date.now();
    if (action === 'notifications-read') {
      const itemId = body.id ? string(body.id, 1, 220) : null;
      await db.prepare('UPDATE plaza_notifications SET read_at=? WHERE user_id=? AND read_at=0 AND (? IS NULL OR id=?)').bind(now, uid, itemId, itemId).run(); return json({ ok: true });
    }
    if (action === 'push-disable') {
      const token = sessionToken(request);
      if (token) await db.prepare('DELETE FROM plaza_push_subscriptions WHERE user_id=? AND session_hash=?').bind(uid, tokenHash(token)).run();
      return json({ ok: true });
    }
    if (access.banned) fail(403, 'Аккаунт заблокирован: ' + access.banReason);
    await rate(db, uid, 80);
    if (action === 'favorite') {
      const listingId = identifier(body.listingId); if (typeof body.saved !== 'boolean') fail(400, 'Некорректное действие');
      if (!body.saved) { await db.prepare('DELETE FROM plaza_bookmarks WHERE user_id=? AND listing_id=?').bind(uid, listingId).run(); return json({ ok: true }); }
      const row = await db.prepare("SELECT id FROM plaza_listings WHERE id=? AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation WHERE listing_id=? AND hidden=1)").bind(listingId, listingId).first();
      if (!row) fail(404, 'Объявление недоступно');
      const result = await db.prepare('INSERT OR IGNORE INTO plaza_bookmarks (id,user_id,listing_id,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM plaza_bookmarks WHERE user_id=?)<300').bind(crypto.randomUUID(), uid, listingId, now, uid).run();
      if (!result.meta.changes && !(await db.prepare('SELECT id FROM plaza_bookmarks WHERE user_id=? AND listing_id=?').bind(uid, listingId).first())) fail(429, 'В избранном можно сохранить до 300 трейдов');
      return json({ ok: true });
    }
    if (action === 'search-save') {
      const pet = string(body.pet), variant = body.variant || 'any';
      if (!CATALOG.some(item => item.id === pet) || !['any', 'normal', 'neon', 'mega'].includes(String(variant)) || typeof body.readyOnly !== 'boolean' || ![-1, 0, 1].includes(Number(body.fly ?? -1)) || ![-1, 0, 1].includes(Number(body.ride ?? -1))) fail(400, 'Проверь параметры поиска');
      const fly = Number(body.fly ?? -1), ride = Number(body.ride ?? -1);
      if (CATALOG.find(item => item.id === pet)?.kind !== 'pet' && (fly === 1 || ride === 1 || !['any', 'normal'].includes(String(variant)))) fail(400, 'У этого предмета нет Neon/Mega и Fly/Ride');
      const duplicate = await db.prepare('SELECT id FROM plaza_searches WHERE user_id=? AND pet=? AND variant=? AND ready_only=? AND fly=? AND ride=?').bind(uid, pet, String(variant), body.readyOnly ? 1 : 0, fly, ride).first();
      if (duplicate) fail(409, 'Такой поиск уже сохранён');
      const result = await db.prepare('INSERT INTO plaza_searches (id,user_id,pet,variant,ready_only,fly,ride,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM plaza_searches WHERE user_id=?)<10 AND NOT EXISTS (SELECT 1 FROM plaza_searches WHERE user_id=? AND pet=? AND variant=? AND ready_only=? AND fly=? AND ride=?)').bind(crypto.randomUUID(), uid, pet, String(variant), body.readyOnly ? 1 : 0, fly, ride, now, uid, uid, pet, String(variant), body.readyOnly ? 1 : 0, fly, ride).run();
      if (!result.meta.changes) fail(429, 'Можно сохранить до 10 поисков'); return json({ ok: true }, 201);
    }
    if (action === 'search-delete') { await db.prepare('DELETE FROM plaza_searches WHERE id=? AND user_id=?').bind(identifier(body.id), uid).run(); return json({ ok: true }); }
    if (action === 'push-subscribe') {
      if (user.provider !== 'roskins' || !sessionToken(request)) fail(400, 'Для фоновых уведомлений нужен аккаунт Roskins');
      if (!settings().ROSKINS_VAPID_PUBLIC_KEY) fail(503, 'Фоновые уведомления пока не настроены');
      const endpoint = string(body.endpoint, 10, 2048); if (!isPushEndpoint(endpoint)) fail(400, 'Этот сервис push не поддерживается');
      const hash = tokenHash(sessionToken(request)!);
      await db.batch([
        db.prepare('DELETE FROM plaza_push_subscriptions WHERE user_id=? AND session_hash=?').bind(uid, hash),
        db.prepare('INSERT INTO plaza_push_subscriptions (id,user_id,endpoint,session_hash,created_at,last_sent_at) VALUES (?,?,?,?,?,0) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,created_at=excluded.created_at').bind(crypto.randomUUID(), uid, endpoint, hash, now),
        db.prepare('DELETE FROM plaza_push_subscriptions WHERE user_id=? AND id NOT IN (SELECT id FROM plaza_push_subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 3)').bind(uid, uid),
      ]);
      return json({ ok: true });
    }
    if (action === 'push-test') {
      const token = sessionToken(request); if (!token) fail(400, 'Войди в аккаунт Roskins');
      await rate(db, 'push-test:' + uid, 2);
      await db.prepare("INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at,read_at,push_state,push_at) VALUES (?,?,'system','','Проверка уведомлений','Уведомления Roskins подключены.',?,0,0,0)").bind(crypto.randomUUID(), uid, now).run();
      await deliverPush(db, settings(), uid); return json({ ok: true });
    }
    if (action.startsWith('admin/')) {
      requireAdmin(access);
      const targetId = identifier(body.id), reason = string(body.reason, 5, 500), auditId = crypto.randomUUID();
      if (action === 'admin/listing') {
        if (typeof body.hidden !== 'boolean') fail(400, 'Некорректное действие');
        const row = await db.prepare('SELECT owner_id FROM plaza_listings WHERE id=?').bind(targetId).first<{ owner_id: string }>(); if (!row) fail(404, 'Объявление не найдено');
        const work = [db.prepare('INSERT INTO plaza_listing_moderation (listing_id,hidden,reason,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(listing_id) DO UPDATE SET hidden=excluded.hidden,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(targetId, body.hidden ? 1 : 0, reason, uid, now)];
        if (body.hidden) work.push(db.prepare("UPDATE plaza_offers SET status=CASE WHEN status='accepted' THEN 'cancelled' ELSE 'declined' END,updated_at=? WHERE listing_id=? AND status IN ('pending','accepted')").bind(now, targetId));
        work.push(db.prepare('INSERT INTO plaza_audit (id,actor_id,action,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?,?,?)').bind(auditId, uid, body.hidden ? 'hide' : 'unhide', 'listing', targetId, reason, now));
        work.push(db.prepare("INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at,read_at,push_state,push_at) VALUES (?,?,'moderation',?,?,?,?,0,0,0)").bind(auditId, row!.owner_id, targetId, body.hidden ? 'Трейд скрыт модератором' : 'Трейд снова доступен', reason, now));
        await db.batch(work); return json({ ok: true });
      }
      if (action === 'admin/user') {
        if (typeof body.banned !== 'boolean') fail(400, 'Некорректное действие');
        if (!(await db.prepare('SELECT id FROM profiles WHERE id=?').bind(targetId).first())) fail(404, 'Пользователь не найден');
        if (targetId === uid || await db.prepare('SELECT user_id FROM plaza_roles WHERE user_id=?').bind(targetId).first()) fail(409, 'Нельзя блокировать себя или администратора');
        const work = [db.prepare('INSERT INTO plaza_user_moderation (user_id,banned,reason,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET banned=excluded.banned,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(targetId, body.banned ? 1 : 0, reason, uid, now)];
        if (body.banned) work.push(db.prepare("UPDATE plaza_offers SET status=CASE WHEN status='accepted' THEN 'cancelled' ELSE 'declined' END,updated_at=? WHERE (from_id=? OR to_id=?) AND status IN ('pending','accepted')").bind(now, targetId, targetId));
        work.push(db.prepare('INSERT INTO plaza_audit (id,actor_id,action,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?,?,?)').bind(auditId, uid, body.banned ? 'ban' : 'unban', 'user', targetId, reason, now));
        work.push(db.prepare("INSERT INTO plaza_notifications (id,user_id,kind,ref_id,title,body,created_at,read_at,push_state,push_at) VALUES (?,?,'moderation',?,?,?,?,0,0,0)").bind(auditId, targetId, targetId, body.banned ? 'Аккаунт заблокирован' : 'Блокировка снята', reason, now));
        await db.batch(work); return json({ ok: true });
      }
      if (action === 'admin/report') {
        if (!['open', 'resolved', 'dismissed'].includes(String(body.status))) fail(400, 'Неизвестный статус');
        if (!(await db.prepare('SELECT id FROM plaza_reports WHERE id=?').bind(targetId).first())) fail(404, 'Жалоба не найдена');
        await db.batch([
          db.prepare('INSERT INTO plaza_report_review (report_id,status,note,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(report_id) DO UPDATE SET status=excluded.status,note=excluded.note,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(targetId, String(body.status), reason, uid, now),
          db.prepare('INSERT INTO plaza_audit (id,actor_id,action,target_type,target_id,reason,created_at) VALUES (?,?,?,?,?,?,?)').bind(auditId, uid, String(body.status), 'report', targetId, reason, now),
        ]); return json({ ok: true });
      }
    }
    return json({ error: 'Действие не найдено' }, 404);
  } catch (e) { return failure(e); }
}
function failure(error: unknown) { if (error instanceof Problem) return json({ error: error.message }, error.status); console.error('community_api_error'); return json({ error: 'Не удалось выполнить действие. Попробуй ещё раз.' }, 500); }

export async function POST(request: Request) { const result = await mutate(request); if(result.ok && env.DB) { try { await deliverPush(env.DB, settings()); } catch { console.error('push_delivery_deferred'); } } return result; }
