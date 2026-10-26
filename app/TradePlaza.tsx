'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, Bookmark, Heart, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, Clock3, Flag, Layers3, LoaderCircle, Menu, MessageCircle, Plus, RefreshCw, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, X } from 'lucide-react';
import './plaza.css';
import PetPicker, { petImage } from './PetPicker';
import { CATALOG } from '../lib/plaza-model.mjs';
import { AdminPanel, CommunitySection, FavoriteButton, RobloxProfile, community, useCommunity, type CommunityListing, type SavedSearch } from './PlazaExtras';
import AccountForm, { accountRequest, RecoveryCode } from './AccountForm';

type Variant = 'normal' | 'neon' | 'mega';
type Timestamp = number | string;
type Item = { pet: string; variant: Variant; fly: boolean; ride: boolean; quantity: number };
type CatalogItem = { id: string; name: string; image?: string; kind?: string; ru?: string };
type User = { id: string; nickname: string; roblox: string };
type Listing = CommunityListing;
type Offer = { id: string; listing_id: string; from_id: string; to_id: string; from_nickname: string; to_nickname: string; from_roblox: string; to_roblox: string; have: Item[]; want: Item[]; note: string; status: string; created_at: Timestamp; updated_at: Timestamp; from_confirmed: boolean; to_confirmed: boolean };
type Message = { id: string; sender_id: string; sender_nickname?: string; nickname?: string; body: string; created_at: Timestamp };
type Match = { listing: Listing; kind: 'mutual' | 'open' };
type Tab = 'favorites' | 'searches' | 'notifications' | 'admin' | 'explore' | 'mine' | 'matches' | 'offers';
type Modal = 'preview' | 'account' | 'recovery' | 'create' | 'profile' | 'offer' | 'chat' | 'report' | null;

const FALLBACK_CATALOG: CatalogItem[] = [...CATALOG];
const freshItem = (pet = 'turtle', variant: Variant = 'normal', fly = false, ride = false): Item => ({ pet, variant, fly, ride, quantity: 1 });
const special = (pet: string) => ['ride-potion', 'fly-potion', 'egg'].includes(pet);
const itemName = (item: Item, catalog: CatalogItem[]) => catalog.find(p => p.id === item.pet)?.name || item.pet;
const toMs = (value: Timestamp | null | undefined) => value == null || value === '' ? 0 : typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : Date.parse(value);
const isReady = (listing: Listing) => toMs(listing.ready_until) > Date.now() && ['open', 'active'].includes(listing.status);
const isOpen = (listing: Listing) => ['open', 'active'].includes(listing.status) && toMs(listing.expires_at) > Date.now();
const formatTime = (value: Timestamp) => {
  const time = toMs(value);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  return minutes < 1 ? 'только что' : minutes < 60 ? `${minutes} мин. назад` : minutes < 1440 ? `${Math.floor(minutes / 60)} ч. назад` : new Date(time).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить действие. Попробуйте ещё раз.';
const listingCount = (n: number) => `${n} ${n % 100 >= 11 && n % 100 <= 14 ? 'объявлений' : n % 10 === 1 ? 'объявление' : n % 10 >= 2 && n % 10 <= 4 ? 'объявления' : 'объявлений'}`;
async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/plaza/${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  const payload = await response.json().catch(() => ({}));
  const detail = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof detail.error === 'string' ? detail.error : typeof detail.message === 'string' ? detail.message : response.status === 401 ? 'Войдите, чтобы продолжить.' : 'Сервис временно недоступен. Попробуйте ещё раз.');
  return payload as T;
}

const SAMPLE_DATE = '2026-10-25T12:00:00Z';
const SAMPLES: Listing[] = [
  { id: 'example-1', owner_id: 'sample', nickname: 'Moonberry', roblox: '', have: [freshItem('turtle', 'neon', true, true)], want: [freshItem('kangaroo', 'neon', false, true), freshItem('ride-potion')], note: 'Ищу такой обмен. Другие варианты тоже рассмотрю.', status: 'example', created_at: SAMPLE_DATE, expires_at: SAMPLE_DATE, ready_until: null },
  { id: 'example-2', owner_id: 'sample', nickname: 'Cloudy', roblox: '', have: [freshItem('frost-dragon', 'normal', true, true)], want: [freshItem('owl', 'normal', true, true), freshItem('turtle')], note: 'Без спешки, хочу найти интересное предложение.', status: 'example', created_at: SAMPLE_DATE, expires_at: SAMPLE_DATE, ready_until: null },
  { id: 'example-3', owner_id: 'sample', nickname: 'Minty', roblox: '', have: [freshItem('cow', 'neon', false, true), freshItem('unicorn')], want: [], note: 'Открытый трейд — предложи свой вариант.', status: 'example', created_at: SAMPLE_DATE, expires_at: SAMPLE_DATE, ready_until: null },
  { id: 'example-4', owner_id: 'sample', nickname: 'Pixel', roblox: '', have: [freshItem('arctic-reindeer', 'normal', true, true)], want: [freshItem('turtle'), freshItem('kangaroo'), freshItem('fly-potion')], note: 'Пример объявления с несколькими предметами.', status: 'example', created_at: SAMPLE_DATE, expires_at: SAMPLE_DATE, ready_until: null },
];

function PetTile({ item, catalog, small = false }: { item: Item; catalog: CatalogItem[]; small?: boolean }) {
  return <div className={`plaza-pet ${small ? 'plaza-pet-small' : ''} plaza-pet-${item.variant}`} title={`${itemName(item, catalog)}${item.variant !== 'normal' ? ` · ${item.variant}` : ''}${item.fly ? ' · Fly' : ''}${item.ride ? ' · Ride' : ''}`}>
    <img src={petImage(catalog.find(p => p.id === item.pet), item.pet)} alt={itemName(item, catalog)} loading="lazy" width="92" height="92" />
    <div className="plaza-pet-flags">{item.variant === 'neon' && <b className="plaza-flag-neon">N</b>}{item.variant === 'mega' && <b className="plaza-flag-mega">M</b>}{item.fly && <b className="plaza-flag-fly">F</b>}{item.ride && <b className="plaza-flag-ride">R</b>}</div>
    {item.quantity > 1 && <span className="plaza-pet-qty">×{item.quantity}</span>}
    <span className="plaza-pet-name">{itemName(item, catalog)}</span>
  </div>;
}

