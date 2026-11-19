/**
 * 验收测试：通讯录里新建 / 修改 / 删除人物，聊天那边立刻能看到
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
// 删除有确认框，测试里一律"确定"
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
const rows = () => [...document.querySelectorAll('.contacts .chat-item')];

check('启动完成', document.documentElement.dataset.booted === '1');

// 打开通讯录
iconByName('通讯录').click();
await sleep(400);
check('通讯录列出 app.json 里的两个人', rows().length === 2, `${rows().length} 个`);

// 新建
document.querySelector('.contacts-bar .btn.primary').click();
await sleep(300);
check('新建页打开', !!document.querySelector('.field.col textarea'));

document.querySelector('input[placeholder="名字"]').value = '小满';
document.querySelector('textarea[placeholder^="这个人是谁"]').value = '你叫小满，说话软，喜欢用比喻。';
document.querySelector('textarea[placeholder^="打开对话"]').value = '你来啦。';
document.querySelector('input[placeholder^="慢热"]').value = '温柔、爱联想';
[...document.querySelectorAll('.btn')].find((b) => b.textContent === '保存').click();
await sleep(400);

check('保存后回到列表', !!document.querySelector('.contacts .chat-item'));
check('列表里多了一个人', rows().length === 3, `${rows().length} 个`);

// 回桌面，进消息，看聊天列表
document.querySelector('.btn-back').click();
await sleep(300);
iconByName('消息').click();
await sleep(400);
const chatRows = [...document.querySelectorAll('.chat-list .chat-item')];
check('聊天列表跟着变成三个', chatRows.length === 3, `${chatRows.length} 个`);
check('新人出现在聊天列表', chatRows.some((r) => r.textContent.includes('小满')));

// 进去聊一句，确认用的是新人设
chatRows.find((r) => r.textContent.includes('小满')).click();
await sleep(300);
check('开场白是新写的', (document.querySelector('.bubble')?.textContent || '').includes('你来啦'));
document.querySelector('textarea').value = '今天有点累';
document.querySelector('.btn-send').click();
await sleep(2000);
check('能正常回话', document.querySelectorAll('.bubble').length >= 3);

// 回桌面 → 通讯录 → 删除小满
document.querySelector('.btn-back').click();
await sleep(200);
document.querySelector('.btn-back').click();
await sleep(300);
iconByName('通讯录').click();
await sleep(400);
rows().find((r) => r.textContent.includes('小满')).click();
await sleep(300);
[...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('删除')).click();
await sleep(400);
check('删除后回到两个人', rows().length === 2, `${rows().length} 个`);

// 落盘检查（删除之后、恢复默认之前）
const { createVault } = await import(pathToFileURL(path.join(APP, 'core/vault.js')).href);
const vault = await createVault();
const saved = await vault.namespace('core').get('characters', null);
check('改动已写进数据仓', Array.isArray(saved) && saved.length === 2,
  `${saved ? saved.length + ' 条' : '没写入'}`);

// 恢复默认
document.querySelector('.contacts-bar .btn:not(.primary)').click();
await sleep(400);
check('恢复默认后还是两个人', rows().length === 2);
check('恢复默认清掉了本机覆盖',
  (await vault.namespace('core').get('characters', null)) === null);

console.log(results.every(Boolean) ? '\n✅ 通讯录换角色成立' : '\n❌ 通讯录有问题');
process.exit(results.every(Boolean) ? 0 : 1);
