/**
 * 应用：消息
 *
 * 只是一个 App。它不认识桌面，也不认识外壳；
 * 想要什么能力，都从 ctx 里拿。
 */
export default {
  id: 'app.chat',
  kind: 'app',
  api: '1.x',
  meta: { name: '消息', icon: '💬', color: '#2f6df6' },

  setup(ctx) {
    // 模块自己声明设置项，设置页会自动长出来
    ctx.bus.settings.register({
      id: 'app.chat',
      title: '消息',
      fields: [
        {
          key: 'apps.chat.turns', label: '带几轮', type: 'number',
          min: 2, max: 40, hint: '最近多少轮进上下文',
        },
      ],
    });
  },

  mount(body, ctx, api) {
    const { h } = ctx.ui;
    const store = ctx.vault.namespace('app.chat');
    const people = ctx.people;

    let current = null;
    let messages = [];
    let streaming = false;
    let abort = null;

    const off = ctx.bus.on('people:changed', () => {
      if (!current) showList();
    });

    showList();
    return {
      destroy() {
        off();
        abort?.abort();
      },
    };

    /* ---------------- 会话列表 ---------------- */

    async function showList() {
      current = null;
      api.setTitle('消息');
      api.setBack(null);

      const items = [];
      for (const ch of people.list()) {
        const conv = await store.get(`conv:${ch.id}`, []);
        const last = conv[conv.length - 1];
        items.push(h('button', { class: 'chat-item', onclick: () => openThread(ch) },
          avatar(ch),
          h('div', { class: 'meta' },
            h('div', { class: 'name' }, ch.name),
            h('div', { class: 'preview' },
              last ? String(last.content).replace(/\s+/g, ' ') : (ch.greeting || '还没聊过')))));
      }
      body.replaceChildren(h('div', { class: 'chat-list scroll' }, items));
    }

    /* ---------------- 对话 ---------------- */

    async function openThread(ch) {
      current = ch;
      const saved = await store.get(`conv:${ch.id}`, null);
      if (Array.isArray(saved) && saved.length) {
        messages = saved;
      } else {
        messages = [{ role: 'assistant', content: ch.greeting || '……', ts: Date.now() }];
        await save();
      }

      api.setTitle(ch.name);
      api.setBack(() => {
        abort?.abort();
        showList();
      }, '‹ 消息');
      renderThread();
    }

    function renderThread() {
      const thread = h('div', { class: 'thread scroll' });
      for (const m of messages) thread.append(bubble(m));

      const input = h('textarea', {
        rows: 1, placeholder: '说点什么…', enterkeyhint: 'send',
      });
      const sendBtn = h('button', { class: 'btn-send' }, '发送');

      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault();
          send();
        }
      });
      sendBtn.addEventListener('click', send);

      async function send() {
        const text = input.value.trim();
        if (!text || streaming) return;
        input.value = '';
        input.style.height = 'auto';

        const msg = { role: 'user', content: text, ts: Date.now() };
        messages.push(msg);
        thread.append(bubble(msg));
        scrollBottom(thread);
        await save();
        await reply(thread, sendBtn);
      }

      body.replaceChildren(thread, h('div', { class: 'composer' }, input, sendBtn));
      requestAnimationFrame(() => scrollBottom(thread));
    }

    async function reply(thread, sendBtn) {
      streaming = true;
      sendBtn.disabled = true;

      const bubbleEl = h('div', { class: 'bubble ai typing' });
      thread.append(bubbleEl);
      scrollBottom(thread);

      const turns = Number(ctx.settings.get('apps.chat.turns', 12)) || 12;
      const history = messages.slice(-turns * 2).map(({ role, content }) => ({ role, content }));
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

      const built = ctx.prompt.build(
        { character: current, history, userText: lastUser, settings: ctx.settings },
        Number(ctx.settings.get('ai.params.maxChars', 2000)) || 2000,
      );

      let acc = '';
      abort = new AbortController();

      try {
        for await (const piece of ctx.llm.stream({
          character: current,
          messages: history,
          system: built.system,
          signal: abort.signal,
        })) {
          acc += piece;
          bubbleEl.textContent = acc;
          scrollBottom(thread);
        }
      } catch (err) {
        console.error('[app.chat]', err);
        if (err?.name === 'AbortError') {
          bubbleEl.textContent = acc || '（已中断）';
        } else {
          bubbleEl.textContent = `（出错了：${err.message}）`;
          bubbleEl.style.borderColor = 'var(--danger)';
        }
      } finally {
        bubbleEl.classList.remove('typing');
        streaming = false;
        sendBtn.disabled = false;
        abort = null;
        if (acc) {
          messages.push({ role: 'assistant', content: acc, ts: Date.now() });
          await save();
          ctx.bus.emit('chat:replied', { character: current, messages: messages.slice() });
        }
      }
    }

    /* ---------------- 小工具 ---------------- */

    function avatar(ch) {
      const raw = String(ch.avatar || '').trim();
      const isImage = /^(https?:|data:|\.\/|\.\.\/)/.test(raw);
      return h('div', { class: 'avatar' },
        isImage ? h('img', { src: raw, alt: ch.name }) : Array.from(raw || ch.name)[0]);
    }

    function bubble(m) {
      return h('div', { class: `bubble ${m.role === 'user' ? 'user' : 'ai'}` }, m.content);
    }

    function scrollBottom(el) {
      el.scrollTop = el.scrollHeight;
    }

    function save() {
      return current ? store.set(`conv:${current.id}`, messages) : Promise.resolve();
    }
  },
};
