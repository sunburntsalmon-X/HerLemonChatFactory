/**
 * 冒烟测试：假装自己是个浏览器，把整个应用跑一遍
 * 跑法：node smoke.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import 'fake-indexeddb/auto';

const APP = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const { window } = dom;
const { document } = window;

for (const key of [
  'window', 'document', 'Node', 'HTMLElement', 'HTMLInputElement', 'Event',
  'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'Blob', 'URL', 'FileReader', 'localStorage',
]) {
  if (window[key] !== undefined) globalThis[key] = window[key];
}
globalThis.requestAnimationFrame ||= (fn) => setTimeout(() => fn(Date.now()), 16);

// fetch 桩：只服务本地文件
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const raw = String(url);
  if (opts.body && String(opts.body).includes('"messages"')) {
    return { ok: false, status: 500, text: async () => '不该走到真网络' };
  }
  const file = path.join(APP, raw.replace(/^\.\//, '').replace(/^http:\/\/localhost\//, ''));
  try {
    const text = await readFile(file, 'utf8');
    return {
      ok: true, status: 200,
      json: async () => JSON.parse(text),
      text: async () => text,
    };
  } catch {
    return { ok: false, status: 404, text: async () => 'not found' };
  }
};

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

process.on('unhandledRejection', (err) => console.error('⚠️ 未捕获的 rejection:', err));

await import(path.join(APP, 'core/boot.js'));

await sleep(600);

check('启动完成标记', document.documentElement.dataset.booted === '1');
check('没有致命错误卡片', !document.querySelector('.error-card'));
check('桌面图标渲染', document.querySelectorAll('.appicon').length === 5,
  `找到 ${document.querySelectorAll('.appicon').length} 个`);

const iconByName = (name) => [...document.querySelectorAll('.appicon')]
  .find((el) => el.querySelector('small')?.textContent === name);

// 进入消息
iconByName('消息').click();
await sleep(300);
check('消息列表出现', !!document.querySelector('.chat-list'));
check('列出两个人物', document.querySelectorAll('.chat-item').length === 2,
  `找到 ${document.querySelectorAll('.chat-item').length} 个`);

// 进入对话
document.querySelectorAll('.chat-item')[0].click();
await sleep(300);
check('对话页出现', !!document.querySelector('.thread'));
check('开场白已显示', (document.querySelector('.bubble')?.textContent || '').includes('你来了'),
  document.querySelector('.bubble')?.textContent);

// 发一条消息
const input = document.querySelector('.composer textarea');
input.value = '今天下雨了';
document.querySelector('.btn-send').click();
await sleep(2200);

const bubbles = [...document.querySelectorAll('.bubble')];
check('用户消息已上屏', bubbles.some((b) => b.classList.contains('user')));
check('AI 回复已上屏', bubbles.filter((b) => b.classList.contains('ai')).length >= 2,
  `AI 气泡 ${bubbles.filter((b) => b.classList.contains('ai')).length} 个`);
check('回复不是空的', (bubbles.at(-1)?.textContent || '').length > 2, bubbles.at(-1)?.textContent);

// 返回列表 → 设置
document.querySelector('.btn-back').click();
await sleep(300);
check('返回到消息列表', !!document.querySelector('.chat-list'));
document.querySelector('.btn-back').click();
await sleep(300);
check('返回到桌面', !!document.querySelector('.icon-grid'));

// 设置页自动生成
iconByName('设置').click();
await sleep(300);
const groups = document.querySelectorAll('.group h2').length;
check('设置页由模块自动生成', groups >= 3, `${groups} 组`);

// 提示词管线
const dumpBtn = [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('提示词'));
check('提示词拼装按钮存在', !!dumpBtn);
if (dumpBtn) {
  dumpBtn.click();
  await sleep(100);
  const dump = document.querySelector('.prompt-dump');
  check('能看到拼装内容', (dump?.textContent || '').includes('runtime.chat'), dump?.textContent?.slice(0, 60));
}

// 数据仓持久化
const { createVault } = await import(path.join(APP, 'core/vault.js'));
const vault = await createVault();
const ns = vault.namespace('app.chat');
const conv = await ns.get('conv:ayan', null);
check('对话已写入数据仓', Array.isArray(conv) && conv.length >= 3, `${conv?.length} 条`);
const exported = await vault.exportAll();
check('能整体导出', Object.keys(exported).includes('app.chat'));

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? '❌' : '✅'} 通过 ${results.length - failed.length}/${results.length}`);
if (failed.length) process.exitCode = 1;
process.exit(failed.length ? 1 : 0);
