/**
 * 配置：app.json 是默认值，用户在设置页里的改动存在 vault 里，启动时合并。
 * 密钥不进 app.json、不进仓库，只存本地。
 */
export function createSettings({ defaults, vault, bus }) {
  const store = vault.namespace('core');
  let values = clone(defaults);

  function get(path, fallback) {
    const value = read(values, path);
    return value === undefined ? fallback : value;
  }

  async function load() {
    const saved = await store.get('settings', null);
    // 旧版本把 apps/features/shell 也存进了快照；不采信这些键，否则 app.json 后来新增的项会被盖掉
    if (saved && typeof saved === 'object') values = deepMerge(clone(defaults), persistable(saved));
    return values;
  }

  async function set(path, value) {
    write(values, path, value);
    await store.set('settings', persistable(values));
    bus.emit('settings:changed', { path, value });
  }

  async function reset() {
    values = clone(defaults);
    await store.set('settings', persistable(values));
    bus.emit('settings:changed', { path: '*', value: null });
  }

  async function setKey(secret) {
    await store.set('ai.key', secret || '');
    bus.emit('settings:changed', { path: 'ai.key', value: secret ? '***' : '' });
  }

  async function getKey() {
    return (await store.get('ai.key', '')) || '';
  }

  return { get, set, load, reset, setKey, getKey, all: () => values };
}

/**
 * characters 留在 app.json 里，不跟着设置一起存。
 * apps/features/shell 同样属于出厂清单与商城的选择，存快照会挡住 app.json 后来的新增项。
 */
function persistable(values) {
  const { characters, apps, features, shell, ...rest } = values;
  return rest;
}

function read(obj, path) {
  return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function write(obj, path, value) {
  const keys = String(path).split('.');
  const last = keys.pop();
  let cursor = obj;
  for (const key of keys) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[last] = value;
}

function deepMerge(base, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)
      && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      deepMerge(base[key], value);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
