/**
 * 验收测试：界面基线 + 皮肤
 *
 * 断言"看得见的结果"：
 * - 不装任何东西，按钮就是好的（内核基线，实心无边框）
 * - 商城「界面」里有「内置（默认）」和「线框按钮」
 * - 点「使用」→ 不刷新，按钮当场变描边（边框 1px），卡片改「使用中」
 * - 点「内置」→ 立刻回到内核基线，皮肤样式表被摘掉
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, ResourceLoader } from 'jsdom';
import 'fake-indexeddb/auto';

const APP = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 把样式表真的加载进来，否则 getComputedStyle 看不到 css
class LocalStyle extends ResourceLoader {
  async fetch(url) {
    const u = new URL(url);
    // 模块的 css 是 file:// URL；index.html 里那类 ./core/... 是相对站点的
    const file = u.protocol === 'file:'
      ? fileURLToPath(u)
      : path.join(APP, decodeURIComponent(u.pathname));
    const text = await readFile(file, 'utf8');
    return Buffer.from(text);
  }
}

// 和 index.html 一样先挂内核样式表：基线现在在内核里
const dom = new JSDOM(
  '<!DOCTYPE html><html><head><link rel="stylesheet" href="./core/styles.css"></head>'
  + '<body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  resources: new LocalStyle(),
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

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

const iconByName = (name) => [...document.querySelectorAll('.appicon')]
  .find((el) => el.querySelector('small')?.textContent === name);
const cardOf = (name) => [...document.querySelectorAll('.shop-card')]
  .find((el) => el.querySelector('.shop-card-name')?.textContent?.startsWith(name));
const pillOf = (name) => cardOf(name)?.querySelector('.pill');
const back = async () => {
  document.querySelector('.btn-back')?.click();
  await sleep(300);
};
const link = () => document.querySelector('link[data-module="module-css:ui.button"]');
const sendBorder = () => window.getComputedStyle(document.querySelector('.btn-send')).borderTopWidth;
const openChat = async () => {
  iconByName('消息').click();
  await sleep(300);
  document.querySelectorAll('.chat-item')[0].click();
  await sleep(300);
};
const openStore = async () => {
  iconByName('商店').click();
  await sleep(400);
};

await import(pathToFileURL(path.join(APP, 'core/boot.js')).href);
await sleep(700);
await sleep(300);

// 1. 内核基线：不装任何东西，按钮也是好的
await openChat();
check('没选皮肤时，发送键是内核基线（实心、无边框）', sendBorder() === '0px', sendBorder());
await back();
await back();

// 2. 商城「界面」：内置 + 线框按钮
await openStore();
check('商城有「界面」分类',
  [...document.querySelectorAll('.group h2')].some((el) => el.textContent.includes('界面')));
check('有「线框按钮」，还没装', pillOf('线框按钮')?.textContent === '装上',
  pillOf('线框按钮')?.textContent);

// 3. 用线框按钮：当场变描边，不刷新
pillOf('线框按钮').click();
await sleep(900);
await sleep(200);
check('皮肤样式表装上了', !!link());
check('卡片改成「卸下」', pillOf('线框按钮')?.textContent === '卸下',
  pillOf('线框按钮')?.textContent);


// 4. 去聊天看：发送键真的变成描边
await back();
await openChat();
check('发送键变成描边（边框 1px）', sendBorder() === '1px', sendBorder());
await back();
await back();

// 5. 卸下皮肤：立刻回到内核基线
await openStore();
pillOf('线框按钮').click();
await sleep(900);
await sleep(200);
check('卸下后皮肤样式表摘掉了', !link());
check('卡片回到「装上」', pillOf('线框按钮')?.textContent === '装上',
  pillOf('线框按钮')?.textContent);
await back();
await openChat();
check('发送键回到实心（边框没了）', sendBorder() === '0px', sendBorder());

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
