/**
 * 数据仓 vault
 *
 * 规矩：每个模块只能写自己的命名空间，不能碰别人的。
 * 备份 = 按命名空间整体导出；导入时按模块分别处理。
 *
 * 优先用 IndexedDB；不可用时退回 localStorage（能力降级，但不会白屏）。
 */

const DB_NAME = 'xiaoshouji';
const STORE = 'kv';
const SEP = '\u0000';

export async function createVault() {
  let db = null;
  try {
    db = await openDB();
  } catch (err) {
    console.warn('[vault] IndexedDB 不可用，退回 localStorage', err);
  }

  const ls = {
    get(key) {
      const raw = localStorage.getItem(`xsj${SEP}${key}`);
      return raw === null ? undefined : JSON.parse(raw);
    },
    set(key, value) {
      localStorage.setItem(`xsj${SEP}${key}`, JSON.stringify(value));
    },
    del(key) {
      localStorage.removeItem(`xsj${SEP}${key}`);
    },
    entries() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`xsj${SEP}`)) {
          out.push([k.slice(4), JSON.parse(localStorage.getItem(k))]);
        }
      }
      return out;
    },
  };

  function idb(mode, run) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = run(store);
      } catch (err) {
        reject(err);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function rawGet(key) {
    if (!db) return ls.get(key);
    return request(db.transaction(STORE, 'readonly').objectStore(STORE).get(key));
  }

  async function rawSet(key, value) {
    if (!db) return ls.set(key, value);
    return idb('readwrite', (store) => store.put(value, key));
  }

  async function rawDel(key) {
    if (!db) return ls.del(key);
    return idb('readwrite', (store) => store.delete(key));
  }

  async function rawEntries() {
    if (!db) return ls.entries();
    const out = [];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        out.push([cursor.key, cursor.value]);
        cursor.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return out;
  }

  /** 取一个命名空间的读写句柄 */
  function namespace(ns) {
    if (!ns || typeof ns !== 'string') throw new Error('命名空间必须是字符串');
    return {
      ns,
      get: (key, fallback) => rawGet(`${ns}${SEP}${key}`).then((v) => (v === undefined ? fallback : v)),
      set: (key, value) => rawSet(`${ns}${SEP}${key}`, value),
      del: (key) => rawDel(`${ns}${SEP}${key}`),
      keys: async () => (await rawEntries())
        .filter(([k]) => String(k).startsWith(ns + SEP))
        .map(([k]) => String(k).slice(ns.length + 1)),
    };
  }

  return {
    namespace,

    /** 整体导出，按命名空间分组 */
    async exportAll() {
      const data = {};
      for (const [key, value] of await rawEntries()) {
        const str = String(key);
        const at = str.indexOf(SEP);
        if (at < 0) continue;
        const ns = str.slice(0, at);
        const k = str.slice(at + 1);
        (data[ns] ||= {})[k] = value;
      }
      return data;
    },

    async importAll(data, { merge = false } = {}) {
      if (!merge) await this.clearAll();
      for (const [ns, rows] of Object.entries(data || {})) {
        for (const [k, v] of Object.entries(rows || {})) {
          await rawSet(`${ns}${SEP}${k}`, v);
        }
      }
    },

    async clearAll() {
      if (!db) {
        for (const [k] of ls.entries()) ls.del(k);
        return;
      }
      await idb('readwrite', (store) => store.clear());
    },
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('没有 indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('数据库被占用'));
  });
}
