/**
 * 验收测试：弹窗
 *
 * - 设置里点「弹窗试一下」真的弹出来
 * - 点空白关掉、Esc 关掉
 * - 装上「弹窗」模块后，设置里多出方向选项，改了立刻生效
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
const btnByText = (text) => [...document.querySelectorAll('button')]
  .find((el) => el.textContent.trim() === text);
const back = async () => { document.querySelector('.btn-back')?.click(); await sleep(300); };

await import(path.join(APP, 'core/boot.js'));
await sleep(700);

// 设置 → 弹窗试一下
iconByName('设置').click();
await sleep(400);
btnByText('弹窗试一下').click();
await sleep(200);
check('点按钮真的弹出弹窗', !!document.querySelector('.sheet-mask .sheet'));
check('有标题和正文', (document.querySelector('.sheet-title')?.textContent || '') === '弹窗试一下');

document.querySelector('.sheet-mask').click();
await sleep(150);
check('点空白关掉了', !document.querySelector('.sheet-mask'));

btnByText('弹窗试一下').click();
await sleep(150);
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await sleep(150);
check('按 Esc 关掉了', !document.querySelector('.sheet-mask'));
await back();

// 商店里装上「弹窗」模块
iconByName('商店').click();
await sleep(400);
const uiCard = [...document.querySelectorAll('.shop-card')]
  .find((el) => el.querySelector('.shop-card-name')?.textContent === '弹窗');
check('商城「界面」里有弹窗', !!uiCard);
uiCard.querySelector('.pill').click();
await sleep(900);
await sleep(200);
await back();

// 设置里多了「方向」，改了立刻生效
iconByName('设置').click();
await sleep(400);
const sheetGroup = [...document.querySelectorAll('.group')]
  .find((g) => g.querySelector('h2')?.textContent.startsWith('弹窗'));
check('设置里出现「弹窗」分组', !!sheetGroup);
const select = sheetGroup?.querySelector('select');
check('有方向选项', !!select && select.options.length === 4,
  select ? [...select.options].map((o) => o.text).join('/') : '');
if (select) {
  select.value = 'right';
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(200);
}
check('换成右往左立刻生效', document.documentElement.dataset.sheetSide === 'right',
  document.documentElement.dataset.sheetSide);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
