'use client';
import { useState } from 'react';
import { LEGAL_VERSION } from '../lib/legal-config';
import { ArrowUpRight, Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';

export async function accountRequest(action: string, body: unknown) {
  const response = await fetch(`/api/account/${action}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json() as { error?: string; ok: boolean; recoveryCode?: string };
  if (!response.ok) throw new Error(payload.error || 'Не удалось выполнить действие');
  return payload as { ok: boolean; recoveryCode?: string };
}
export default function AccountForm({ initial = 'register', onSuccess }: { initial?: 'register' | 'login'; onSuccess: (recoveryCode?: string) => Promise<void> }) {
  const [mode, setMode] = useState<'register' | 'login' | 'recover'>(initial);
  const [nickname, setNickname] = useState(''), [roblox, setRoblox] = useState('');
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [recoveryCode, setRecoveryCode] = useState('');
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const changeMode = (next: typeof mode) => { setMode(next); setError(''); setPassword(''); setRepeat(''); setRecoveryCode(''); setVisible(false); };
  return <div className="plaza-auth">
    <div className="plaza-auth-tabs" role="group" aria-label="Вход или регистрация"><button type="button" disabled={busy} className={mode === 'login' ? 'is-active' : ''} onClick={() => changeMode('login')}>Вход</button><button type="button" disabled={busy} className={mode === 'register' ? 'is-active' : ''} onClick={() => changeMode('register')}>Регистрация</button></div>
    <div className="plaza-account-note"><ShieldCheck size={20} /><div><b>{mode === 'register' ? 'Твоё место на трейд-плазе' : mode === 'recover' ? 'Вернём доступ к аккаунту' : 'С возвращением на плазу'}</b><span>{mode === 'recover' ? 'Нужен код, который ты сохранил при регистрации.' : 'Объявления, предложения и чаты — в одном профиле.'}</span></div></div>
    <form onSubmit={async event => { event.preventDefault(); if (busy) return; setError(''); if (mode === 'register' && !accepted) { setError('Для регистрации нужно принять соглашение и правила'); return; } if (mode !== 'login' && password !== repeat) { setError('Пароли не совпадают'); return; } setBusy(true); try { const result = await accountRequest(mode, { nickname, password, ...(mode === 'register' ? { roblox, termsAccepted: accepted, legalVersion: LEGAL_VERSION } : {}), ...(mode === 'recover' ? { recoveryCode: recoveryCode.trim() } : {}) }); setPassword(''); setRepeat(''); setRecoveryCode(''); await onSuccess(result.recoveryCode); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти'); } finally { setBusy(false); } }}>
      <label className="plaza-field">Ник на Roskins<input name="username" autoComplete="username" value={nickname} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required placeholder="Например, Moonberry" onChange={e => setNickname(e.target.value)} /><small>{mode === 'register' ? '3–24 символа: латинские буквы, цифры и _' : 'Тот ник, с которым ты зарегистрировался.'}</small></label>
      {mode === 'register' && <label className="plaza-field">Имя пользователя Roblox<input name="roblox" autoComplete="off" value={roblox} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required placeholder="Точный username, не отображаемое имя" onChange={e => setRoblox(e.target.value)} /><small>Чтобы другие игроки могли найти тебя в игре.</small></label>}
      {mode === 'recover' && <label className="plaza-field">Код восстановления<input name="recoveryCode" autoComplete="off" value={recoveryCode} required minLength={43} maxLength={43} onChange={e => setRecoveryCode(e.target.value)} placeholder="Код, сохранённый при регистрации" /></label>}
      <label className="plaza-field">{mode === 'recover' ? 'Новый пароль Roskins' : 'Пароль Roskins'}<span className="plaza-password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} required minLength={10} maxLength={128} placeholder={mode === 'login' ? 'Введи свой пароль' : 'Придумай пароль от 10 символов'} onChange={e => setPassword(e.target.value)} /><button type="button" className="plaza-icon-button" aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
      {mode !== 'login' && <label className="plaza-field">Повтори пароль<input name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" value={repeat} required minLength={10} maxLength={128} placeholder="Ещё раз тот же пароль" onChange={e => setRepeat(e.target.value)} /></label>}
      {mode === 'register' && <div className="plaza-legal-accept"><label><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} /><span>Принимаю <a href="/legal/terms" target="_blank" rel="noopener noreferrer">пользовательское соглашение</a> и <a href="/legal/rules" target="_blank" rel="noopener noreferrer">правила сообщества</a>.</span></label><p>Какие данные сохраняет сервис: <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">политика конфиденциальности</a>. <a href="/legal/cookies" target="_blank" rel="noopener noreferrer">Cookies и уведомления</a>.</p></div>}
      {error && <p className="plaza-auth-error" role="alert">{error}</p>}
      <button className="plaza-button plaza-button-lime plaza-auth-submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="plaza-spin" /> : <KeyRound size={17} />}{mode === 'register' ? 'Создать аккаунт' : mode === 'recover' ? 'Восстановить доступ' : 'Войти'}<ArrowUpRight size={17} /></button>
      {mode === 'login' && <button type="button" className="plaza-auth-link" onClick={() => changeMode('recover')}>Забыл пароль?</button>}
      <p className="plaza-auth-hint">Это отдельный аккаунт Roskins. Используй свой новый пароль, а не пароль Roblox. <a href="/legal/parents" target="_blank" rel="noopener noreferrer">Родителям и опекунам</a></p>
      
    </form>
  </div>;
}

export function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  return <div className="plaza-recovery"><div className="plaza-empty-icon"><KeyRound size={28} /></div><h3>Сохрани ключ от аккаунта</h3><p>Этот код позволяет восстановить пароль. Показываем его один раз — сохрани в надёжном месте и никому не отправляй.</p><label className="plaza-field">Код восстановления<textarea readOnly rows={2} value={code} onFocus={e => e.currentTarget.select()} /></label><button className="plaza-button plaza-button-quiet" type="button" onClick={() => { const file = new Blob([`Roskins — код восстановления\n${code}\nХрани в секрете. После восстановления выдаётся новый код.\n`], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(file); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'roskins-recovery.txt'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Скачать код</button><label className="plaza-recovery-check"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />Я сохранил код восстановления</label><button className="plaza-button plaza-button-lime plaza-auth-submit" disabled={!saved} onClick={onDone}>Перейти на плазу<ArrowUpRight size={17} /></button></div>;
}
