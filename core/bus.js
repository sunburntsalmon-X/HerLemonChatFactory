/**
 * 事件总线
 * 模块之间唯一的"嘴"：只能广播，不能互相持有引用。
 */
export function createBus() {
  const handlers = new Map();
  const groups = new Map();

  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => this.off(event, fn);
    },

    off(event, fn) {
      handlers.get(event)?.delete(fn);
    },

    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          // 一个监听器崩了，不能连累其他模块
          console.error(`[bus] ${event} 处理出错`, err);
        }
      }
    },

    /** 设置项注册表：模块声明自己的设置，设置页自动生成 */
    settings: {
      register(group) {
        if (!group?.id) throw new Error('设置组必须有 id');
        groups.set(group.id, group);
      },
      all() {
        return [...groups.values()];
      },
    },
  };
}
