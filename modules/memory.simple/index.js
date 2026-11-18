/**
 * 功能模块：简单记忆
 *
 * 只做两件事：
 * 1. 每聊 N 轮，把最近的对话压成一条记忆存起来（按人物分开）
 * 2. 每次开口前，挑几条相关的记忆投进提示词管线
 *
 * 内核对它一无所知：它只用了 ctx 的四样东西——vault / prompt / bus / settings。
 */
const SUMMARY_PROMPT = `你是记忆整理员。读下面的对话，把值得长期记住的事写成一句中文，不超过 40 字。
只记关于用户的事实、偏好、约定、正在做的事。不写寒暄，不写你自己的想法。
如果确实没有值得记的，只回复两个字：无`;

export default {
  id: 'memory.simple',
  kind: 'feature',
  api: '1.x',
  meta: { name: '简单记忆', icon: '🧠' },

  async setup(ctx) {
    const store = ctx.vault.namespace('memory.simple');
    const cache = new Map();   // 人物 id -> 记忆数组
    const turns = new Map();   // 人物 id -> 攒了几轮

    const every = () => num(ctx.settings.get('memory.simple.every', 3), 3);
    const recallSize = () => num(ctx.settings.get('memory.simple.recall', 4), 4);
    const keepSize = () => num(ctx.settings.get('memory.simple.keep', 60), 60);

    await loadAll();

    /* ---------- 设置项 ---------- */

    ctx.bus.settings.register({
      id: 'memory.simple',
      title: '记忆',
      fields: [
        { key: 'memory.simple.every', label: '每几轮回', type: 'number', min: 2, max: 20, hint: '聊几轮记一次' },
        { key: 'memory.simple.recall', label: '带几条', type: 'number', min: 1, max: 10, hint: '每次带进上下文' },
        { key: 'memory.simple.keep', label: '最多存', type: 'number', min: 10, max: 300 },
      ],
    });

    /* ---------- 提示词 ---------- */

    ctx.prompt.register({
      id: 'memory.simple',
      priority: 70,
      maxChars: 400,
      build: ({ character, userText }) => {
        const items = cache.get(character?.id) || [];
        if (!items.length) return '';
        const picked = rank(items, userText || '').slice(0, recallSize());
        if (!picked.length) return '';
        return `你记得这些事（自然地用，不要照念）：\n${picked.map((m) => `- ${m.text}`).join('\n')}`;
      },
    });

    /* ---------- 聊完就记 ---------- */

    ctx.bus.on('chat:replied', async ({ character, messages }) => {
      if (!character?.id) return;
      const count = (turns.get(character.id) || 0) + 1;
      turns.set(character.id, count);
      await store.set(`turns:${character.id}`, count);
      if (count < every()) return;

      turns.set(character.id, 0);
      await store.set(`turns:${character.id}`, 0);
      try {
        await remember(character, messages);
      } catch (err) {
        console.error('[memory.simple] 记不下来', err);
      }
    });

    /* ---------- 记忆查看 App（模块自己带进来的） ---------- */

    ctx.host.registerApp({
      id: 'app.memory',
      kind: 'app',
      api: '1.x',
      meta: { name: '记忆', icon: '🧠', color: 'var(--accent)' },
      mount(body, _, api) {
        render();

        function render() {
          api.setTitle('记忆');
          const people = ctx.people.list();
          const blocks = people
            .map((person) => {
              const items = cache.get(person.id) || [];
              if (!items.length) return null;
              return ctx.ui.h('div', { class: 'group' },
                ctx.ui.h('h2', {}, `${person.name} · ${items.length} 条`),
                items.slice().reverse().map((m) => ctx.ui.h('div', { class: 'field' },
                  ctx.ui.h('span', {
                    style: { flex: '1', fontSize: '13px', lineHeight: '1.6' },
                  }, m.text),
                  ctx.ui.h('button', {
                    class: 'pill',
                    onclick: () => remove(person.id, m.id),
                  }, '删'))));
            })
            .filter(Boolean);

          const total = [...cache.values()].reduce((n, arr) => n + arr.length, 0);
          body.replaceChildren(ctx.ui.h('div', { class: 'settings scroll' },
            total
              ? blocks
              : ctx.ui.h('div', { class: 'empty-state' }, '还没有记忆。多聊几轮，它会自己记住。'),
            total
              ? ctx.ui.h('button', { class: 'btn danger', onclick: clearAll }, '清空全部记忆')
              : null,
            ctx.ui.h('div', { class: 'foot-note' },
              `每 ${every()} 轮回一次总结，每次带 ${recallSize()} 条进上下文。数值可以在设置里改。`)));
        }

        async function remove(personId, memId) {
          const items = (cache.get(personId) || []).filter((m) => m.id !== memId);
          cache.set(personId, items);
          await store.set(`items:${personId}`, items);
          render();
        }

        async function clearAll() {
          if (!confirm('把所有记忆都清掉？人物和对话不会动。')) return;
          for (const person of ctx.people.list()) {
            cache.set(person.id, []);
            await store.set(`items:${person.id}`, []);
          }
          render();
        }
      },
    });

    /* ---------- 内部 ---------- */

    async function loadAll() {
      for (const person of ctx.people.list()) {
        cache.set(person.id, (await store.get(`items:${person.id}`, [])) || []);
        turns.set(person.id, (await store.get(`turns:${person.id}`, 0)) || 0);
      }
    }

    async function remember(character, messages) {
      const recent = (messages || []).slice(-8);
      const text = await summarize(character, recent);
      if (!text) return;

      const items = cache.get(character.id) || [];
      if (items.some((m) => m.text.includes(text) || text.includes(m.text))) return;

      items.push({ id: `m${Date.now().toString(36)}`, text, at: Date.now() });
      const trimmed = items.slice(-keepSize());
      cache.set(character.id, trimmed);
      await store.set(`items:${character.id}`, trimmed);
      ctx.bus.emit('memory:added', { characterId: character.id, text });
    }

    async function summarize(character, recent) {
      const provider = ctx.settings.get('ai.provider', 'mock');
      const key = await ctx.settings.getKey().catch(() => '');

      if (provider === 'mock' || !key) return localSummary(recent);

      try {
        let out = '';
        for await (const piece of ctx.llm.stream({
          character,
          messages: recent.map(({ role, content }) => ({ role, content })),
          system: SUMMARY_PROMPT,
        })) {
          out += piece;
        }
        const clean = out.trim().replace(/^["「]|["」]$/g, '').slice(0, 60);
        if (!clean || clean.startsWith('无')) return '';
        return clean;
      } catch (err) {
        console.warn('[memory.simple] 总结失败，改用本地提取', err);
        return localSummary(recent);
      }
    }
  },
};

/** 演示模式（没有密钥）也能看到记忆真的生成，靠的是本地提取 */
function localSummary(messages) {
  const said = messages
    .filter((m) => m.role === 'user')
    .map((m) => String(m.content || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!said.length) return '';
  const tail = said.slice(-2).map((s) => s.slice(0, 20)).join('；');
  return `用户提到过：${tail}`;
}

/** 中文没有空格，用二元字组做相关度，够用而且不引入任何依赖 */
function bigrams(text) {
  const clean = String(text).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
  const set = new Set();
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2));
  return set;
}

function rank(items, query) {
  const grams = bigrams(query);
  return items
    .map((item) => {
      let hits = 0;
      for (const g of grams) if (item.text.includes(g)) hits++;
      const overlap = grams.size ? hits / grams.size : 0;
      const days = (Date.now() - (item.at || 0)) / 86_400_000;
      return { item, score: overlap * 2 + Math.exp(-days / 21) };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
