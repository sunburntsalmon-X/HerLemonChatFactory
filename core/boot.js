/**
 * 启动器
 *
 * 顺序：读配置 → 建数据仓 → 装配模块 → 挂外壳。
 * 装配逻辑单独抽成 assemble()，商城切换后可以直接重装，不用刷新页面。
 */
import { h, toast, clear, sleep } from './dom.js';
import { sheet } from './sheet.js';
import { createBus } from './bus.js';
import { createVault } from './vault.js';
import { createSettings } from './settings.js';
import { createPrompt } from './prompt.js';
import { createLLM } from './llm.js';
import { createHost } from './host.js';
import { createMarket } from './market.js';
import { createAppRegistry } from './apps.js';
import { createPeople } from './people.js';
import { applyTheme } from './tokens.js';

const root = document.getElementById('app');

/** 改完前端资源就 +1：让浏览器一定拿新文件，别用旧的 JS/CSS */
const VER = '4';

let ctx = null;
let shellInstance = null;
let assembling = false;

boot().catch(fatal);

async function boot() {
  const config = await fetch('./app.json', { cache: 'no-cache' }).then((res) => {
    if (!res.ok) throw new Error(`读不到 app.json（${res.status}）`);
    return res.json();
  });

  const vault = await createVault();
  const bus = createBus();
  const settings = createSettings({ defaults: config, vault, bus });
  await settings.load();

  const market = createMarket({ vault, config });
  await market.load();

  const people = createPeople({ vault, config, bus });
  await people.load();

  const stage = h('div', { class: 'stage' });
  clear(root).append(stage);

  // 主题 = 商店里的预设 + 设置里的强调色/圆角覆盖
  const themeNow = () => {
    const presets = market.themes();
    const preset = presets.find((t) => t.id === market.themeId()) || presets[0] || {};
    const accent = settings.get('theme.accent', null);
    return {
      id: preset.id,
      name: preset.name,
      wallpaper: preset.wallpaper,
      radius: settings.get('theme.radius', preset.radius ?? 22),
      vars: { ...(preset.vars || {}), ...(accent ? { accent } : {}) },
    };
  };
  applyTheme(themeNow(), stage);

  const prompt = createPrompt();
  const llm = createLLM({ settings, bus });
  const apps = createAppRegistry({ bus });
  const host = createHost({ stage, bus, apps });

  ctx = {
    config: settings.all(),
    settings,
    bus,
    vault,
    prompt,
    llm,
    host,
    market,
    people,
    apps,
    stage,
    reboot,
    ui: { h, toast, clear, sleep, sheet },
    applyTheme: () => applyTheme(themeNow(), stage),
  };

  host.setContext(ctx);
  registerCoreSettings({ bus, settings });

  bus.on('settings:changed', ({ path }) => {
    if (String(path).startsWith('theme')) ctx.applyTheme();
  });

  await assemble();

  document.documentElement.dataset.booted = '1';
  console.info('[小手机] 启动完成');
}

