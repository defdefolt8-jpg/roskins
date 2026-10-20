import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs');
await mkdir(output, { recursive: true });
// markup.ts is a JSON string literal, not code to execute during static export.
const source = await readFile(path.join(root, 'app/markup.ts'), 'utf8');
const literal = source.match(/^export const markup\s*=\s*([\s\S]*);\s*$/)?.[1];
if (!literal) throw new Error('Expected the markup JSON string literal');
let markup = JSON.parse(literal);
markup = markup.replace(/(<main\b[^>]*>)/, '$1<div class="pages-notice" role="note">Каталог в режиме предпросмотра. Регистрация и сделки пока недоступны.</div>');

let client = await readFile(path.join(root, 'public/market.js'), 'utf8');
const apiStart = 'async function api(path,data){';
if (!client.includes(apiStart)) throw new Error('Expected market API function');
client = client.replace(apiStart, apiStart + `
// GitHub Pages serves a static storefront; do not send API calls to github.io.
if(path==='catalog'&&!data)return{listings:[]};
if(path==='me'&&!data)return{user:null};
if(path==='auth/status'&&!data)return{email:false,google:false};
throw new Error('Регистрация и сделки пока недоступны.');
`);
// Platform sign-in belongs to the dynamic server, never to a github.io path.
client = client.replace(/<a class="buy auth-platform" href="\/signin-with-chatgpt\?return_to=%2F" target="_top">Войти через ChatGPT<\/a>/g, '');
if (client.includes('<a class="buy auth-platform"')) throw new Error('Unexpected platform sign-in markup');
const css = (await readFile(path.join(root, 'app/globals.css'), 'utf8')).replaceAll("url('/assets/", "url('./assets/") + '\n.pages-notice{padding:12px 16px;margin-bottom:18px;border:1px solid #354b2d;border-radius:9px;color:#b0f779;background:#121c12;font-size:12px}\n';
const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="roskins — каталог предметов Roblox. Предпросмотр маркетплейса игроков."><title>roskins — предметы Roblox</title><link rel="icon" href="./favicon.svg"><link rel="stylesheet" href="./styles.css"></head><body>${markup}<script src="./market.js" defer></script></body></html>`;
await writeFile(path.join(output, 'index.html'), html);
await writeFile(path.join(output, 'market.js'), client);
await writeFile(path.join(output, 'styles.css'), css);
await writeFile(path.join(output, '.nojekyll'), '');
await cp(path.join(root, 'public/assets'), path.join(output, 'assets'), { recursive: true });
await cp(path.join(root, 'public/favicon.svg'), path.join(output, 'favicon.svg'));
console.log('GitHub Pages storefront exported to docs/ (no server APIs or secrets).');
