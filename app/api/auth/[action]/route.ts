import { AuthError, authClient, authConfig, authResponse, checkAuthOrigin, authFailure } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';

const emailValid = (value: string) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export async function GET(request: Request) {
  if (new URL(request.url).pathname !== '/api/auth/status') return authResponse({ error: 'Страница не найдена.' }, 404);
  const config = authConfig();
  return authResponse({ email: Boolean(config), google: config?.google === true });
}

export async function POST(request: Request) {
  try {
    const config = checkAuthOrigin(request);
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new AuthError(415, 'Ожидается JSON.');
    const text = await request.text();
    if (text.length > 4096) throw new AuthError(413, 'Слишком большой запрос.');
    let data;
    try { data = JSON.parse(text); } catch { throw new AuthError(400, 'Некорректный запрос.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AuthError(400, 'Некорректный запрос.');
    const action = new URL(request.url).pathname.split('/').pop();
    if (!['signup', 'login', 'reset', 'password', 'logout', 'google'].includes(action || '')) throw new AuthError(404, 'Действие не найдено.');
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    if (['signup', 'login', 'reset'].includes(action!) && !emailValid(email)) throw new AuthError(400, 'Укажи корректную почту.');
    if (['signup', 'password'].includes(action!) && (password.length < 12 || password.length > 128)) throw new AuthError(400, 'Пароль должен содержать от 12 до 128 символов.');
    if (action === 'login' && (!password || password.length > 128)) throw new AuthError(400, 'Укажи пароль.');
    const client = await authClient();
    if (action === 'google') {
      if (!config.google) throw new AuthError(503, 'Вход через Google временно недоступен.');
      const { data: result, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: config.origin + '/auth/callback', skipBrowserRedirect: true } });
      if (error || !result.url) throw new AuthError(503, 'Не удалось открыть вход через Google.');
      return authResponse({ url: result.url });
    }
    if (action === 'signup') {
      const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: config.origin + '/auth/callback' } });
      if (error?.status === 429) throw new AuthError(429, 'Слишком много попыток. Подожди перед повтором.');
      if (error) throw new AuthError(400, 'Не удалось отправить подтверждение. Попробуй позже или войди в существующий аккаунт.');
      return authResponse({ ok: true, message: 'Если адрес доступен для регистрации, на него придёт письмо. Открой ссылку для подтверждения.' });
    }
    if (action === 'login') {
      const { data: result, error } = await client.auth.signInWithPassword({ email, password });
      if (error?.status === 429) throw new AuthError(429, 'Слишком много попыток. Подожди перед повтором.');
      if (error || !result.user?.email_confirmed_at) throw new AuthError(401, 'Не удалось войти. Проверь почту, пароль и подтверждение адреса.');
      return authResponse({ ok: true });
    }
    if (action === 'reset') {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: config.origin + '/auth/callback' });
      if (error?.status === 429) throw new AuthError(429, 'Слишком много попыток. Подожди перед повтором.');
      if (error) throw new AuthError(503, 'Не удалось отправить письмо. Попробуй позже.');
      return authResponse({ ok: true, message: 'Если аккаунт существует, письмо со ссылкой для нового пароля отправлено.' });
    }
    if (action === 'password') {
      const { data: { user }, error: identityError } = await client.auth.getUser();
      if (identityError || !user?.email_confirmed_at) throw new AuthError(401, 'Открой свежую ссылку из письма или войди в аккаунт.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw new AuthError(400, 'Не удалось изменить пароль. Попробуй другой пароль.');
      return authResponse({ ok: true });
    }
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw new AuthError(503, 'Не удалось выйти. Попробуй ещё раз.');
    return authResponse({ ok: true });
  } catch (error) { return authFailure(error); }
}
