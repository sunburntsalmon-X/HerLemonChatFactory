/**
 * 验收测试：商城目录（封面卡片 + 详情页 + 难度分区）
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
  .find((el) => el.querySelector('.shop-card-name')?.textContent?.startsWith(name));
const navOf = (label) => [...document.querySelectorAll('.shop-nav .nav-item')]
  .find((el) => el.textContent.startsWith(label));
const subOf = (label) => [...document.querySelectorAll('.shop-nav .nav-sub')]
  .find((el) => el.textContent.startsWith(label));

await import(path.join(APP, 'core/boot.js'));
await sleep(700);
await sleep(200);

iconByName('商店').click();
await sleep(400);

const card = cardOf('线框按钮');
check('卡片有封面位', !!card?.querySelector('.shop-cover'));
check('格子有作者和难度点', /官方 · ●/.test(card?.querySelector('.shop-card-meta')?.textContent || ''),
  card?.querySelector('.shop-card-meta')?.textContent);
check('卡片有难度点', card?.querySelector('.dots')?.textContent === '●○○',
  card?.querySelector('.dots')?.textContent);
check('格子是上图下文字', card?.firstElementChild?.classList.contains('shop-cover')
  && !!card?.querySelector('.shop-card-body .shop-card-name'));

// 点卡片进详情
card.click();
await sleep(300);
check('进入详情页', !!document.querySelector('.shop-detail'));
check('详情页有大封面', !!document.querySelector('.shop-detail .shop-cover.big'));
check('详情页有作者和更新时间', /更新于 \d{4}-/.test(document.querySelector('.shop-detail .shop-card-meta')?.textContent || ''),
  document.querySelector('.shop-detail .shop-card-meta')?.textContent);
check('详情页有使用教程', [...document.querySelectorAll('.shop-section h3')]
  .some((el) => el.textContent === '使用教程'));
check('详情页有详细介绍', [...document.querySelectorAll('.shop-section h3')]
  .some((el) => el.textContent === '详细介绍'));

// 返回列表
document.querySelector('.btn-back').click();
await sleep(300);
check('返回后回到列表', !!document.querySelector('.shop-card'));

// 难度分区：应用 → 新手
navOf('应用').click();
await sleep(200);
subOf('新手').click();
await sleep(300);
const levels = [...document.querySelectorAll('.shop-card .dots')].map((el) => el.textContent);
check('新手分区只剩一星', levels.length > 0 && levels.every((d) => d === '●○○'),
  `${levels.length} 张，${[...new Set(levels)].join('/')}`);

// 搜索
const search = document.querySelector('.shop-search');
search.value = '线框';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(300);
check('搜索能命中', document.querySelectorAll('.shop-card').length === 1,
  `${document.querySelectorAll('.shop-card').length} 张`);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
