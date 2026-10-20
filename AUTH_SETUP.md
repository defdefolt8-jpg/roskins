# Почта и Google через Supabase Auth

Код поддерживает регистрацию по почте и паролю, подтверждение адреса, вход, Google OAuth с PKCE, восстановление пароля и выход. Пока проект Supabase не подключён, новые способы входа явно недоступны; существующий вход через ChatGPT работает по-прежнему.

## 1. Проект Supabase

Создай проект в своей учётной записи Supabase. В Authentication → Providers включи Email и подтверждение почты (Confirm email). Установи минимальную длину пароля 12 символов. Для обычных пользователей настрой собственный SMTP: встроенная тестовая рассылка Supabase ограничена и не заменяет рабочую почту площадки.

В Authentication → URL Configuration:

- Site URL: `https://roskins.vastswan9.chatgpt.site`
- Redirect URLs: `https://roskins.vastswan9.chatgpt.site/auth/callback`

Если используешь другой домен, замени его во всех настройках и шаблонах. В боевой конфигурации нужны HTTPS и точные адреса без wildcard.

## 2. Шаблоны писем

В Authentication → Email Templates задай ссылки. Первая позволяет подтвердить адрес даже в другом браузере, где нет PKCE-cookie.

Confirm signup:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Подтвердить почту</a>
```

Reset password:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Изменить пароль</a>
```

## 3. Google

В Google Cloud Console создай OAuth Client типа Web application и настрой consent screen под roskins. Пока приложение в Testing, добавь тестовых пользователей. Для реального запуска переведи приложение в Production и выполни требования Google к публикации.

В Supabase → Authentication → Providers → Google скопируй показанный callback URL (обычно `https://<project-ref>.supabase.co/auth/v1/callback`). Именно его добавь в Google как Authorized redirect URI. Google Client ID и Client Secret введи **в настройках Supabase**, не в коде, GitHub или чате. Включи Google provider. Используй обычную проверку email и nonce; не включай обход этих проверок.

## 4. Runtime-настройки roskins

Задай в окружении сервера, для Sites — через настройки окружения сайта:

| Переменная | Значение |
| --- | --- |
| `SUPABASE_URL` | Project URL из Supabase, только HTTPS origin |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key `sb_publishable_…` (или legacy **anon**, никогда service_role/secret) |
| `PUBLIC_SITE_URL` | `https://roskins.vastswan9.chatgpt.site` без пути |
| `GOOGLE_AUTH_ENABLED` | `true` только после включения Google в Supabase |

Публичный ключ не является административным секретом, но здесь он используется только сервером. Пароли, access/refresh tokens и Google secret не сохраняются в исходниках или localStorage. `service_role`/secret keys не принимаются. Сессии хранятся в HttpOnly/Secure/SameSite=Lax cookies; сервер проверяет пользователя через Supabase `getUser()`, а не доверяет данным cookie.

## 5. Доступ и существующие аккаунты

Пользователи Supabase получают отдельные ID `supabase:<uuid>`. Существующие профили и объявления ChatGPT не объединяются автоматически по совпавшей почте. Это сохраняет владельцев данных. Администратор по-прежнему определяется серверной настройкой `MARKET_ADMIN_EMAIL`, только после проверки личности и подтверждения почты.

На домене `chatgpt.site` политика доступа Sites действует раньше прикладного входа. Если сайт закрыт для внешних посетителей, кнопка Google внутри roskins не снимает этот барьер. Текущая аудитория сайта этим изменением не меняется. Перед публикацией убедись, что платформа допускает cookies и внешнюю авторизацию для выбранной аудитории; иначе используй совместимый хостинг с доменом, которым управляешь.

Загрузка кода в GitHub сама по себе не обновляет опубликованный сайт. Нужны сборка и штатный деплой на выбранный сервер. Схема D1 не менялась.

## Проверка после настройки и деплоя

1. Зарегистрируй новый адрес. До подтверждения он не должен получать доступ к личным данным.
2. Подтверди письмо; проверь профиль, объявление, выход и повторный вход.
3. Запроси восстановление пароля и пройди ссылку из письма. Проверь, что старый пароль перестал работать.
4. Проверь Google-вход и отмену consent. Не должно появляться аккаунтов или заявок по данным, переданным только браузером.
5. Проверь, что разные аккаунты не видят чужую переписку и объявления в личном кабинете.

Автоматические тесты используют заглушку Supabase и проверяют обработку запросов, CSRF, конфигурацию и выбор проверенной личности. Они не подтверждают доставку настоящего письма или успешный OAuth без настроенного проекта.

Официальные инструкции: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [пароли и почта](https://supabase.com/docs/guides/auth/passwords), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
