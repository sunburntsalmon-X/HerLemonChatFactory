/**
 * App 注册表
 *
 * 这是"有哪些 App"的唯一一条线：谁注册、谁注销，外壳只订阅不操心。
 * 之前是启动时算一个数组塞给外壳——快照式的，装完就定死，谁后加都不显示。
 */
export function createAppRegistry({ bus }) {
  const items = new Map();

  function emit() {
    bus.emit('apps:changed', { count: items.size });
  }

  return {
    register(app) {
      if (!app?.id) throw new Error('App 必须有 id');
      items.set(app.id, app);
      emit();
    },

    remove(id) {
      if (items.delete(id)) emit();
    },

    get(id) {
      return items.get(id);
    },

    list() {
      return [...items.values()];
    },

    clear() {
      items.clear();
    },

    /** 外壳订阅这个，App 一多一少就重画 */
    on(fn) {
      return bus.on('apps:changed', fn);
    },
  };
}
