/**
 * 验收测试：三款背景各自是一个 App
 * 装完 → 桌面出现图标 → 点开是编辑器 → 换另一款时只留一张背景层
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const APP = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

globalThis.fetch = async (url) => {
  const file = path.join(APP, String(url).replace(/^\.\//, ''));
  const text = await readFile(file, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};

await import(path.join(APP, 'core/boot.js'));
await sleep(600);

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

const names = () => [...document.querySelectorAll('.appicon small')].map((e) => e.textContent);
const layer = () => document.querySelector('#bg-layer');
const iconOf = (n) => [...document.querySelectorAll('.appicon')]
  .find((e) => e.querySelector('small')?.textContent === n);
const shopPill = (n) => [...document.querySelectorAll('.shop-item')]
  .find((el) => el.querySelector('.name')?.textContent?.startsWith(n))?.querySelector('.pill');
const closeApp = async () => {
  const back = document.querySelector('.btn-back');
  if (back) { back.click(); await sleep(300); }
};

check('启动时没有背景 App', !names().some((n) => n.includes('背景')), names().join('/'));
check('默认没有背景层', !layer());

// 从商场装「主题色背景」
iconOf('商店').click();
await sleep(400);
shopPill('主题色背景').click();
await sleep(900);
await closeApp();
check('装完桌面多了「主题色背景」', names().includes('主题色背景'), names().join('/'));

// 点它 → 编辑器
iconOf('主题色背景').click();
await sleep(400);
check('点开就是编辑器', !!document.querySelector('.bg-preview'));
check('背景层铺上了', layer()?.dataset.moduleOwned === 'fx.bg.theme',
  layer()?.dataset.moduleOwned || '没有背景层');

// 换模板
[...document.querySelectorAll('.row-chips .chip')].find((c) => c.textContent === '方格').click();
await sleep(300);
const { createVault } = await import(path.join(APP, 'core/vault.js'));
const vault = await createVault();
const saved = await vault.namespace('fx.bg.theme').get('config', {});
check('模板已存本机', saved.template === 'grid', JSON.stringify(saved));
await closeApp();

// 再装「图片背景」
iconOf('商店').click();
await sleep(400);
shopPill('图片背景').click();
await sleep(900);
await closeApp();
check('桌面又多一个', names().includes('图片背景'), names().join('/'));

// 打开图片背景：还没选图，所以不铺层（主题壁纸露出来），但"当前背景"已经切过去了
iconOf('图片背景').click();
await sleep(400);
check('还没选图时不铺层', !layer());
const active = await vault.namespace('core').get('market', {});
check('当前背景已切到图片', active.wallpaper === 'fx.bg.image', String(active.wallpaper));
check('同一时间只有一张背景层', document.querySelectorAll('#bg-layer').length <= 1);
await closeApp();

// 再点回主题色背景，也还是一张
iconOf('主题色背景').click();
await sleep(400);
check('切回主题色背景也只有一张',
  document.querySelectorAll('#bg-layer').length === 1 && layer()?.dataset.moduleOwned === 'fx.bg.theme',
  layer()?.dataset.moduleOwned);

// 桌面空白处乱点不该弹任何东西
document.querySelector('.btn-back').click();
await sleep(300);
document.querySelector('.stage').click();
await sleep(200);
check('点桌面空白什么都不弹', !document.querySelector('.sheet'));

console.log(results.every(Boolean) ? '\n✅ 背景是三个 App' : '\n❌ 背景 App 有问题');
process.exit(results.every(Boolean) ? 0 : 1);