function ItemStack({ items, catalog, small = false, openText = 'Рассмотрю предложения' }: { items: Item[]; catalog: CatalogItem[]; small?: boolean; openText?: string }) {
  return items.length ? <div className="plaza-items">{items.map((item, index) => <PetTile key={`${item.pet}-${index}`} item={item} catalog={catalog} small={small} />)}</div> : <div className="plaza-open-want"><Sparkles size={23} /><span>{openText}</span><small>Предложи свой вариант</small></div>;
}

function ItemEditor({ title, items, setItems, catalog, optional = false }: { title: string; items: Item[]; setItems: (items: Item[]) => void; catalog: CatalogItem[]; optional?: boolean }) {
  const editorId = title.replace(/\s+/g, '-');
  const update = (index: number, patch: Partial<Item>) => setItems(items.map((item, i) => {
    if (i !== index) return item;
    const next = { ...item, ...patch };
    return special(next.pet) ? { ...next, variant: 'normal', fly: false, ride: false } : next;
  }));
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  return <section className="plaza-editor"><div className="plaza-editor-heading"><h3>{title}</h3><span>{total} / 18 предметов</span></div>
    {!items.length && <div className="plaza-editor-empty">{optional ? 'Открытый трейд: другие игроки смогут предложить любые предметы.' : 'Добавь хотя бы один предмет.'}</div>}
    {items.map((item, index) => <div className="plaza-editor-row" key={index}>
      <img src={petImage(catalog.find(p => p.id === item.pet), item.pet)} alt="" width="46" height="46" />
      <PetPicker label={`${title}: предмет ${index + 1}`} value={item.pet} catalog={catalog} onChange={pet => update(index, { pet })} />
      <label className="plaza-sr-only" htmlFor={`${editorId}-variant-${index}`}>Вариант</label><select id={`${editorId}-variant-${index}`} value={item.variant} disabled={special(item.pet)} onChange={event => update(index, { variant: event.target.value as Variant })}><option value="normal">Обычный</option><option value="neon">Neon</option><option value="mega">Mega</option></select>
      <div className="plaza-editor-flags"><label title="Fly"><input type="checkbox" checked={item.fly} disabled={special(item.pet)} onChange={event => update(index, { fly: event.target.checked })} /><span>F</span></label><label title="Ride"><input type="checkbox" checked={item.ride} disabled={special(item.pet)} onChange={event => update(index, { ride: event.target.checked })} /><span>R</span></label></div>
      <label className="plaza-quantity"><span className="plaza-sr-only">Количество</span><input type="number" min="1" max="18" value={item.quantity} required onChange={event => update(index, { quantity: Math.min(18, Math.max(1, Number(event.target.value) || 1)) })} /></label>
      <button className="plaza-icon-button" type="button" aria-label="Убрать предмет" onClick={() => setItems(items.filter((_, i) => i !== index))}><X size={16} /></button>
    </div>)}
    <button type="button" className="plaza-add-item" disabled={items.length >= 6 || total >= 18} onClick={() => setItems([...items, freshItem()])}><Plus size={15} />Добавить предмет</button>
  </section>;
}

