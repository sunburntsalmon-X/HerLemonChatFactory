/**
 * 商城
 *
 * 只做三件事：读清单（store.json）、记状态（本机覆盖）、告诉内核现在生效的是什么。
 * 三类东西可以装：外壳（单选）、应用、功能模块。
 */
export function createMarket({ vault, config }) {
  const store = vault.namespace('core');
  let manifest = { name: '商店', modules: [], themes: [] };
  // 只记"加了谁 / 删了谁"，不存整份列表——存快照会让 app.json 后来新增的永远进不来
  let overrides = { shell: null, wallpaper: null, added: [], removed: [], featuresAdded: [], featuresRemoved: [], theme: null };

  async function load() {
    try {
      const res = await fetch('./store.json', { cache: 'no-cache' });
      if (res.ok) manifest = await res.json();
    } catch (err) {
      console.warn('[market] 读不到 store.json，商城会是空的', err);
    }
    const saved = await store.get('market', null);
    if (saved && typeof saved === 'object') overrides = migrate(saved, config);

    // 背景槽位里如果是一个已经不存在的模块，清掉，别留个指不到东西的记号
    const known = new Set((manifest.modules || []).map((m) => m.id));
    if (overrides.wallpaper && !known.has(overrides.wallpaper)) {
      overrides.wallpaper = null;
      await save();
    }
    return manifest;
  }

  function save() {
    return store.set('market', overrides);
  }

  /** 生效列表 = 出厂列表 − 删掉的 + 后来装上的 */
  function resolve(key) {
    const builtIn = config[key] || [];
    const added = overrides[key === 'features' ? 'featuresAdded' : 'added'];
    const removed = overrides[key === 'features' ? 'featuresRemoved' : 'removed'];
    return [
      ...builtIn.filter((id) => !removed.includes(id)),
      ...added.filter((id) => !builtIn.includes(id)),
    ];
  }

  const apps = () => resolve('apps');
  const features = () => resolve('features');
  const shell = () => overrides.shell || config.shell;
  const wallpaper = () => overrides.wallpaper || config.wallpaper || null;

  async function setWallpaper(id) {
    overrides.wallpaper = id || null;
    await save();
  }

  async function install(id, kind = 'app') {
    const isFeature = kind === 'feature';
    const added = isFeature ? 'featuresAdded' : 'added';
    const removed = isFeature ? 'featuresRemoved' : 'removed';
    overrides[removed] = overrides[removed].filter((x) => x !== id);
    if (!overrides[added].includes(id)) overrides[added].push(id);
    await save();
  }

  async function uninstall(id, kind = 'app') {
    const isFeature = kind === 'feature';
    const added = isFeature ? 'featuresAdded' : 'added';
    const removed = isFeature ? 'featuresRemoved' : 'removed';
    overrides[added] = overrides[added].filter((x) => x !== id);
    if (!overrides[removed].includes(id)) overrides[removed].push(id);
    await save();
  }

  /** 模块已经不存在了（比如被拆走/改名），从本机名单里摘掉，别再每次启动都报错 */
  async function forget(id, kind = 'app') {
    const isFeature = kind === 'feature';
    const added = isFeature ? 'featuresAdded' : 'added';
    const next = overrides[added].filter((x) => x !== id);
    if (next.length === overrides[added].length) return false;
    overrides[added] = next;
    await save();
    return true;
  }

  async function setShell(id) {
    overrides.shell = id;
    await save();
  }

  function themeId() {
    return overrides.theme || config.theme?.preset || 'ink';
  }

  const themes = () => manifest.themes || [];

  async function setTheme(id) {
    overrides.theme = id;
    await save();
  }

  async function reset() {
    overrides = { shell: null, wallpaper: null, added: [], removed: [], featuresAdded: [], featuresRemoved: [], theme: null };
    await store.del('market');
  }

  /** 清单 + 当前状态，给商店界面用 */
  function list(kind) {
    return (manifest.modules || [])
      .filter((m) => !kind || m.kind === kind)
      .map((m) => {
        const single = m.kind === 'shell' || m.kind === 'wallpaper';
        const on = m.kind === 'shell'
          ? shell() === m.id
          : m.kind === 'wallpaper'
            ? wallpaper() === m.id
            : m.kind === 'feature'
              ? features().includes(m.id)
              : apps().includes(m.id);
        return { ...m, installed: on, active: single ? on : false };
      });
  }

  return {
    load, list,
    shell, apps, features, setShell, wallpaper, setWallpaper, forget,
    themeId, themes, setTheme,
    install, uninstall, reset,
    manifest: () => manifest,
    raw: () => overrides,
  };
}

/** 老数据是"整份列表"，迁移成差量，不然新增的 App 永远进不来 */
function migrate(saved, config) {
  const base = { shell: saved.shell || null, wallpaper: saved.wallpaper || null, theme: saved.theme || null };

  if (Array.isArray(saved.apps)) {
    // 老的整份快照分不清"用户没见过"和"用户删掉了"。
    // 宁可让删过的应用回来一次，也不能把没见过的应用判成已删——所以只补不删。
    const builtIn = config.apps || [];
    base.added = saved.apps.filter((id) => !builtIn.includes(id));
    base.removed = [];
  } else {
    base.added = Array.isArray(saved.added) ? saved.added : [];
    base.removed = Array.isArray(saved.removed) ? saved.removed : [];
  }

  if (Array.isArray(saved.features)) {
    const builtIn = config.features || [];
    base.featuresAdded = saved.features.filter((id) => !builtIn.includes(id));
    base.featuresRemoved = [];
  } else {
    base.featuresAdded = Array.isArray(saved.featuresAdded) ? saved.featuresAdded : [];
    base.featuresRemoved = Array.isArray(saved.featuresRemoved) ? saved.featuresRemoved : [];
  }

  return base;
}
