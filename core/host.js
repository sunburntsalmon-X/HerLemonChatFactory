/**
 * 应用容器 host
 *
 * 只管三件事：把 App 挂上去、维护返回栈、出错时兜底。
 * 外壳（shell）负责画桌面，它只调用 host.open()。
 */
import { h } from './dom.js';

export function createHost({ stage, bus, apps }) {
  const stack = [];
  let ctx = null;

  function registerApp(mod) {
    apps.register(mod);
  }

  function open(id, params) {
    const app = apps.get(id);
    if (!app?.mount) return;

    const layer = h('div', { class: 'app-layer' });
    const title = h('h1', {}, app.meta?.name || id);
    const sub = h('div', { class: 'sub' }, '');
    const back = h('button', { class: 'btn-back' }, '‹ 返回');
    const head = h('div', { class: 'app-header' }, back, h('div', {}, title, sub));
    const body = h('div', { class: 'app-body' });

    let backHandler = null;
    back.addEventListener('click', () => {
      if (backHandler) backHandler();
      else close();
    });

    layer.append(head, body);
    stage.append(layer);

    const api = {
      params: params || {},
      setTitle: (text) => { title.textContent = text; },
      setSubtitle: (text) => { sub.textContent = text || ''; },
      /** 设了它，返回键就只在这层里生效（比如聊天列表 → 对话） */
      setBack: (fn, label) => {
        backHandler = fn || null;
        back.textContent = fn ? (label || '‹ 返回') : '‹ 返回';
      },
      close,
    };

    const entry = { layer, instance: null, id };
    stack.push(entry);

    try {
      entry.instance = app.mount(body, ctx, api) || {};
    } catch (err) {
      console.error(`[host] ${id} 启动失败`, err);
      body.append(errorCard(id, err));
    }

    bus.emit('app:opened', { id });
    return entry.instance;

    function close() {
      const at = stack.indexOf(entry);
      if (at < 0) return;
      stack.splice(at, 1);
      try {
        entry.instance?.destroy?.();
      } catch (err) {
        console.error(`[host] ${id} 卸载出错`, err);
      }
      layer.remove();
      bus.emit('app:closed', { id });
    }
  }

  return {
    registerApp,
    open,
    setContext(next) {
      ctx = next;
    },
    isOpen: () => stack.length > 0,

    /** 热重装前清场：卸载所有应用层，清空注册表 */
    reset() {
      while (stack.length) {
        const entry = stack.pop();
        try {
          entry.instance?.destroy?.();
        } catch (err) {
          console.error('[host] 卸载出错', err);
        }
        entry.layer.remove();
      }
      apps.clear();
    },

    closeAll() {
      while (stack.length) stack[stack.length - 1].instance?.destroy?.();
      for (const entry of stack) entry.layer.remove();
      stack.length = 0;
    },
  };
}

function errorCard(id, err) {
  return h('div', { class: 'error-card' },
    h('h3', {}, `「${id}」没能启动`),
    h('pre', {}, String(err?.stack || err?.message || err)),
  );
}
