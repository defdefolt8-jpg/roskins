// Empty-body Web Push (RFC 8030) with VAPID (RFC 8292). No chat contents leave the site.
import { createPrivateKey, sign } from 'node:crypto';
const allowedHosts = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns.windows.com', 'notify.windows.com'];
export function isPushEndpoint(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.port === '' && !u.username && !u.password && !u.hash && value.length < 2048 && allowedHosts.some(host => u.hostname === host || u.hostname.endsWith('.' + host)); } catch { return false; }
}
export function vapidAuthorization(endpoint, privateJwk, publicKey, now = Date.now()) {
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = encoded({ typ: 'JWT', alg: 'ES256' }) + '.' + encoded({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: 'mailto:zuzlsaha456@gmail.com' });
  const signature = sign('sha256', Buffer.from(input), { key: createPrivateKey({ key: JSON.parse(privateJwk), format: 'jwk' }), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `vapid t=${input}.${signature}, k=${publicKey}`;
}
export async function deliverPush(db, settings, onlyUser) {
  if (!settings.ROSKINS_VAPID_PRIVATE_JWK || !settings.ROSKINS_VAPID_PUBLIC_KEY) return;
  const now = Date.now();
  await db.prepare('UPDATE plaza_notifications SET push_state=0 WHERE created_at>? AND read_at=0 AND ((push_state=1 AND push_at<?) OR (push_state=3 AND push_at<?))').bind(now - 86400000, now - 60000, now - 300000).run();
  // Bounded pilot fanout; durable notification rows remain the source of truth.
  const pending = await db.prepare("SELECT user_id FROM plaza_notifications WHERE read_at=0 AND push_state=0 AND created_at>? AND (? IS NULL OR user_id=?) GROUP BY user_id ORDER BY MIN(created_at) LIMIT 12").bind(now - 86400000, onlyUser || null, onlyUser || null).all();
  for (const row of pending.results) {
    const subscriptions = await db.prepare('SELECT p.* FROM plaza_push_subscriptions p JOIN roskins_sessions s ON s.token_hash=p.session_hash AND s.user_id=p.user_id WHERE p.user_id=? AND s.expires_at>? AND p.last_sent_at<? LIMIT 3').bind(row.user_id, now, now - 30000).all();
    if (!subscriptions.results.length) continue;
    const claim = await db.prepare('UPDATE plaza_notifications SET push_state=1,push_at=? WHERE user_id=? AND push_state=0 AND read_at=0 AND created_at>?').bind(now, row.user_id, now - 86400000).run();
    if (!claim.meta.changes) continue;
    let sent = false;
    for (const sub of subscriptions.results) {
      if (!isPushEndpoint(sub.endpoint)) continue;
      try {
        const response = await fetch(sub.endpoint, { method: 'POST', body: '', headers: { Authorization: vapidAuthorization(sub.endpoint, settings.ROSKINS_VAPID_PRIVATE_JWK, settings.ROSKINS_VAPID_PUBLIC_KEY, now), TTL: '86400', Urgency: 'normal', Topic: 'roskins-events' }, redirect: 'manual', signal: AbortSignal.timeout(3500) });
        if (response.status === 404 || response.status === 410) await db.prepare('DELETE FROM plaza_push_subscriptions WHERE id=?').bind(sub.id).run();
        if (response.ok) { sent = true; await db.prepare('UPDATE plaza_push_subscriptions SET last_sent_at=? WHERE id=?').bind(now, sub.id).run(); }
      } catch { /* Retained in-site notifications do not depend on external push availability. */ }
    }
    await db.prepare('UPDATE plaza_notifications SET push_state=? WHERE user_id=? AND push_state=1 AND push_at=?').bind(sent ? 2 : 3, row.user_id, now).run();
  }
}
