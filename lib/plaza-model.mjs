import { CATALOG_FULL } from './catalog-full.mjs';
export const CATALOG = Object.freeze([...CATALOG_FULL,...[{"id":"ride-potion","name":"Ride Potion","ru":"Зелье Ride","kind":"potion"},{"id":"fly-potion","name":"Fly Potion","ru":"Зелье Fly","kind":"potion"},{"id":"egg","name":"Cracked Egg","ru":"Треснувшее яйцо","kind":"egg"}]]);
const byId = new Map(CATALOG.map(item => [item.id, item]));
export function itemKey(item) { return `${item.pet}:${item.variant}:${item.fly ? 1 : 0}:${item.ride ? 1 : 0}`; }
export function validateItems(input, options = {}) {
  const allowEmpty = options.allowEmpty === true;
  if (!Array.isArray(input) || input.length > 6 || (!allowEmpty && !input.length)) throw new Error('Выбери от 1 до 6 разных предметов');
  const seen = new Set(); let total = 0;
  const result = input.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный предмет');
    const pet = byId.get(value.pet);
    if (!pet || !['normal', 'neon', 'mega'].includes(value.variant) || typeof value.fly !== 'boolean' || typeof value.ride !== 'boolean') throw new Error('Проверь предмет, вариант и Fly/Ride');
    if (!Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > 18) throw new Error('Количество предметов: от 1 до 18');
    if (pet.kind !== 'pet' && (value.variant !== 'normal' || value.fly || value.ride)) throw new Error('У зелий и яйца нет Neon/Mega или Fly/Ride');
    const item = { pet: value.pet, variant: value.variant, fly: value.fly, ride: value.ride, quantity: value.quantity };
    const key = itemKey(item);
    if (seen.has(key)) throw new Error('Объедини одинаковые предметы в одну строку');
    seen.add(key); total += item.quantity; return item;
  });
  if (total > 18) throw new Error('Не более 18 предметов в одном обмене');
  return result;
}
// Exact attributes, multiset containment, no value or fairness estimate.
export function containsItems(available, requested) {
  const amounts = new Map(available.map(item => [itemKey(item), item.quantity]));
  return requested.every(item => (amounts.get(itemKey(item)) || 0) >= item.quantity);
}
export function matchListings(source, candidates, now = Date.now()) {
  if (source.status !== 'active' || source.expires_at <= now) return [];
  return candidates.filter(candidate => candidate.id !== source.id && candidate.owner_id !== source.owner_id && candidate.status === 'active' && candidate.expires_at > now)
    .filter(candidate => containsItems(candidate.have, source.want) && containsItems(source.have, candidate.want))
    .map(listing => ({ listing, kind: source.want.length && listing.want.length ? 'mutual' : 'open' }))
    .sort((a, b) => Number(b.listing.ready_until > now) - Number(a.listing.ready_until > now) || Number(a.kind === 'open') - Number(b.kind === 'open') || b.listing.created_at - a.listing.created_at);
}
