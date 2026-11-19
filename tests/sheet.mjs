/**
 * 验收测试：弹窗（拆成四个模块，同类互斥）
 *
 * - 设置里点「弹窗试一下」能弹出、点空白能关
 * - 装「右往左」：弹窗真的从右边出来
 * - 再装「悬空」：旧的自动卸下，同类别只剩一个
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, ResourceLoader } from 'jsdom';
import 'fake-indexeddb/auto';

const APP = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class LocalStyle extends ResourceLoader {
  async fetch(url) {
    const u = new URL(url);
    const file = u.protocol === 'file:'
      ? decodeURIComponent(u.pathname)
      : path.join(APP, decodeURIComponent(u.pathname));
    return Buffer.from(await readFile(file, 'utf8'));
  }
}

const dom = new JSDOM(
  '<!DOCTYPE html><html><head><link rel="stylesheet" href="./core/styles.css"></head>'
  + '<body><div id="app"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true, resources: new LocalStyle() },
);
const { window } = dom;
const { document } = window;
for (const key of ['window', 'document', 'Node', 'HTMLElement', 'HTMLInputElement', 'Event',
  'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'Blob', 'URL', 'localStorage']) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}

globalThis.fetch = async (url) => {
  const text = await readFile(path.join(APP, String(url).replace(/^\.\//, '')), 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

const iconByName = (name) => [...document.querySelectorAll('.appicon')]
  .find((el) => el.querySelector('small')?.textContent === name);
const cardOf = (name) => [...document.querySelectorAll('.shop-card')]
  .find((el) => el.querySelector('.shop-card-name')?.textContent === name);
const pillOf = (name) => cardOf(name)?.querySelector('.pill');
const back = async () => { document.querySelector('.btn-back')?.click(); await sleep(300); };
const openSettings = async () => { iconByName('设置').click(); await sleep(400); };
const openStore = async () => { iconByName('商店').click(); await sleep(400); };
const openDemo = async () => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '弹窗试一下').click();
  await sleep(200);
  return document.querySelector('.sheet-mask');
};

await import(path.join(APP, 'core/boot.js'));
await sleep(700);

// 基线弹窗能用
await openSettings();
let mask = await openDemo();
check('设置里能弹出弹窗', !!mask);
check('基线是从底部出来的', window.getComputedStyle(mask).alignItems === 'flex-end',
  window.getComputedStyle(mask).alignItems);
mask.click();
await sleep(150);
check('点空白关掉', !document.querySelector('.sheet-mask'));
await back();

// 装右往左
await openStore();
pillOf('弹窗 · 右往左').click();
await sleep(900);
await sleep(200);
await back();
await openSettings();
mask = await openDemo();
check('装上「右往左」后弹窗从右边出来',
  window.getComputedStyle(mask).justifyContent === 'flex-end',
  window.getComputedStyle(mask).justifyContent);
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await sleep(150);
await back();

// 再装悬空：同类互斥，旧的自动卸
await openStore();
pillOf('弹窗 · 悬空').click();
await sleep(900);
await sleep(200);
check('装了悬空后，右往左自动变成「装上」', pillOf('弹窗 · 右往左')?.textContent === '装上',
  pillOf('弹窗 · 右往左')?.textContent);
check('悬空自己是「卸下」', pillOf('弹窗 · 悬空')?.textContent === '卸下',
  pillOf('弹窗 · 悬空')?.textContent);
await back();
await openSettings();
mask = await openDemo();
check('悬空是居中的', window.getComputedStyle(mask).alignItems === 'center',
  window.getComputedStyle(mask).alignItems);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
