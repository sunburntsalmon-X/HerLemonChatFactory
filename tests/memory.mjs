/**
 * 验收测试：记忆是一个纯模块
 * 聊够轮数 → 自动记一笔 → 下次开口时真的被带进提示词 → 能删
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
globalThis.confirm = () => true;
window.confirm = () => true;

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

check('启动完成', document.documentElement.dataset.booted === '1');
check('功能模块自带的「记忆」App 出现在桌面', !!iconByName('记忆'));
check('功能模块没有占「应用」的位置', document.querySelectorAll('.appicon').length === 5,
  `${document.querySelectorAll('.appicon').length} 个图标`);

// 和阿岩聊三轮（默认每 3 轮记一次）
iconByName('消息').click();
await sleep(350);
document.querySelectorAll('.chat-item')[0].click();
await sleep(300);

const say = async (text) => {
  document.querySelector('textarea').value = text;
  document.querySelector('.btn-send').click();
  await sleep(1900);
};

await say('我最近在学吉他，手指好疼');
await say('每天下班练半小时');
await say('下个月想去听现场');

const { createVault } = await import(pathToFileURL(path.join(APP, 'core/vault.js')).href);
const vault = await createVault();
const items = await vault.namespace('memory.simple').get('items:ayan', []);
check('聊够轮数后自动记了一笔', Array.isArray(items) && items.length === 1,
  `${items?.length ?? 0} 条`);
check('记忆内容来自对话', (items?.[0]?.text || '').includes('吉他') || (items?.[0]?.text || '').includes('用户'),
  items?.[0]?.text?.slice(0, 40));

// 记忆 App 能看到
document.querySelector('.btn-back').click();
await sleep(200);
document.querySelector('.btn-back').click();
await sleep(300);
iconByName('记忆').click();
await sleep(350);
check('记忆 App 里能看到它', document.querySelectorAll('.settings .field').length >= 1);
check('有清空按钮', [...document.querySelectorAll('.btn')].some((b) => b.textContent.includes('清空')));

// 回消息页再聊一句，看提示词里有没有记忆段
document.querySelector('.btn-back').click();
await sleep(250);
iconByName('消息').click();
await sleep(300);
document.querySelectorAll('.chat-item')[0].click();
await sleep(300);
await say('你记得我在练什么吗');

document.querySelector('.btn-back').click();
await sleep(200);
document.querySelector('.btn-back').click();
await sleep(250);
iconByName('设置').click();
await sleep(300);
[...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('提示词')).click();
await sleep(150);
const dump = document.querySelector('.prompt-dump')?.textContent || '';
check('提示词拼装里出现了记忆段', dump.includes('memory.simple'), dump.slice(0, 40));
check('记忆段带了内容', dump.includes('记得') || dump.includes('用户'));

// 删掉这条记忆
document.querySelector('.btn-back').click();
await sleep(250);
iconByName('记忆').click();
await sleep(350);
document.querySelector('.settings .field .pill').click();
await sleep(300);
const left = await vault.namespace('memory.simple').get('items:ayan', []);
check('删完就空了', Array.isArray(left) && left.length === 0, `${left?.length ?? 0} 条`);
check('空的时候有提示', !!document.querySelector('.empty-state'));

console.log(results.every(Boolean) ? '\n✅ 记忆模块成立' : '\n❌ 记忆有问题');
process.exit(results.every(Boolean) ? 0 : 1);
