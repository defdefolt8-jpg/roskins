import { env, requestURL } from '../../../../lib/server-env';
import { getPlazaUser } from '../../../plaza-auth';
import { deliverPush } from '../../../../lib/push-delivery.mjs';
import { CATALOG, validateItems, containsItems, matchListings } from '../../../../lib/plaza-model.mjs';

export const dynamic = 'force-dynamic';
type DB = NonNullable<typeof env.DB>;
type Row = Record<string, unknown>;
type Item = { pet: string; variant: string; fly: boolean; ride: boolean; quantity: number };
const DAY = 86400000, READY = 600000;
class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const bad = (status: number, message: string): never => { throw new HttpError(status, message); };
const response = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
function database(): DB { if (!env.DB) bad(503, 'База данных временно недоступна'); return env.DB!; }
function text(value: unknown, max: number, min = 0) { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) bad(400, 'Проверь длину текста'); return (value as string).trim(); }
function id(value: unknown) { const result = text(value, 64, 1); if (!/^[a-zA-Z0-9_-]+$/.test(result)) bad(400, 'Некорректный идентификатор'); return result; }
function items(value: unknown, allowEmpty = false): Item[] { try { return validateItems(value, { allowEmpty }); } catch (e) { return bad(400, e instanceof Error ? e.message : 'Некорректные предметы'); } }
function parseItems(value: unknown): Item[] { return JSON.parse(String(value)); }
function listing(row: Row): Row & { have: Item[]; want: Item[] } { return { ...row, have: parseItems(row.have), want: parseItems(row.want) }; }
function offer(row: Row) { return { ...row, have: parseItems(row.have), want: parseItems(row.want), from_confirmed: Boolean(row.from_confirmed), to_confirmed: Boolean(row.to_confirmed) }; }
const listingSelect = 'SELECT l.*,p.nickname,p.roblox,COALESCE(lm.hidden,0) AS hidden,lm.reason AS moderation_reason FROM plaza_listings l JOIN profiles p ON p.id=l.owner_id LEFT JOIN plaza_listing_moderation lm ON lm.listing_id=l.id';
const visible = " AND COALESCE(lm.hidden,0)=0 AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation um WHERE um.user_id=l.owner_id AND um.banned=1)";
const offerSelect = 'SELECT o.*,f.nickname AS from_nickname,t.nickname AS to_nickname,f.roblox AS from_roblox,t.roblox AS to_roblox FROM plaza_offers o JOIN profiles f ON f.id=o.from_id JOIN profiles t ON t.id=o.to_id';
async function profile(db: DB, user: NonNullable<Awaited<ReturnType<typeof getPlazaUser>>>) {
  await db.prepare('INSERT OR IGNORE INTO profiles (id,nickname,email,roblox,created_at) VALUES (?,?,?,?,?)').bind(user.userId, 'player_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12), user.email || '', '', Date.now()).run();
  const row = await db.prepare('SELECT id,nickname,roblox FROM profiles WHERE id=?').bind(user.userId).first<Row>();
  if (!row) bad(503, 'Не удалось загрузить профиль'); return row!;
}
async function participant(db: DB, offerId: string, uid: string) {
  const row = await db.prepare('SELECT * FROM plaza_offers WHERE id=? AND (from_id=? OR to_id=?)').bind(offerId, uid, uid).first<Row>();
  if (!row) bad(404, 'Предложение не найдено'); return row!;
}
const actionOf = (request: Request) => requestURL(request).pathname.replace(/^\/api\/plaza\//, '').replace(/\/$/, '');
export async function GET(request: Request) {
  try {
    const url = requestURL(request), action = actionOf(request);
    if (action === 'catalog') return response({ catalog: CATALOG, maxKinds: 6, maxQuantity: 18, listingLifetime: DAY, readyLifetime: READY });
    const db = database(), now = Date.now();
    if (action === 'listings') {
      const limitRaw = url.searchParams.get('limit') || '100';
      if (!/^\d+$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 100) bad(400, 'Лимит от 1 до 100');
      const pet = url.searchParams.get('pet') || '', variant = url.searchParams.get('variant') || '';
      if (pet && !CATALOG.some(p => p.id === pet)) bad(400, 'Неизвестный предмет');
      if (variant && !['normal', 'neon', 'mega'].includes(variant)) bad(400, 'Неизвестный вариант');
      const fly = url.searchParams.get('fly'), ride = url.searchParams.get('ride');
      if ((fly !== null && !['0','1'].includes(fly)) || (ride !== null && !['0','1'].includes(ride))) bad(400, 'Некорректный фильтр Fly/Ride');
      const beforeRaw = url.searchParams.get('before'), before = beforeRaw ? Number(beforeRaw) : now + 1;
      if (!Number.isSafeInteger(before) || before < 0) bad(400, 'Некорректный курсор');
      const rows = await db.prepare(listingSelect + " WHERE l.status='active' AND l.expires_at>? AND l.created_at<?" + visible + " ORDER BY l.created_at DESC,l.id DESC LIMIT 500").bind(now, before).all<Row>();
      const selected = rows.results.map(listing).filter(row => row.have.some(i => (!pet || i.pet === pet) && (!variant || i.variant === variant) && (fly === null || Number(i.fly) === Number(fly)) && (ride === null || Number(i.ride) === Number(ride))) && (url.searchParams.get('ready') !== '1' || Number(row.ready_until) > now)).slice(0, Number(limitRaw));
      return response({ listings: selected, searchWindow: 500 });
    }
    const user = await getPlazaUser(request);
    if (action === 'me') return response({ user: user ? await profile(db, user) : null, authProvider: user?.provider || null });
    if (!user) bad(401, 'Войди в аккаунт');
    const uid = user!.userId; await profile(db, user!);
    if (action === 'mine') { const rows = await db.prepare(listingSelect + ' WHERE l.owner_id=? ORDER BY l.created_at DESC LIMIT 100').bind(uid).all<Row>(); return response({ listings: rows.results.map(listing) }); }
    if (action === 'offers') { const rows = await db.prepare(offerSelect + ' WHERE o.from_id=? OR o.to_id=? ORDER BY o.updated_at DESC LIMIT 100').bind(uid, uid).all<Row>(); return response({ offers: rows.results.map(offer) }); }
    if (action === 'messages') {
      const offerId = id(url.searchParams.get('offer')); await participant(db, offerId, uid);
      const rows = await db.prepare('SELECT m.id,m.offer_id,m.sender_id,m.body,m.created_at,p.nickname FROM plaza_messages m JOIN profiles p ON p.id=m.sender_id WHERE m.offer_id=? ORDER BY m.created_at DESC,m.id DESC LIMIT 200').bind(offerId).all<Row>();
      return response({ messages: rows.results.reverse() });
    }
    if (action === 'matches') {
      const source = await db.prepare(listingSelect + ' WHERE l.id=? AND l.owner_id=?').bind(id(url.searchParams.get('listing')), uid).first<Row>();
      if (!source) bad(404, 'Объявление не найдено');
      const candidates = await db.prepare(listingSelect + " WHERE l.owner_id!=? AND l.status='active' AND l.expires_at>?" + visible + " ORDER BY l.created_at DESC LIMIT 500").bind(uid, now).all<Row>();
      return response({ matches: matchListings(listing(source!), candidates.results.map(listing), now).slice(0, 100), searchWindow: 500, fairnessEstimate: false });
    }
    return response({ error: 'Раздел не найден' }, 404);
  } catch (e) { return failure(e); }
}
async function mutate(request: Request) {
  try {
    const url = requestURL(request);
    if (request.headers.get('Origin') !== url.origin) bad(403, 'Недопустимый источник запроса');
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) bad(415, 'Ожидается JSON');
    if (Number(request.headers.get('Content-Length') || '0') > 12000) bad(413, 'Слишком большой запрос');
    const raw = await request.text(); if (raw.length > 12000) bad(413, 'Слишком большой запрос');
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return bad(400, 'Некорректный JSON'); }
    if (!body! || typeof body !== 'object' || Array.isArray(body)) bad(400, 'Некорректный запрос');
    const user = await getPlazaUser(request); if (!user) bad(401, 'Войди в аккаунт');
    const db = database(), uid = user!.userId, own = await profile(db, user!), now = Date.now(), action = actionOf(request);
    const blocked = await db.prepare('SELECT reason FROM plaza_user_moderation WHERE user_id=? AND banned=1').bind(uid).first<Row>();
    if (blocked) bad(403, 'Аккаунт заблокирован: ' + blocked.reason);
    if (action === 'profile') {
      const nickname = text(body.nickname, 24, 3), roblox = text(body.roblox, 20, 3);
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(nickname) || !/^[a-zA-Z0-9_]{3,20}$/.test(roblox)) bad(400, 'Используй латинские буквы, цифры и _');
      if (await db.prepare('SELECT id FROM profiles WHERE lower(nickname)=? AND id!=?').bind(nickname.toLowerCase(), uid).first()) bad(409, 'Этот ник уже занят');
      try {
        await db.batch([
          db.prepare('UPDATE profiles SET nickname=?,roblox=? WHERE id=?').bind(nickname, roblox, uid),
          db.prepare('UPDATE roskins_accounts SET login=? WHERE id=?').bind(nickname.toLowerCase(), uid),
        ]);
      } catch { return bad(409, 'Этот ник уже занят'); }
      return response({ ok: true, user: { id: uid, nickname, roblox } });
    }
    if (action === 'listings') {
      if (!own.roblox) bad(400, 'Сначала укажи ник Roblox в профиле');
      const have = items(body.have), want = items(body.want, true), note = text(body.note ?? '', 300), listingId = crypto.randomUUID();
      const result = await db.prepare(`INSERT INTO plaza_listings (id,owner_id,have,want,note,status,created_at,expires_at,ready_until) SELECT ?,?,?,?,?,'active',?,?,0 WHERE (SELECT COUNT(*) FROM plaza_listings WHERE owner_id=? AND status IN ('active','reserved') AND expires_at>?)<5 AND (SELECT COUNT(*) FROM plaza_listings WHERE owner_id=? AND created_at>?)<10`).bind(listingId, uid, JSON.stringify(have), JSON.stringify(want), note, now, now + DAY, uid, now, uid, now - 3600000).run();
      if (!result.meta.changes) bad(429, 'Лимит: 5 активных объявлений и 10 новых за час');
      return response({ ok: true, id: listingId }, 201);
    }
    if (action === 'listing-status') {
      const listingId = id(body.id), next = body.status;
      if (!['renew', 'close', 'ready'].includes(String(next))) bad(400, 'Неизвестное действие');
      const row = await db.prepare('SELECT * FROM plaza_listings WHERE id=? AND owner_id=?').bind(listingId, uid).first<Row>();
      if (!row) bad(404, 'Объявление не найдено');
      if (row!.status !== 'active') bad(409, 'Сначала отмени согласованный обмен или создай новое объявление');
      if (next === 'renew' && Number(row!.expires_at) > now + DAY - 300000) bad(429, 'Обновлять объявление можно раз в 5 минут');
      if (next === 'ready' && Number(row!.expires_at) <= now) bad(409, 'Сначала продли объявление');
      if (next === 'ready' && body.ready !== undefined && typeof body.ready !== 'boolean') bad(400, 'Некорректная отметка готовности');
      const sql = next === 'close' ? "UPDATE plaza_listings SET status='closed',ready_until=0 WHERE id=? AND owner_id=? AND status='active'" : next === 'renew' ? "UPDATE plaza_listings SET expires_at=?,ready_until=0 WHERE id=? AND owner_id=? AND status='active' AND (expires_at>? OR (SELECT COUNT(*) FROM plaza_listings WHERE owner_id=? AND status IN ('active','reserved') AND expires_at>?)<5)" : "UPDATE plaza_listings SET ready_until=? WHERE id=? AND owner_id=? AND status='active' AND expires_at>?";
      const args = next === 'close' ? [listingId, uid] : next === 'renew' ? [now + DAY, listingId, uid, now, uid, now] : [body.ready === false ? 0 : now + READY, listingId, uid, now];
      const result = await db.prepare(sql).bind(...args).run(); if (!result.meta.changes) bad(next === 'renew' ? 429 : 409, next === 'renew' ? 'Лимит: 5 активных объявлений или объявление уже изменилось' : 'Объявление уже изменилось'); return response({ ok: true });
    }
    if (action === 'offers') {
      if (!own.roblox) bad(400, 'Сначала укажи ник Roblox в профиле');
      const listingId = id(body.listingId), row = await db.prepare("SELECT * FROM plaza_listings WHERE id=? AND status='active' AND expires_at>? AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=plaza_listings.id AND m.hidden=1) AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id=plaza_listings.owner_id AND m.banned=1)").bind(listingId, now).first<Row>();
      if (!row) bad(404, 'Объявление больше не активно'); if (row!.owner_id === uid) bad(400, 'Нельзя предложить обмен самому себе');
      const have = items(body.have), want = items(body.want ?? parseItems(row!.have)), note = text(body.note ?? '', 300);
      if (!containsItems(parseItems(row!.have), want)) bad(400, 'В запросе есть предметы, которых нет в объявлении');
      const offerId = crypto.randomUUID();
      try {
        const result = await db.prepare(`INSERT INTO plaza_offers (id,listing_id,from_id,to_id,have,want,note,status,created_at,updated_at) SELECT ?,l.id,?,l.owner_id,?,?,?,'pending',?,? FROM plaza_listings l WHERE l.id=? AND l.status='active' AND l.expires_at>? AND l.owner_id!=? AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=l.id AND m.hidden=1) AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id=l.owner_id AND m.banned=1) AND (SELECT COUNT(*) FROM plaza_offers WHERE from_id=? AND created_at>?)<30 AND NOT EXISTS (SELECT 1 FROM plaza_offers WHERE listing_id=l.id AND from_id=? AND status IN ('pending','accepted'))`).bind(offerId, uid, JSON.stringify(have), JSON.stringify(want), note, now, now, listingId, now, uid, uid, now - 3600000, uid).run();
        if (!result.meta.changes) bad(409, 'Предложение уже отправлено, объявление изменилось или достигнут лимит 30 предложений за час');
      } catch (e) { if (e instanceof HttpError) throw e; return bad(409, 'Предложение уже существует'); }
      return response({ ok: true, id: offerId }, 201);
    }
    if (action === 'offer-status') {
      const offerId = id(body.id), next = body.status, row = await participant(db, offerId, uid), from = row.from_id === uid, to = row.to_id === uid;
      if (!['accept', 'decline', 'cancel', 'complete'].includes(String(next))) bad(400, 'Неизвестное действие');
      let result;
      if (next === 'accept') {
        if (!to || row.status !== 'pending') bad(409, 'Принять может только получатель нового предложения');
        result = await db.prepare("UPDATE plaza_offers SET status='accepted',updated_at=? WHERE id=? AND to_id=? AND status='pending' AND EXISTS (SELECT 1 FROM plaza_listings l WHERE l.id=listing_id AND l.status='active' AND l.expires_at>? AND NOT EXISTS (SELECT 1 FROM plaza_listing_moderation m WHERE m.listing_id=l.id AND m.hidden=1) AND NOT EXISTS (SELECT 1 FROM plaza_user_moderation m WHERE m.user_id=l.owner_id AND m.banned=1))").bind(now, offerId, uid, now).run();
      } else if (next === 'decline') {
        if (!to || row.status !== 'pending') bad(409, 'Отклонить может только получатель нового предложения');
        result = await db.prepare("UPDATE plaza_offers SET status='declined',updated_at=? WHERE id=? AND to_id=? AND status='pending'").bind(now, offerId, uid).run();
      } else if (next === 'cancel') {
        if (!(row.status === 'accepted' || (row.status === 'pending' && from))) bad(409, 'Это предложение нельзя отменить');
        result = await db.prepare("UPDATE plaza_offers SET status='cancelled',updated_at=? WHERE id=? AND (from_id=? OR to_id=?) AND status=?").bind(now, offerId, uid, uid, row.status).run();
      } else {
        if (row.status !== 'accepted') bad(409, 'Сначала согласуйте обмен');
        const flag = from ? 'from_confirmed' : 'to_confirmed', other = from ? 'to_confirmed' : 'from_confirmed';
        result = await db.prepare(`UPDATE plaza_offers SET ${flag}=1,status=CASE WHEN ${other}=1 THEN 'completed' ELSE 'accepted' END,updated_at=? WHERE id=? AND status='accepted' AND ${from ? 'from_id' : 'to_id'}=? AND ${flag}=0`).bind(now, offerId, uid).run();
      }
      if (!result.meta.changes) bad(409, 'Предложение уже изменилось. Обнови страницу');
      const updated = await db.prepare(offerSelect + ' WHERE o.id=?').bind(offerId).first<Row>(); return response({ ok: true, offer: offer(updated!) });
    }
    if (action === 'messages') {
      const offerId = id(body.offerId), message = text(body.body, 1000, 1), row = await participant(db, offerId, uid);
      if (!['pending', 'accepted'].includes(String(row.status))) bad(409, 'Этот диалог закрыт');
      const messageId = crypto.randomUUID();
      const result = await db.prepare(`INSERT INTO plaza_messages (id,offer_id,sender_id,body,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM plaza_offers WHERE id=? AND status IN ('pending','accepted') AND (from_id=? OR to_id=?)) AND (SELECT COUNT(*) FROM plaza_messages WHERE sender_id=? AND created_at>?)<20`).bind(messageId, offerId, uid, message, now, offerId, uid, uid, uid, now - 60000).run();
      if (!result.meta.changes) bad(429, 'Диалог закрыт или достигнут лимит 20 сообщений в минуту'); return response({ ok: true, id: messageId }, 201);
    }
    if (action === 'report') {
      const listingId = body.listingId ? id(body.listingId) : null, offerId = body.offerId ? id(body.offerId) : null, reason = text(body.reason, 500, 10);
      if (!listingId && !offerId) bad(400, 'Выбери объявление или предложение');
      if (listingId && !(await db.prepare('SELECT id FROM plaza_listings WHERE id=?').bind(listingId).first())) bad(404, 'Объявление не найдено');
      if (offerId) await participant(db, offerId, uid);
      const result = await db.prepare('INSERT INTO plaza_reports (id,reporter_id,listing_id,offer_id,reason,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM plaza_reports WHERE reporter_id=? AND created_at>?)<5').bind(crypto.randomUUID(), uid, listingId, offerId, reason, now, uid, now - 3600000).run();
      if (!result.meta.changes) bad(429, 'Не более 5 жалоб в час'); return response({ ok: true }, 201);
    }
    return response({ error: 'Действие не найдено' }, 404);
  } catch (e) { return failure(e); }
}
function failure(error: unknown) {
  if (error instanceof HttpError) return response({ error: error.message }, error.status);
  // Avoid echoing DB text, private messages or identity details into logs/responses.
  console.error('plaza_api_error'); return response({ error: 'Не удалось выполнить запрос. Попробуй ещё раз.' }, 500);
}

export async function POST(request: Request) {
  const result = await mutate(request);
  if (result.ok && env.DB) { try { await deliverPush(env.DB, env as unknown as Record<string,string>); } catch { console.error('push_delivery_deferred'); } }
  return result;
}
