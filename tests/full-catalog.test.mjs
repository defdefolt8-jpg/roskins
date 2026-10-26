import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { CATALOG, validateItems } from '../lib/plaza-model.mjs';
import { CATALOG_FULL } from '../lib/catalog-full.mjs';
const root=new URL('../',import.meta.url),provenance=JSON.parse(readFileSync(new URL('public/pets/full-catalog-provenance.json',root),'utf8'));
assert.equal(CATALOG_FULL.length,798);assert.equal(CATALOG.length,801);assert.equal(CATALOG.filter(p=>p.kind==='pet').length,798);assert.equal(new Set(CATALOG.map(p=>p.id)).size,801);
assert.equal(provenance.legacy_pet_ids_preserved.length,57);for(const id of provenance.legacy_pet_ids_preserved)assert(CATALOG.some(p=>p.id===id));
for(const pet of CATALOG_FULL){
 assert.match(pet.source_url,/^https:\/\/www\.playadopt\.me\/discover\/pets\/[a-z0-9-]+$/);assert.match(pet.image,/^\/pets\/(all\/)?[a-z0-9_-]+\.(svg|png)$/);
 const file=new URL('public'+pet.image,root);assert(existsSync(file),pet.id+' missing image');
 if(pet.image.endsWith('.png'))assert.equal(readFileSync(file).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 for(const variant of ['normal','neon','mega'])assert.equal(validateItems([{pet:pet.id,variant,fly:true,ride:true,quantity:1}])[0].pet,pet.id);
}
assert(CATALOG.some(p=>p.id==='strawberry-shortcake-bat-dragon'));assert(CATALOG.some(p=>p.id==='zombie-wolf'));assert(CATALOG.some(p=>p.id==='2026-birthday-butterfly'));
console.log('PASS full official pet catalogue: 798 pets, all 57 legacy IDs preserved, 801 total items, all local image paths and PNG signatures, no duplicate IDs, new pets accepted by trade validation.');
