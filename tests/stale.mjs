/**
 * 回归测试：本机名单里留着已经不存在的模块 id，不能每次都报错
 * （背景从 fx.wallpaper 拆成三款之后，老用户的本机就留着这个 id）
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

const results = [];
const check = (name, cond, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
};

// 模拟老用户的本机：装着已经不存在的模块
const { createVault } = await import(pathToFileURL(path.join(APP, 'core/vault.js')).href);
const vault = await createVault();
await vault.namespace('core').set('market', {
  shell: null,
  wallpaper: 'fx.bg.gone',
  added: ['app.gone'],
  removed: [],
  featuresAdded: ['fx.wallpaper'],
  featuresRemoved: [],
  theme: null,
});

await import(pathToFileURL(path.join(APP, 'core/boot.js')).href);
await sleep(800);

check('照样能启动', document.documentElement.dataset.booted === '1');
check('没有白屏错误卡', !document.querySelector('.error-card'));
check('桌面正常', document.querySelectorAll('.appicon').length >= 4,
  `${document.querySelectorAll('.appicon').length} 个图标`);
check('没有残留背景层', !document.querySelector('#bg-layer'));

const saved = await vault.namespace('core').get('market', {});
check('装不上的功能被摘掉了', !saved.featuresAdded.includes('fx.wallpaper'),
  JSON.stringify(saved.featuresAdded));
check('装不上的应用被摘掉了', !saved.added.includes('app.gone'), JSON.stringify(saved.added));
check('坏掉的背景被切回跟随主题', saved.wallpaper === null, String(saved.wallpaper));

console.log(results.every(Boolean) ? '\n✅ 坏模块会自动清理' : '\n❌ 自愈没生效');
process.exit(results.every(Boolean) ? 0 : 1);
