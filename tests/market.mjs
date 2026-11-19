/**
 * 验收测试：商城点一下，小手机就变
 * - 桌面/应用：原地重装（不刷新页面）
 * - 主题：立即生效（连重装都不用）
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

await import(pathToFileURL(path.join(APP, 'core/boot.js')).href);
await sleep(600);

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

const iconByName = (name) => [...document.querySelectorAll('.appicon')]
  .find((el) => el.querySelector('small')?.textContent === name);
const shopItem = (name) => [...document.querySelectorAll('.shop-card')]
  .find((el) => el.querySelector('.shop-card-name')?.textContent?.startsWith(name));
const clickShop = async (name) => {
  const item = shopItem(name);
  if (!item) throw new Error(`商店里找不到「${name}」`);
  item.querySelector('.pill').click();
  await sleep(700);
};
const cssVar = (name) => document.documentElement.style.getPropertyValue(name).trim();

check('启动后是格栅桌面', !!document.querySelector('.icon-grid'));
check('默认主题已注入', cssVar('--bg') === '#0d0f13', cssVar('--bg'));

// 打开商店
iconByName('商店').click();
await sleep(400);
check('商店打开', !!document.querySelector('.shop-grid'));
check('有搜索框', !!document.querySelector('.shop-search'));
check('左边有类型目录', document.querySelectorAll('.nav-item').length >= 4,
  `${document.querySelectorAll('.nav-item').length} 项`);
const cards = document.querySelectorAll('.shop-card').length;
check('货架上有商品', cards >= 6, `${cards} 个`);

// 换桌面
await clickShop('侧边栏');
check('切到侧边栏后，桌面真的换了', !!document.querySelector('.sidebar-list'));
check('旧桌面已移除', !document.querySelector('.icon-grid'));
check('切完之后商店还开着', !!document.querySelector('.shop-grid'));

// 卸载 / 重装
await clickShop('消息');
check('卸载后应用少一个', document.querySelectorAll('.sidebar-item').length === 4);
await clickShop('消息');
check('装回来又变五个', document.querySelectorAll('.sidebar-item').length === 5);

// 换主题：不重装、立即生效
await clickShop('米白');
check('主题色立刻生效', cssVar('--bg') === '#f6f4ef', cssVar('--bg'));
check('商店自己跟着换色', cssVar('--surface') === '#ffffff', cssVar('--surface'));
check('换主题不需要重装', !!document.querySelector('.sidebar-list'));

// 搜索
const search = document.querySelector('.shop-search');
search.value = '侧边';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(200);
check('搜索能过滤', document.querySelectorAll('.shop-card').length === 1,
  `${document.querySelectorAll('.shop-card').length} 个结果`);

search.value = '不存在的东西';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(200);
check('搜不到有提示', !!document.querySelector('.empty-state'));

search.value = '';
search.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(200);

// 难度分区：应用 → 新手
[...document.querySelectorAll('.nav-item')].find((c) => c.textContent.startsWith('应用')).click();
await sleep(200);
[...document.querySelectorAll('.nav-sub')].find((c) => c.textContent.startsWith('新手')).click();
await sleep(200);
const dots = [...document.querySelectorAll('.shop-card .dots')].map((el) => el.textContent);
check('新手分区只留一星', dots.length > 0 && dots.every((d) => d === '●○○'),
  `${dots.length} 张，${[...new Set(dots)].join('/')}`);

// 切回格栅
[...document.querySelectorAll('.nav-item')].find((c) => c.textContent.startsWith('全部')).click();
await sleep(200);
await clickShop('格栅桌面');
check('能切回格栅桌面', !!document.querySelector('.icon-grid'));

const shellLinks = () => [...document.querySelectorAll('link[data-module^="module-css:shell"]')]
  .map((l) => l.dataset.module.replace('module-css:', ''));

// Asael 桌面外壳
await clickShop('Asael 桌面');
check('切到 Asael 桌面', !!document.querySelector('.phone-dock'));
check('只留 Asael 一份外壳样式', shellLinks().length === 1 && shellLinks()[0] === 'shell.asael',
  shellLinks().join(','));
check('Dock 有常驻应用', document.querySelectorAll('.phone-dock .appicon').length === 3,
  `${document.querySelectorAll('.phone-dock .appicon').length} 个`);

// 切回格栅，样式不能还留着 Asael 的
await clickShop('格栅桌面');
check('切回格栅只留自己的样式', shellLinks().length === 1 && shellLinks()[0] === 'shell.grid',
  shellLinks().join(','));

// 商店不能被卸载
check('商店自己是只读的', shopItem('商店')?.querySelector('.pill')?.disabled === true);

console.log(results.every(Boolean) ? '\n✅ 商城一键切换成立' : '\n❌ 商城切换有问题');
process.exit(results.every(Boolean) ? 0 : 1);