function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) { return <div className="plaza-empty"><div className="plaza-empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p>{action}</div>; }

export default function TradePlaza() {
  const [tab, setTab] = useState<Tab>('explore');
  const [menuOpen, setMenuOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>(FALLBACK_CATALOG);
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchListing, setMatchListing] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [search, setSearch] = useState('');
  const [variant, setVariant] = useState('all');
  const [readyOnly, setReadyOnly] = useState(false);
  const [flyFilter, setFlyFilter] = useState(-1), [rideFilter, setRideFilter] = useState(-1);
  const [peek, setPeek] = useState<Listing | null>(null);
  const extras = useCommunity(user?.id);
  const [offerDirection, setOfferDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [modal, setModal] = useState<Modal>(null);
  const [modalError, setModalError] = useState('');
  const [target, setTarget] = useState<Listing | null>(null);
  const [conversation, setConversation] = useState<Offer | null>(null);
  const [have, setHave] = useState<Item[]>([freshItem()]);
  const [want, setWant] = useState<Item[]>([]);
  const [note, setNote] = useState('');
  const [nickname, setNickname] = useState('');
  const [roblox, setRoblox] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [reportReason, setReportReason] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const loadPersonal = useCallback(async () => {
    const result = await Promise.allSettled([api<{ listings: Listing[] }>('mine'), api<{ offers: Offer[] }>('offers')]);
    if (result[0].status === 'fulfilled') setMine(result[0].value.listings || []);
    if (result[1].status === 'fulfilled') setOffers(result[1].value.offers || []);
    const failed = result.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }, []);
  const loadListings = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: '100' });
    const pet = catalog.find(p => p.id.toLowerCase() === search.trim().toLowerCase() || p.name.toLowerCase() === search.trim().toLowerCase());
    if (pet) params.set('pet', pet.id);
    if (variant !== 'all') params.set('variant', variant);
    if (readyOnly) params.set('ready', '1');
    if (flyFilter !== -1) params.set('fly', String(flyFilter));
    if (rideFilter !== -1) params.set('ride', String(rideFilter));
    const result = await api<{ listings: Listing[] }>(`listings?${params}`, undefined, signal);
    setListings(result.listings || []); setListLoaded(true);
  }, [catalog, search, variant, readyOnly, flyFilter, rideFilter]);
  useEffect(() => {
    let alive = true;
    Promise.allSettled([api<{ user: User | null; authProvider?: string }>('me'), api<{ catalog: CatalogItem[] }>('catalog')]).then(async results => {
      if (!alive) return;
      if (results[1].status === 'fulfilled' && Array.isArray(results[1].value.catalog) && results[1].value.catalog.length) setCatalog(results[1].value.catalog);
      if (results[0].status === 'fulfilled') { setUser(results[0].value.user); setAuthProvider(results[0].value.authProvider || null); if (results[0].value.user) await loadPersonal().catch(error => setError(errorText(error))); }
      else setError(errorText(results[0].reason));
      if (alive) setAuthLoaded(true);
    });
    return () => { alive = false; };
  }, [loadPersonal]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { setLoading(true); loadListings(controller.signal).catch(error => { if (error.name !== 'AbortError') setError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [loadListings]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!modal && dialog.current?.open) dialog.current.close();
    setModalError('');
  }, [modal]);
  useEffect(() => { setMenuOpen(false); window.scrollTo({top:0,left:0,behavior:'auto'}); }, [tab]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || modal || busy) return;
      const work: Promise<unknown>[] = [loadListings()];
      if (user) work.push(loadPersonal());
      if (user && tab === 'matches' && matchListing) work.push(api<{ matches: Match[] }>(`matches?listing=${encodeURIComponent(matchListing)}`).then(result => setMatches(result.matches || [])));
      void Promise.allSettled(work).then(results => {
        const failed = results.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected') setError(errorText(failed.reason));
      });
    }, 20000);
    return () => clearInterval(timer);
  }, [loadListings, loadPersonal, user, tab, matchListing, modal, busy]);
  useEffect(() => {
    if (tab !== 'matches' || !matchListing) return;
    const controller = new AbortController(); setMatchLoading(true);
    api<{ matches: Match[] }>(`matches?listing=${encodeURIComponent(matchListing)}`, undefined, controller.signal).then(result => setMatches(result.matches || [])).catch(error => { if (error.name !== 'AbortError') setError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setMatchLoading(false); });
    return () => controller.abort();
  }, [tab, matchListing]);
  useEffect(() => {
    if (modal !== 'chat' || !conversation) return;
    let alive = true;
    const refresh = () => api<{ messages: Message[] }>(`messages?offer=${encodeURIComponent(conversation.id)}`).then(result => { if (alive) setMessages(result.messages || []); }).catch(error => { if (alive) setModalError(errorText(error)); });
    refresh(); const timer = setInterval(refresh, 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [modal, conversation]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);

  const refresh = async () => { await loadListings(); if (user) await loadPersonal(); };
  const run = async (label: string, action: () => Promise<void>) => {
    if (busy) return; setBusy(label); setModalError(''); setError('');
    try { await action(); } catch (error) { if (modal) setModalError(errorText(error)); else setError(errorText(error)); } finally { setBusy(''); }
  };
  const requireProfile = () => {
    if (extras.banned) { setError('Аккаунт заблокирован: ' + extras.banReason); return false; }
    if (!user) { setAuthMode('register'); setModal('account'); return false; }
    if (!user.nickname || !user.roblox) { setNickname(user?.nickname || ''); setRoblox(user?.roblox || ''); setModal('profile'); return false; }
    return true;
  };
  const create = () => { if (!requireProfile()) return; setHave([freshItem()]); setWant([]); setNote(''); setTarget(null); setModal('create'); };
  const makeOffer = (listing: Listing) => { if (!requireProfile()) return; setTarget(listing); setHave([freshItem()]); setWant(listing.have); setNote(''); setModal('offer'); };
  const openChat = (offer: Offer) => { setConversation(offer); setMessages([]); setMessageBody(''); setModal('chat'); };
  const report = (listing: Listing | null, offer: Offer | null = null) => { if (!requireProfile()) return; setTarget(listing); setConversation(offer); setReportReason(''); setModal('report'); };
  const changeListing = (listing: Listing, status: 'ready' | 'renew' | 'close') => run(`${status}-${listing.id}`, async () => { await api('listing-status', { id: listing.id, status, ...(status === 'ready' ? { ready: !isReady(listing) } : {}) }); await refresh(); setNotice(status === 'close' ? 'Трейд закрыт.' : status === 'renew' ? 'Объявление продлено.' : isReady(listing) ? 'Статус готовности выключен.' : 'Готовность к обмену включена.'); });
  const changeOffer = (offer: Offer, status: 'accept' | 'decline' | 'cancel' | 'complete') => run(`${status}-${offer.id}`, async () => { await api('offer-status', { id: offer.id, status }); await loadPersonal(); setNotice(status === 'complete' ? 'Ваше подтверждение сохранено. Обмен завершится после подтверждения обоих участников.' : status === 'accept' ? 'Предложение принято. Договоритесь об обмене в чате.' : 'Статус предложения обновлён.'); });
  const validateItems = () => {
    if (!have.length) throw new Error('Добавьте предметы, которые отдаёте.');
    if ([have, want].some(items => items.length > 6 || items.reduce((total, item) => total + item.quantity, 0) > 18)) throw new Error('На каждой стороне может быть до 6 разных позиций и до 18 предметов всего.');
  };
  const shown = listings.filter(listing => !search.trim() || [...listing.have, ...listing.want].some(item => `${itemName(item, catalog)} ${item.pet}`.toLowerCase().includes(search.trim().toLowerCase())));
  const filtersActive = !!search.trim() || variant !== 'all' || readyOnly || flyFilter !== -1 || rideFilter !== -1;
  const activeMine = mine.filter(listing => isOpen(listing) && !listing.hidden);
  const incoming = offers.filter(offer => offer.to_id === user?.id);
  const outgoing = offers.filter(offer => offer.from_id === user?.id);
  const pendingCount = incoming.filter(offer => offer.status === 'pending').length;

  useEffect(() => { if (new URLSearchParams(window.location.search).get('view') === 'notifications') setTab('notifications'); const handler = (event: MessageEvent) => { if (event.data?.type === 'ROSKINS_OPEN_NOTIFICATIONS') setTab('notifications'); if (event.data?.type === 'ROSKINS_NOTIFICATION' || event.data?.type === 'ROSKINS_OPEN_NOTIFICATIONS') void extras.refresh().catch(() => {}); }; navigator.serviceWorker?.addEventListener('message', handler); return () => navigator.serviceWorker?.removeEventListener('message', handler); }, [extras.refresh]);
  useEffect(() => { document.title = `${extras.unread ? `(${extras.unread}) ` : ''}Roskins — трейд-плаза Adopt Me`; }, [extras.unread]);
  const openNotice = async (kind: string, id: string) => {
    if (kind === 'message' || kind === 'offer') { const data = await api<{ offers: Offer[] }>('offers'); setOffers(data.offers); const offer = data.offers.find(item => item.id === id); if (!offer) throw new Error('Предложение больше недоступно. Посмотри раздел предложений.'); openChat(offer); }
    else if (kind === 'search') { const data = await community<{ listing: Listing }>('listing?id=' + encodeURIComponent(id)); setPeek(data.listing); setModal('preview'); }
  };
  const applySavedSearch = (saved: SavedSearch) => { setSearch(catalog.find(p => p.id === saved.pet)?.name || saved.pet); setVariant(saved.variant === 'any' ? 'all' : saved.variant); setReadyOnly(!!saved.ready_only); setFlyFilter(saved.fly); setRideFilter(saved.ride); setTab('explore'); };
  const toggleFavorite = (listing: Listing) => { if (!requireProfile()) return; void run('favorite-' + listing.id, async () => { await community('favorite', { listingId: listing.id, saved: !extras.favorites.includes(listing.id) }); await extras.refresh(); }); };
  const renderListing = (listing: Listing, example = false, matchKind?: string) => <article className={`plaza-trade-card ${example ? 'plaza-example-card' : ''}`} key={listing.id}>
    <div className="plaza-card-top"><div className="plaza-trader"><span className="plaza-avatar">{listing.nickname?.slice(0, 1).toUpperCase() || 'R'}</span><div><b>{listing.nickname || 'Игрок'}</b><small>{example ? 'Демонстрационное объявление' : formatTime(listing.created_at)}</small></div></div><div className="plaza-card-badges">{!example && <FavoriteButton saved={extras.favorites.includes(listing.id)} disabled={!!busy} onClick={() => toggleFavorite(listing)} />}{listing.hidden ? <span className="plaza-muted-badge">Скрыт модератором</span> : example ? <span className="plaza-example-badge">Пример</span> : isReady(listing) ? <span className="plaza-ready"><i />Готов сейчас</span> : !isOpen(listing) ? <span className="plaza-muted-badge">{listing.status === 'reserved' ? 'Есть договорённость' : listing.status === 'completed' ? 'Обмен завершён' : 'Закрыт / истёк'}</span> : <span className="plaza-muted-badge"><Clock3 size={11} />Открыт</span>}{!example && listing.owner_id !== user?.id && <button className="plaza-icon-button" aria-label="Пожаловаться на объявление" onClick={() => report(listing)}><Flag size={14} /></button>}</div></div>
    {matchKind && <span className="plaza-match-badge"><Sparkles size={13} />{matchKind === 'mutual' ? 'Взаимное совпадение' : 'Открыт к предложениям'}</span>}
    <div className="plaza-trade-columns"><div><div className="plaza-side-label"><span>ОТДАЁТ</span><small>{listing.have.reduce((sum, item) => sum + item.quantity, 0)} шт.</small></div><ItemStack items={listing.have} catalog={catalog} /></div><div className="plaza-exchange-icon"><ArrowLeftRight size={18} /></div><div><div className="plaza-side-label"><span>ХОЧЕТ</span><small>{listing.want.length ? `${listing.want.reduce((sum, item) => sum + item.quantity, 0)} шт.` : 'Любые'}</small></div><ItemStack items={listing.want} catalog={catalog} /></div></div>
    <p className="plaza-card-note">{listing.note || 'Открыт к обсуждению обмена.'}</p>
    {example ? <div className="plaza-example-footer">Так будет выглядеть ваш трейд<ArrowUpRight size={15} /></div> : listing.owner_id === user?.id ? <div className="plaza-manage-actions"><button className="plaza-button plaza-button-soft" disabled={!isOpen(listing)} onClick={() => { setMatchListing(listing.id); setTab('matches'); }}><Sparkles size={14} />Подобрать</button><button className={`plaza-button plaza-button-quiet ${isReady(listing) ? 'is-ready' : ''}`} disabled={!!busy || !isOpen(listing)} onClick={() => changeListing(listing, 'ready')}>{isReady(listing) ? <Check size={14} /> : <Clock3 size={14} />}{isReady(listing) ? 'Готов' : 'Я готов'}</button><button className="plaza-icon-button" disabled={!!busy || ['reserved', 'completed'].includes(listing.status)} title="Продлить объявление" aria-label="Продлить объявление" onClick={() => changeListing(listing, 'renew')}><RefreshCw size={15} /></button>{isOpen(listing) && <button className="plaza-icon-button" disabled={!!busy} title="Закрыть трейд" aria-label="Закрыть трейд" onClick={() => changeListing(listing, 'close')}><X size={15} /></button>}</div> : <button className="plaza-button plaza-card-cta" disabled={!isOpen(listing)} onClick={() => makeOffer(listing)}>Предложить обмен<ArrowUpRight size={16} /></button>}
  </article>;

  return <div className="plaza">
    <header className="plaza-topbar"><a className="plaza-brand" href="/" aria-label="Roskins — главная"><span className="plaza-brand-mark"><ArrowLeftRight size={23} strokeWidth={3} /></span>roskins<span className="plaza-brand-dot">.</span></a><nav className="plaza-top-nav" aria-label="Главная навигация"><button className={tab === 'explore' ? 'is-active' : ''} onClick={() => setTab('explore')}>Трейд-плаза</button><button className={tab === 'mine' ? 'is-active' : ''} onClick={() => setTab('mine')}>Мои трейды</button><button className={tab === 'offers' ? 'is-active' : ''} onClick={() => setTab('offers')}>Предложения{pendingCount > 0 && <span>{pendingCount}</span>}</button></nav><div className="plaza-top-actions">{user && <button className="plaza-icon-button plaza-header-bell" aria-label="Уведомления" onClick={() => setTab('notifications')}><Bell size={20} />{extras.unread > 0 && <span>{extras.unread > 99 ? '99+' : extras.unread}</span>}</button>}{user ? <button className="plaza-profile-button" onClick={() => { setNickname(user.nickname || ''); setRoblox(user.roblox || ''); setModal('profile'); }}><span className="plaza-avatar">{(user.nickname || 'R').slice(0, 1).toUpperCase()}</span><span>{user.nickname || 'Профиль'}</span><ChevronDown size={14} /></button> : <><button className="plaza-button plaza-login" onClick={() => { setAuthMode('login'); setModal('account'); }}><UserRound size={16} />Войти</button><button className="plaza-button plaza-button-lime plaza-register-top" onClick={() => { setAuthMode('register'); setModal('account'); }}>Регистрация</button></>}<button className="plaza-icon-button plaza-menu-toggle" aria-label="Открыть меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Menu size={22} /></button></div></header>
    <div className="plaza-layout"><aside className={`plaza-sidebar ${menuOpen ? 'is-open' : ''}`}><div className="plaza-sidebar-section"><p className="plaza-eyebrow">ИГРОВАЯ ПЛОЩАДКА</p><button className="plaza-game is-active" onClick={() => setTab('explore')}><span><img src="/pets/cow.svg" alt="" width="43" height="43" /></span><div><b>Adopt Me</b><small>Питомцы и предметы</small></div><ChevronDown size={15} /></button></div><div className="plaza-sidebar-section"><p className="plaza-eyebrow">МОЯ ПЛАЗА</p><button className={`plaza-side-nav ${tab === 'explore' ? 'is-active' : ''}`} onClick={() => setTab('explore')}><Layers3 size={18} />Все трейды</button><button className={`plaza-side-nav ${tab === 'matches' ? 'is-active' : ''}`} onClick={() => { if (activeMine.length && !matchListing) setMatchListing(activeMine[0].id); setTab('matches'); }}><Sparkles size={18} />Подбор обменов</button><button className={`plaza-side-nav ${tab === 'mine' ? 'is-active' : ''}`} onClick={() => setTab('mine')}><UserRound size={18} />Мои объявления{mine.length > 0 && <span>{mine.length}</span>}</button><button className={`plaza-side-nav ${tab === 'offers' ? 'is-active' : ''}`} onClick={() => setTab('offers')}><MessageCircle size={18} />Предложения{pendingCount > 0 && <span>{pendingCount}</span>}</button></div><div className="plaza-sidebar-section plaza-extra-navigation"><button className={`plaza-side-nav ${tab === 'favorites' ? 'is-active' : ''}`} onClick={() => setTab('favorites')}><Heart size={18} />Избранное{extras.favorites.length > 0 && <span>{extras.favorites.length}</span>}</button><button className={`plaza-side-nav ${tab === 'searches' ? 'is-active' : ''}`} onClick={() => setTab('searches')}><Bookmark size={18} />Мои поиски</button><button className={`plaza-side-nav ${tab === 'notifications' ? 'is-active' : ''}`} onClick={() => setTab('notifications')}><Bell size={18} />Уведомления{extras.unread > 0 && <span>{extras.unread}</span>}</button>{extras.role === 'admin' && <button className={`plaza-side-nav ${tab === 'admin' ? 'is-active' : ''}`} onClick={() => setTab('admin')}><ShieldCheck size={18} />Администратор</button>}</div><div className="plaza-sidebar-guide"><span className="plaza-guide-icon"><ShieldCheck size={21} /></span><h3>Предметы остаются у тебя</h3><p>Находи друг друга здесь. Обменивайся только внутри игры.</p><div><span>1</span>Создай трейд</div><div><span>2</span>Найди совпадение</div><div><span>3</span>Встреться в Adopt Me</div></div><div className="plaza-sidebar-footer"><b>Создано для трейдеров</b><span>Независимый сервис. Не связан с Roblox или Uplift Games.</span></div></aside>
    <main className="plaza-main">
      {extras.banned && <div className="plaza-alert" role="alert"><ShieldCheck size={18} /><span>Аккаунт заблокирован: {extras.banReason}. Ты можешь просматривать свои уведомления и выйти из аккаунта.</span></div>}{error && <div className="plaza-alert" role="alert"><Flag size={17} /><span>{error}</span><button onClick={() => run('refresh', refresh)}>Повторить</button><button className="plaza-icon-button" aria-label="Скрыть ошибку" onClick={() => setError('')}><X size={15} /></button></div>}
      {tab === 'explore' && <>
        <section className="plaza-hero"><div className="plaza-hero-copy"><div className="plaza-hero-kicker"><span />ADOPT ME TRADE PLAZA<Sparkles size={13} /></div><h1>Меньше поисков.<br /><em>Больше трейдов.</em></h1><p>Выбери, что отдаёшь и что ищешь.<br className="plaza-desktop-break" /> Найди того, с кем ваши желания совпадут.</p><button className="plaza-button plaza-button-lime plaza-hero-cta" onClick={create}><Plus size={18} />Создать трейд<ArrowUpRight size={18} /></button><div className="plaza-hero-assurance"><ShieldCheck size={14} />Без передачи предметов сайту</div></div><div className="plaza-hero-art" aria-hidden="true"><div className="plaza-orbit plaza-orbit-one" /><div className="plaza-orbit plaza-orbit-two" /><span className="plaza-art-star plaza-star-one">✦</span><span className="plaza-art-star plaza-star-two">✦</span><div className="plaza-hero-pet plaza-hero-turtle"><span className="plaza-hero-pet-tag">NEON TURTLE</span><img src="/pets/turtle.svg" alt="" width="180" height="180" /><span className="plaza-hero-attributes"><b>N</b><b>F</b><b>R</b></span></div><div className="plaza-hero-swap"><ArrowLeftRight size={26} /></div><div className="plaza-hero-pet plaza-hero-dragon"><span className="plaza-hero-pet-tag">FROST DRAGON</span><img src="/pets/frost-dragon.svg" alt="" width="180" height="180" /><span className="plaza-hero-attributes"><b>F</b><b>R</b></span></div><span className="plaza-art-caption">Авторские условные иллюстрации</span></div></section>
        <div className="plaza-market-heading"><div><div className="plaza-section-kicker">НАЙДИ СВОЙ СЛЕДУЮЩИЙ ТРЕЙД</div><h2>Торговая площадь<span>Adopt Me</span></h2></div><div className="plaza-real-stats"><span><b>{listLoaded ? listings.length : '—'}</b>в выдаче</span><i /><span><b>{listLoaded ? listings.filter(isReady).length : '—'}</b>готовы сейчас</span></div></div>
        <div className="plaza-filters"><label className="plaza-search"><Search size={18} /><input placeholder="Какого питомца ищешь?" aria-label="Поиск питомца" value={search} onChange={event => setSearch(event.target.value)} list="plaza-pet-options" /><datalist id="plaza-pet-options">{catalog.map(pet => <option key={pet.id} value={pet.name} />)}</datalist>{search && <button className="plaza-icon-button" aria-label="Очистить поиск" onClick={() => setSearch('')}><X size={14} /></button>}</label><div className="plaza-variant-filter" role="group" aria-label="Вариант питомца">{[['all', 'Все'], ['normal', 'Обычные'], ['neon', 'Neon'], ['mega', 'Mega']].map(([value, label]) => <button className={variant === value ? 'is-active' : ''} key={value} onClick={() => setVariant(value)}>{value === 'neon' && <i className="plaza-neon-dot" />}{value === 'mega' && <i className="plaza-mega-dot" />}{label}</button>)}</div><label className="plaza-ready-filter"><input type="checkbox" checked={readyOnly} onChange={event => setReadyOnly(event.target.checked)} /><span className="plaza-switch" />Готовы сейчас</label></div>
        <div className="plaza-extra-filters"><label>Fly<select aria-label="Фильтр Fly" value={flyFilter} onChange={e => setFlyFilter(Number(e.target.value))}><option value={-1}>Неважно</option><option value={1}>С Fly</option><option value={0}>Без Fly</option></select></label><label>Ride<select aria-label="Фильтр Ride" value={rideFilter} onChange={e => setRideFilter(Number(e.target.value))}><option value={-1}>Неважно</option><option value={1}>С Ride</option><option value={0}>Без Ride</option></select></label><button className="plaza-button plaza-button-quiet" onClick={() => { if (!user) { setAuthMode('register'); setModal('account'); } else setTab('searches'); }}><Bookmark size={15} />Сохранить поиск</button><small>{catalog.length} предметов в каталоге</small></div><div className="plaza-results-label"><span>{loading ? <><LoaderCircle size={13} className="plaza-spin" />Обновляем трейды</> : listingCount(shown.length)}</span><span><SlidersHorizontal size={13} />Сначала новые</span></div>
        {!!shown.length && <div className="plaza-card-grid">{shown.map(listing => renderListing(listing))}</div>}
        {!loading && !shown.length && (listings.length > 0 || filtersActive) && <Empty icon={<Search size={26} />} title="Пока нет подходящих трейдов" action={<button className="plaza-button plaza-button-soft" onClick={() => { setSearch(''); setVariant('all'); setReadyOnly(false); setFlyFilter(-1); setRideFilter(-1); }}>Сбросить фильтры</button>}>Попробуй другого питомца или создай своё объявление.</Empty>}
        {!loading && !listings.length && listLoaded && !filtersActive && <><div className="plaza-first-trade"><div><span className="plaza-mini-icon"><Sparkles size={20} /></span><div><h3>Плаза начинается с первого трейда</h3><p>Реальных объявлений пока нет. Опубликуй своё — ниже только примеры оформления.</p></div></div><button className="plaza-button plaza-button-lime" onClick={create}>Стать первым<ArrowRight size={16} /></button></div><div className="plaza-demo-heading"><b>Как выглядит трейд</b><span>4 примера · не реальные предложения</span></div><div className="plaza-card-grid">{SAMPLES.map(listing => renderListing(listing, true))}</div></>}
      </>}
      {tab !== 'explore' && <div className="plaza-page-heading"><div><div className="plaza-section-kicker">ТВОЯ ТОРГОВАЯ ПЛОЩАДКА</div><h1>{({mine:'Мои трейды',matches:'Подбор обменов',offers:'Предложения',favorites:'Избранное',searches:'Мои поиски',notifications:'Уведомления',admin:'Панель администратора'} as Record<string,string>)[tab]}</h1><p>{tab === 'favorites' ? 'Трейды, к которым хочется вернуться.' : tab === 'searches' ? 'Сохраняй интересы и узнавай о новых предложениях.' : tab === 'notifications' ? 'Ответы игроков и подходящие трейды в одном месте.' : tab === 'admin' ? 'Очередь жалоб, модерация и журнал решений.' : tab === 'mine' ? 'Управляй объявлениями и включай готовность, когда ты в игре.' : tab === 'matches' ? 'Ищем игроков, с которыми совпадают ваши запросы.' : 'Договаривайся об обмене и обсуждай детали.'}</p></div>{user && <button className="plaza-button plaza-button-lime" onClick={create}><Plus size={17} />Создать трейд</button>}</div>}
      {tab !== 'explore' && !user && <Empty icon={<UserRound size={27} />} title={authLoaded ? 'Твои трейды будут здесь' : 'Загружаем профиль'} action={<button className="plaza-button plaza-button-lime" onClick={() => { setAuthMode('register'); setModal('account'); }}>Создать аккаунт<ArrowUpRight size={16} /></button>}>Войди, чтобы создавать объявления, получать предложения и общаться. Пароль Roblox не нужен.</Empty>}
      {tab === 'mine' && user && (mine.length ? <div className="plaza-card-grid">{mine.map(listing => renderListing(listing))}</div> : <Empty icon={<Layers3 size={27} />} title="Создай свой первый трейд" action={<button className="plaza-button plaza-button-lime" onClick={create}><Plus size={17} />Создать трейд</button>}>Добавь питомцев, которых отдаёшь, и укажи, что хотел бы получить.</Empty>)}
      {tab === 'matches' && user && <>{activeMine.length ? <><label className="plaza-match-select">Подобрать к объявлению<select value={matchListing} onChange={event => setMatchListing(event.target.value)}><option value="">Выбери свой трейд</option>{activeMine.map(listing => <option value={listing.id} key={listing.id}>{listing.have.map(item => itemName(item, catalog)).join(', ')} → {listing.want.length ? listing.want.map(item => itemName(item, catalog)).join(', ') : 'Любые предложения'}</option>)}</select></label><div className="plaza-info-note"><Sparkles size={17} /><span>Взаимное совпадение учитывает предметы, варианты и количество. Это подсказка для поиска, а не оценка выгодности.</span></div>{matchLoading ? <Empty icon={<LoaderCircle className="plaza-spin" size={27} />} title="Ищем совпадения">Сверяем предложения игроков.</Empty> : matches.length ? <div className="plaza-card-grid">{matches.map(match => renderListing(match.listing, false, match.kind))}</div> : <Empty icon={<ArrowLeftRight size={27} />} title={matchListing ? 'Совпадений пока нет' : 'Выбери свой трейд'}>Новые объявления могут появиться позже. Открытый запрос расширяет круг предложений.</Empty>}</> : <Empty icon={<Sparkles size={27} />} title="Сначала создай объявление" action={<button className="plaza-button plaza-button-lime" onClick={create}><Plus size={17} />Создать трейд</button>}>Чтобы найти совпадение, нужно знать, что ты отдаёшь и что ищешь.</Empty>}</>}
      {tab === 'offers' && user && <><div className="plaza-offer-tabs"><button className={offerDirection === 'incoming' ? 'is-active' : ''} onClick={() => setOfferDirection('incoming')}>Входящие<span>{incoming.length}</span></button><button className={offerDirection === 'outgoing' ? 'is-active' : ''} onClick={() => setOfferDirection('outgoing')}>Отправленные<span>{outgoing.length}</span></button></div><div className="plaza-offer-list">{(offerDirection === 'incoming' ? incoming : outgoing).map(offer => {
        const own = offer.from_id === user.id;
        const confirmed = own ? offer.from_confirmed : offer.to_confirmed;
        const statuses: Record<string, string> = { pending: 'Ожидает ответа', accepted: 'Договорённость', declined: 'Отклонено', cancelled: 'Отменено', completed: 'Обмен подтверждён обоими' };
        return <article className="plaza-offer-card" key={offer.id}><div className="plaza-card-top"><div className="plaza-trader"><span className="plaza-avatar">{(own ? offer.to_nickname : offer.from_nickname)?.slice(0, 1).toUpperCase() || 'R'}</span><div><b>{own ? `Для ${offer.to_nickname}` : `От ${offer.from_nickname}`}</b><small>{formatTime(offer.created_at)}</small></div></div><span className={`plaza-offer-status plaza-status-${offer.status}`}>{statuses[offer.status] || offer.status}</span></div><div className="plaza-offer-items"><div><span className="plaza-side-label">ПРЕДЛАГАЕТ</span><ItemStack items={offer.have} catalog={catalog} small /></div><ArrowLeftRight size={20} /><div><span className="plaza-side-label">В ОБМЕН НА</span><ItemStack items={offer.want} catalog={catalog} small /></div></div>{offer.note && <p className="plaza-card-note">{offer.note}</p>}<div className="plaza-offer-actions"><button className="plaza-button plaza-button-soft" onClick={() => openChat(offer)}><MessageCircle size={15} />Обсудить</button>{offer.status === 'pending' && !own && <><button className="plaza-button plaza-button-lime" disabled={!!busy} onClick={() => changeOffer(offer, 'accept')}><Check size={15} />Принять</button><button className="plaza-button plaza-button-quiet" disabled={!!busy} onClick={() => changeOffer(offer, 'decline')}>Отклонить</button></>}{offer.status === 'pending' && own && <button className="plaza-button plaza-button-quiet" disabled={!!busy} onClick={() => changeOffer(offer, 'cancel')}>Отменить</button>}{offer.status === 'accepted' && <button className="plaza-button plaza-button-lime" disabled={!!busy || confirmed} onClick={() => changeOffer(offer, 'complete')}><CheckCheck size={16} />{confirmed ? 'Вы подтвердили обмен' : 'Я получил предметы'}</button>}<button className="plaza-icon-button" aria-label="Пожаловаться на предложение" onClick={() => report(null, offer)}><Flag size={15} /></button></div>{offer.status === 'accepted' && <p className="plaza-offer-caveat">Принятие — договорённость. Обмен проводится в игре и завершится здесь только после подтверждения обоих участников.</p>}</article>;
      })}</div>{!(offerDirection === 'incoming' ? incoming : outgoing).length && <Empty icon={<MessageCircle size={27} />} title={offerDirection === 'incoming' ? 'Пока нет предложений' : 'Ты ещё не отправлял предложения'} action={<button className="plaza-button plaza-button-soft" onClick={() => setTab('explore')}>Посмотреть трейды<ArrowRight size={15} /></button>}>Найди подходящий трейд или опубликуй свой.</Empty>}</>}
      {user && ['favorites','searches','notifications'].includes(tab) && <CommunitySection key={`${user.id}:${tab}:${tab === 'favorites' ? extras.favorites.join(',') : ''}`} tab={tab} uid={user.id} catalog={catalog} renderListing={listing => renderListing(listing)} refresh={extras.refresh} onOpenNotice={openNotice} onApplySearch={applySavedSearch} draft={{pet:catalog.find(p => p.id.toLowerCase() === search.toLowerCase() || p.name.toLowerCase() === search.toLowerCase())?.id || '',variant,readyOnly,fly:flyFilter,ride:rideFilter}} />}
      {tab === 'admin' && user && (extras.role === 'admin' ? <AdminPanel /> : <Empty icon={<ShieldCheck size={28} />} title="Панель администратора">Для этого раздела нужны права администратора.</Empty>)}
      <footer className="plaza-main-footer"><div className="plaza-footer-about"><span>© {new Date().getFullYear()} Roskins</span><span>Независимый сервис. Не связан с Roblox или Uplift Games.</span><span>Обмены — внутри игры. Без продажи предметов за деньги.</span></div><nav className="plaza-footer-links" aria-label="Документы и поддержка"><a href="/legal/terms">Соглашение</a><a href="/legal/privacy">Конфиденциальность</a><a href="/legal/rules">Правила</a><a href="/legal/cookies">Cookies</a><a href="/legal/parents">Родителям</a><a href="/legal/rights">Правообладателям</a><a href="/legal/contacts">Контакты</a></nav></footer>
    </main></div>
    {notice && <div className="plaza-toast" role="status"><Check size={18} /><span>{notice}</span><button className="plaza-icon-button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {modal && <dialog ref={dialog} className={`plaza-dialog ${modal === 'chat' ? 'plaza-dialog-chat' : ''}`} onCancel={event => { if (modal === 'recovery') event.preventDefault(); else setModal(null); }} onClose={() => { if (modal !== 'recovery') setModal(null); }} onClick={event => { if (event.target === event.currentTarget && modal !== 'recovery') setModal(null); }}><div className="plaza-modal-content"><div className="plaza-modal-top"><div><span className="plaza-section-kicker">ROSKINS TRADE PLAZA</span><h2>{modal === 'preview' ? 'Найденный трейд' : modal === 'account' ? 'Аккаунт Roskins' : modal === 'recovery' ? 'Всё готово!' : modal === 'create' ? 'Создать трейд' : modal === 'offer' ? 'Предложить обмен' : modal === 'profile' ? 'Твой профиль' : modal === 'chat' ? 'Обсуждение обмена' : 'Сообщить о проблеме'}</h2></div><button className="plaza-icon-button" aria-label="Закрыть окно" hidden={modal === 'recovery'} onClick={() => setModal(null)}><X size={21} /></button></div>
      {modalError && <div className="plaza-alert" role="alert"><Flag size={16} /><span>{modalError}</span></div>}
      {modal === 'preview' && peek && <div className="plaza-trade-preview">{renderListing(peek)}</div>}
      {modal === 'account' && <AccountForm initial={authMode} onSuccess={async code => { if (code) { setRecoveryCode(code); setModal('recovery'); } const me = await api<{ user: User | null; authProvider?: string }>('me'); setUser(me.user); setAuthProvider(me.authProvider || null); await loadPersonal(); setError(''); if (!code) { setModal(null); setNotice('Ты вошёл в аккаунт. С возвращением!'); } }} />}
      {modal === 'recovery' && <RecoveryCode code={recoveryCode} onDone={() => { setRecoveryCode(''); setModal(null); setNotice('Аккаунт готов. Можно создавать трейды!'); }} />}
      {modal === 'profile' && user && <form onSubmit={event => { event.preventDefault(); run('profile', async () => { await api('profile', { nickname: nickname.trim(), roblox: roblox.trim() }); const me = await api<{ user: User | null; authProvider?: string }>('me'); setUser(me.user); setModal(null); setNotice('Профиль сохранён.'); }); }}><div className="plaza-account-note"><ShieldCheck size={18} /><div><b>{authProvider === 'roskins' ? 'Аккаунт Roskins' : 'Вход через ChatGPT'}</b><span>Для объявлений используем только твой публичный ник.</span></div></div><label className="plaza-field">Ник на Roskins<input value={nickname} minLength={3} maxLength={24} required placeholder="Например, Moonberry" onChange={event => setNickname(event.target.value)} />{authProvider === 'roskins' && <small>После смены ника используй новый ник для входа.</small>}</label><label className="plaza-field">Имя пользователя Roblox<input value={roblox} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required placeholder="Точный username, не отображаемое имя" onChange={event => setRoblox(event.target.value)} /><small>Указано тобой, не подтверждено Roblox. Сервис не входит в игровой аккаунт.</small></label><div className="plaza-modal-actions"><button type="button" className="plaza-button plaza-button-quiet" onClick={() => setModal(null)}>Отмена</button><button className="plaza-button plaza-button-lime" disabled={!!busy}>{busy === 'profile' && <LoaderCircle size={16} className="plaza-spin" />}Сохранить профиль</button></div></form>}{modal === 'profile' && user && <div className="plaza-profile-logout">{authProvider === 'roskins' ? <button className="plaza-auth-link" disabled={!!busy} onClick={() => run('logout', async () => { await accountRequest('logout', {}); window.location.assign('/signout-with-chatgpt?return_to=%2F'); })}>Выйти из аккаунта</button> : <a className="plaza-auth-link" href="/signout-with-chatgpt?return_to=%2F" target="_top">Выйти из аккаунта</a>}</div>}
      {(modal === 'create' || modal === 'offer') && <form onSubmit={event => { event.preventDefault(); run('save-listing', async () => { validateItems(); if (modal === 'create') { await api('listings', { have, want, note: note.trim() }); setTab('mine'); } else { if (!target) throw new Error('Объявление не найдено.'); await api('offers', { listingId: target.id, have, want: target.have, note: note.trim() }); setOfferDirection('outgoing'); setTab('offers'); } await refresh(); setModal(null); setNotice(modal === 'create' ? 'Трейд опубликован. Теперь можно искать совпадения.' : 'Предложение отправлено.'); }); }}><p className="plaza-modal-intro">{modal === 'create' ? 'Покажи, что у тебя есть. Укажи желаемый обмен или оставь запрос открытым.' : `Предложение для ${target?.nickname || 'игрока'}. Получатель сможет принять его или обсудить детали.`}</p><ItemEditor title="Я отдаю" items={have} setItems={setHave} catalog={catalog} />{modal === 'create' ? <ItemEditor title="Хочу получить" items={want} setItems={setWant} catalog={catalog} optional /> : <section className="plaza-editor"><div className="plaza-editor-heading"><h3>В обмен на</h3><span>Из объявления</span></div><ItemStack items={target?.have || []} catalog={catalog} small /></section>}<label className="plaza-field">Комментарий<span className="plaza-optional">Необязательно</span><textarea value={note} maxLength={280} rows={3} placeholder="Например: рассмотрю похожие варианты" onChange={event => setNote(event.target.value)} /><small>{note.length} / 280</small></label><div className="plaza-info-note"><ShieldCheck size={16} /><span>Не передавай предметы сайту и не сообщай пароль. Договорённость здесь не подтверждает передачу предметов в игре.</span></div><div className="plaza-modal-actions"><button type="button" className="plaza-button plaza-button-quiet" onClick={() => setModal(null)}>Отмена</button><button className="plaza-button plaza-button-lime" disabled={!!busy}>{busy && <LoaderCircle size={16} className="plaza-spin" />}{modal === 'create' ? 'Опубликовать трейд' : 'Отправить предложение'}<ArrowUpRight size={16} /></button></div></form>}
      {modal === 'chat' && conversation && <><div className="plaza-chat-with"><span className="plaza-avatar">{(conversation.from_id === user?.id ? conversation.to_nickname : conversation.from_nickname)?.slice(0, 1).toUpperCase()}</span><div><b>{conversation.from_id === user?.id ? conversation.to_nickname : conversation.from_nickname}</b><small>Roblox: {conversation.from_id === user?.id ? conversation.to_roblox : conversation.from_roblox} · указан пользователем</small></div><RobloxProfile username={(conversation.from_id === user?.id ? conversation.to_roblox : conversation.from_roblox) || ''} /><button className="plaza-icon-button" aria-label="Пожаловаться" onClick={() => report(null, conversation)}><Flag size={16} /></button></div><div className="plaza-chat-messages">{!messages.length && <div className="plaza-chat-empty"><MessageCircle size={25} /><p>Обсудите, когда встретиться в Adopt Me.</p><small>Не делитесь паролями и кодами входа.</small></div>}{messages.map(message => <div key={message.id} className={`plaza-message ${message.sender_id === user?.id ? 'is-own' : ''}`}><p>{message.body}</p><small>{new Date(toMs(message.created_at)).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small></div>)}<div ref={messagesEnd} /></div><form className="plaza-chat-compose" onSubmit={event => { event.preventDefault(); if (!messageBody.trim()) return; run('message', async () => { await api('messages', { offerId: conversation.id, body: messageBody.trim() }); setMessageBody(''); const result = await api<{ messages: Message[] }>(`messages?offer=${encodeURIComponent(conversation.id)}`); setMessages(result.messages || []); }); }}><label className="plaza-sr-only" htmlFor="plaza-chat-body">Сообщение</label><input id="plaza-chat-body" maxLength={1000} value={messageBody} placeholder="Написать сообщение…" onChange={event => setMessageBody(event.target.value)} /><button className="plaza-button plaza-button-lime" aria-label="Отправить сообщение" disabled={!!busy || !messageBody.trim()}><Send size={18} /></button></form></>}
      {modal === 'report' && <form onSubmit={event => { event.preventDefault(); run('report', async () => { await api('report', { ...(target ? { listingId: target.id } : {}), ...(conversation ? { offerId: conversation.id } : {}), reason: reportReason.trim() }); setModal(null); setNotice('Сообщение отправлено на рассмотрение.'); }); }}><p className="plaza-modal-intro">Опиши проблему: спам, попытка обмана или неприемлемое общение. Жалоба не подтверждает нарушение автоматически.</p><label className="plaza-field">Что произошло?<textarea value={reportReason} rows={5} required minLength={10} maxLength={1000} placeholder="Расскажи подробнее…" onChange={event => setReportReason(event.target.value)} /></label><div className="plaza-modal-actions"><button type="button" className="plaza-button plaza-button-quiet" onClick={() => setModal(null)}>Отмена</button><button className="plaza-button plaza-button-lime" disabled={!!busy}>Отправить</button></div></form>}
    </div></dialog>}
  </div>;
}
