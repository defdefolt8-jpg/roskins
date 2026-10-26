'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export type PetOption = { id: string; name: string; ru?: string; image?: string; kind?: string };
const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function petImage(item: PetOption | undefined, id = '') { return item?.image || `/pets/${item?.id || id}.svg`; }
export default function PetPicker({ value, catalog, onChange, label }: { value: string; catalog: PetOption[]; onChange: (id: string) => void; label: string }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null), options = useRef<HTMLDivElement>(null);
  const listId = useId(), selected = catalog.find(item => item.id === value);
  const matches = useMemo(() => { const words = normalize(query).split(' ').filter(Boolean); return catalog.filter(item => { const text = normalize(`${item.name} ${item.id} ${item.ru || ''}`); return words.every(word => text.includes(word)); }); }, [catalog, query]);
  const shown = matches.slice(0, 60);
  const choose = (item: PetOption) => { onChange(item.id); setOpen(false); setQuery(''); setActive(0); trigger.current?.focus(); };
  useEffect(() => { if (open) search.current?.focus(); }, [open]);
  useEffect(() => { const list = options.current, option = list?.children[active] as HTMLElement | undefined; if (!open || !list || !option) return; const rect = option.getBoundingClientRect(), bounds = list.getBoundingClientRect(); if (rect.bottom > bounds.bottom) list.scrollTop += rect.bottom - bounds.bottom; else if (rect.top < bounds.top) list.scrollTop -= bounds.top - rect.top; }, [active, open]);
  useEffect(() => { const close = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, []);
  return <div className="plaza-pet-picker" ref={wrapper} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} className="plaza-pet-picker-trigger" type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => { setOpen(!open); setQuery(''); setActive(0); }}>{selected ? <><img src={petImage(selected)} alt="" width={34} height={34} /><span>{selected.name}</span></> : <span>Выбери питомца или предмет</span>}<ChevronDown size={15} /></button>
    {open && <div className="plaza-pet-picker-popover"><div className="plaza-pet-picker-search"><Search size={17} /><input ref={search} aria-label={`Найти: ${label}`} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined} value={query} placeholder="Название питомца…" autoComplete="off" onChange={e => { setQuery(e.target.value); setActive(0); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active]); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); trigger.current?.focus(); } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setActive(index => Math.max(0, Math.min(shown.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))); } }} /></div>
      <div className="plaza-pet-picker-options" ref={options} role="listbox" id={listId} aria-label={label}>{shown.map((item, index) => <button type="button" role="option" id={`${listId}-${index}`} key={item.id} aria-selected={item.id === value} className={active === index ? 'is-highlighted' : ''} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}><img src={petImage(item)} alt="" width={40} height={40} loading="lazy" /><span>{item.name}</span>{item.kind === 'potion' && <small>Зелье</small>}{item.kind === 'egg' && <small>Яйцо</small>}</button>)}{!shown.length && <p>Ничего не найдено. Попробуй английское название.</p>}</div>
      <small className="plaza-pet-picker-count">{query ? `Найдено ${matches.length}` : `В каталоге ${catalog.length} позиций`}{matches.length > 60 ? ' · показаны первые 60, уточни название' : ''}</small>
    </div>}
  </div>;
}
