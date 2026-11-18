/**
 * 验收测试：换掉外壳，聊天照常跑
 * 只改 app.json 里的 shell 字段，别的什么都不动。
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
  let text = await readFile(file, 'utf8');
  // 唯一的一处改动：把外壳换成侧边栏
  if (file.endsWith('app.json')) text = text.replace('"shell.grid"', '"shell.sidebar"');
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};

await import(path.join(APP, 'core/boot.js'));
await sleep(600);

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

check('侧边栏外壳已挂载', !!document.querySelector('.sidebar-list'));
check('没有格栅桌面', !document.querySelector('.icon-grid'));
check('侧边栏列出全部应用', document.querySelectorAll('.sidebar-item').length === 5);

const sidebarItem = (name) => [...document.querySelectorAll('.sidebar-item')]
  .find((el) => el.textContent.includes(name));
sidebarItem('消息').click();
await sleep(300);
check('应用照样能打开', !!document.querySelector('.chat-list'));

document.querySelectorAll('.chat-item')[0].click();
await sleep(300);
document.querySelector('textarea').value = '换壳之后还能聊吗';
document.querySelector('.btn-send').click();
await sleep(2000);

const bubbles = [...document.querySelectorAll('.bubble')];
check('换壳后聊天照常', bubbles.filter((b) => b.classList.contains('ai')).length >= 2);

console.log(results.every(Boolean) ? '\n✅ 外壳可替换' : '\n❌ 外壳替换失败');
process.exit(results.every(Boolean) ? 0 : 1);
