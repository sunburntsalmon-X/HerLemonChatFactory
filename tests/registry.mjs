/**
 * 回归测试：装过东西之后，app.json 里后来新增的 App 还能不能进来
 *
 * 老 bug：商城第一次安装时把整个列表存成本机快照，
 * 之后 app.json 再加什么，都被那份旧快照盖住，永远不显示。
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const APP = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 临时造一个只在测试里存在的 App
const FIXTURE = path.join(APP, 'modules', 'app.probe');
await mkdir(FIXTURE, { recursive: true });
await writeFile(path.join(FIXTURE, 'index.js'), `export default {
  id: 'app.probe', kind: 'app', api: '1.x',
  meta: { name: '探针', icon: '◌' },
  mount(body, ctx, api) { api.setTitle('探针'); return { destroy() {} }; },
};
`);

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;
for (const key of ['window', 'document', 'Node', 'HTMLElement', 'HTMLInputElement', 'Event',
  'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'Blob', 'URL', 'localStorage']) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}

// app.json 可以在测试中途被改（模拟"后来新增的 App"）
const state = { extraApp: false };

globalThis.fetch = async (url) => {
  const file = path.join(APP, String(url).replace(/^\.\//, ''));
  let text = await readFile(file, 'utf8');
  if (file.endsWith('app.json') && state.extraApp) {
    const conf = JSON.parse(text);
    conf.apps.push('app.probe');
    text = JSON.stringify(conf);
  }
  if (file.endsWith('store.json')) {
    const conf = JSON.parse(text);
    conf.modules.push({ id: 'app.probe', kind: 'app', name: '探针', version: '0.1.0', icon: '◌', summary: '测试' });
    text = JSON.stringify(conf);
  }
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

// 先模拟"老版本留下的整份列表快照"：只有原来的四个应用，没有后来新增的探针
state.extraApp = true;
const { createVault } = await import(pathToFileURL(path.join(APP, 'core/vault.js')).href);
const seed = await createVault();
await seed.namespace('core').set('market', {
  apps: ['app.chat', 'app.store', 'app.settings', 'app.contacts'],
});

await import(pathToFileURL(path.join(APP, 'core/boot.js')).href);
await sleep(600);

const names = () => [...document.querySelectorAll('.appicon small')].map((e) => e.textContent);
const shopPill = (n) => [...document.querySelectorAll('.shop-card')]
  .find((el) => el.querySelector('.shop-card-name')?.textContent?.startsWith(n))?.querySelector('.pill');
const clickIcon = (n) => [...document.querySelectorAll('.appicon')]
  .find((e) => e.querySelector('small')?.textContent === n)?.click();

check('旧快照没挡住新 App', names().includes('探针'), names().join('/'));
check('原有应用一个不少', ['消息', '商店', '设置', '通讯录'].every((n) => names().includes(n)),
  names().join('/'));

// 再卸掉一个，确认差量真的生效（而不是又存一份快照）
clickIcon('商店');
await sleep(400);
shopPill('设置').click();
await sleep(900);
check('卸载生效', !names().includes('设置'), names().join('/'));
check('卸载之后探针还在', names().includes('探针'), names().join('/'));

await rm(FIXTURE, { recursive: true, force: true });
console.log(results.every(Boolean) ? '\n✅ 新增 App 能进得来' : '\n❌ 还是被旧快照挡住了');
process.exit(results.every(Boolean) ? 0 : 1);