/** 装配：清场 → 角色脑子 → 应用 → 外壳 */
async function assemble() {
  shellInstance?.destroy?.();
  shellInstance = null;
  // 模块可能往容器上挂过东西（比如背景层），重装前先清干净
  ctx.stage.querySelectorAll('[data-module-owned]').forEach((el) => el.remove());
  ctx.host.reset();
  ctx.apps.clear();
  ctx.prompt.reset();

  // UI 模块只有样式。先装它，样式表就排在应用 css 前面——应用自带 css 才能盖掉它（D19）
  for (const id of ctx.market.ui()) {
    try {
      const mod = await loadModule(id);
      await mod.setup?.(ctx);
    } catch (err) {
      console.error(`[boot] UI 模块 ${id} 装载失败`, err);
      await ctx.market.forget(id, 'ui');
      toast(`${id} 已经用不了了，已从名单里移除`);
    }
  }

  // 角色"脑子"：由人物的 runtime 字段决定，用到才加载
  const runtimes = new Set(ctx.people.list().map((c) => c.runtime || 'runtime.chat'));
  for (const id of runtimes) {
    try {
      const mod = await loadModule(id);
      await mod.setup?.(ctx);
    } catch (err) {
      console.error(`[boot] 角色脑子 ${id} 装载失败`, err);
      toast(`${id} 装载失败`);
    }
  }

  // 应用先进注册表，功能模块后进——功能自带的 App 自然排在配置的应用后面
  for (const id of ctx.market.apps()) {
    try {
      const mod = await loadModule(id);
      await mod.setup?.(ctx);
      ctx.apps.register(mod);
    } catch (err) {
      console.error(`[boot] 应用 ${id} 装载失败`, err);
      await ctx.market.forget(id, 'app');
      toast(`${id} 已经用不了了，已从名单里移除`);
    }
  }

  // 功能模块：不占桌面，但可以投提示词、加设置、或者自己注册一个 App
  for (const id of ctx.market.features()) {
    try {
      const mod = await loadModule(id);
      await mod.setup?.(ctx);
    } catch (err) {
      console.error(`[boot] 功能 ${id} 装载失败`, err);
      await ctx.market.forget(id, 'feature');
      toast(`${id} 已经用不了了，已从名单里移除`);
    }
  }

  const apps = ctx.apps;

  // 现在真正生效的有哪些模块；不在里面的样式表全摘掉。
  // 换外壳残留（D20b）、卸掉的应用、卸掉的 UI 模块，都靠这一段收干净。
  const activeShell = ctx.market.shell();
  const live = new Set([
    ...ctx.market.ui(),
    ...runtimes,
    ...ctx.market.apps(),
    ...ctx.market.features(),
    activeShell,
  ]);
  for (const link of document.querySelectorAll('link[data-module^="module-css:"]')) {
    const id = link.dataset.module.slice('module-css:'.length);
    if (!live.has(id)) link.remove();
  }

  try {
    const shell = await loadModule(activeShell);
    shell.setup?.(ctx);
    shellInstance = shell.mount(ctx.stage, ctx, { apps });
  } catch (err) {
    console.error('[boot] 外壳装载失败', err);
    ctx.stage.append(h('div', { class: 'error-card' },
      h('h3', {}, '外壳没能启动'),
      h('pre', {}, String(err?.message || err))));
  }

  ctx.bus.emit('boot:done', { apps: apps.list().map((a) => a.id) });
}

/** 商城切换后调用：重装，不刷新页面；reopen 指定重装后再打开哪个应用 */
async function reboot(reopen) {
  if (assembling) return;
  assembling = true;
  try {
    await assemble();
    if (reopen) ctx.host.open(reopen);
  } catch (err) {
    console.error('[boot] 重装失败', err);
    toast('切换失败，看看设置里的错误信息');
  } finally {
    assembling = false;
  }
}

async function loadModule(id) {
  if (!id || !/^[a-z][\w.-]*$/i.test(id)) throw new Error(`非法的模块 id：${id}`);
  const mod = await import(`../modules/${id}/index.js?v=${VER}`);
  const m = mod.default;
  if (!m) throw new Error(`${id} 没有 default 导出`);
  if (m.api !== '1.x') throw new Error(`${id} 要求 api ${m.api || '(未声明)'}，当前是 1.x`);
  if (m.css) injectCSS(id, m.css);
  return m;
}

/** 模块可以自带样式，内核只负责把链接插进去一次 */
function injectCSS(id, file) {
  const mark = `module-css:${id}`;
  if (document.querySelector(`link[data-module="${mark}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${new URL(`../modules/${id}/${file}`, import.meta.url).href}?v=${VER}`;
  link.dataset.module = mark;
  document.head.append(link);
}

function fatal(err) {
  console.error(err);
  clear(root).append(
    h('div', { class: 'error-card' },
      h('h3', {}, '启动失败了'),
      h('pre', {}, String(err?.stack || err?.message || err)),
      h('p', { style: { color: 'var(--dim)', fontSize: '12px', marginTop: '10px' } },
        '把这张卡片截图发给你的助手，它能照着修。')),
  );
}

/** 内核自带的两组设置；模块可以自己再加 */
function registerCoreSettings({ bus, settings }) {
  bus.settings.register({
    id: 'core.ai',
    title: '模型',
    fields: [
      {
        key: 'ai.provider', label: '来源', type: 'select',
        options: [['mock', '演示模式'], ['openai', 'OpenAI 兼容']],
        hint: '演示模式不联网',
      },
      { key: 'ai.baseUrl', label: '接口', type: 'text', placeholder: 'https://api.deepseek.com/v1' },
      { key: 'ai.model', label: '模型', type: 'text', placeholder: 'deepseek-chat' },
      {
        key: 'ai.key', label: '密钥', type: 'password',
        get: async () => '',
        set: (value) => settings.setKey(value),
        hint: '只存本机，不进仓库',
      },
    ],
  });

  bus.settings.register({
    id: 'core.theme',
    title: '外观',
    fields: [
      {
        key: 'theme.accent', label: '强调色', type: 'color',
        hint: '会盖过主题自带的颜色',
      },
      { key: 'theme.radius', label: '圆角', type: 'range', min: 6, max: 36 },
    ],
  });
}
