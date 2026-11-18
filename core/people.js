/**
 * 人物
 *
 * app.json 里的 characters 是"出厂自带"，用户改过之后以 vault 里的为准。
 * 角色数据是内核级的（D3：数据固定、脑子可换），所以放在这里而不是模块里。
 */
export function createPeople({ vault, config, bus }) {
  const store = vault.namespace('core');
  const seeds = config.characters || [];
  let custom = null;

  async function load() {
    const saved = await store.get('characters', null);
    if (Array.isArray(saved)) custom = saved;
    return list();
  }

  /** 当前生效的人物列表（拷贝，别让调用方改到内部） */
  function list() {
    return (custom ?? seeds).map((c) => ({ ...c }));
  }

  function get(id) {
    return list().find((c) => c.id === id) || null;
  }

  async function persist(next) {
    custom = next;
    await store.set('characters', custom);
    bus.emit('people:changed', { count: custom.length });
  }

  async function add(character) {
    const next = list();
    const created = { ...character, id: character.id || `c${Date.now().toString(36).slice(-6)}` };
    next.push(created);
    await persist(next);
    return created;
  }

  async function update(id, patch) {
    await persist(list().map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function remove(id) {
    await persist(list().filter((c) => c.id !== id));
  }

  /** 恢复成 app.json 里的原始人物 */
  async function reset() {
    custom = null;
    await store.del('characters');
    bus.emit('people:changed', { count: seeds.length });
  }

  return { load, list, get, add, update, remove, reset };
}
