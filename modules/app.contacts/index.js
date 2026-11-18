/**
 * 应用：通讯录
 *
 * 换角色、改人设都在这里。人物数据由内核的 people 保管，
 * 这个应用只负责画界面和收集字段。
 */
export default {
  id: 'app.contacts',
  kind: 'app',
  api: '1.x',
  meta: { name: '通讯录', icon: '👤', color: 'var(--accent)' },
  css: 'style.css',

  mount(body, ctx, api) {
    const { h, toast } = ctx.ui;
    const people = ctx.people;

    showList();

    /* ---------------- 列表 ---------------- */

    function showList() {
      api.setTitle('通讯录');
      api.setBack(null);

      const rows = people.list().map((ch) => h('button', {
        class: 'chat-item',
        onclick: () => showEditor(ch),
      },
        avatar(ch),
        h('div', { class: 'meta' },
          h('div', { class: 'name' }, ch.name),
          h('div', { class: 'preview' }, ch.persona?.prompt || ch.greeting || '还没写人设')),
      ));

      body.replaceChildren(h('div', { class: 'contacts scroll' },
        h('div', { class: 'contacts-bar' },
          h('button', { class: 'btn primary', onclick: () => showEditor(null) }, '＋ 新建'),
          h('button', { class: 'btn', onclick: resetAll }, '恢复默认')),
        rows.length
          ? h('div', { class: 'chat-list' }, rows)
          : h('div', { class: 'empty-state' }, '还没有人物。点上面「新建」写一个。')));
    }

    /* ---------------- 编辑 ---------------- */

    function showEditor(ch) {
      const isNew = !ch;
      const draft = ch ? JSON.parse(JSON.stringify(ch)) : {
        id: '', name: '', avatar: '', runtime: 'runtime.chat', greeting: '',
        persona: { prompt: '', traits: [] },
      };

      api.setTitle(isNew ? '新建人物' : `编辑 · ${draft.name}`);
      api.setBack(() => showList(), '‹ 通讯录');

      const runtimes = (ctx.market.list('runtime') || []).map((r) => r.id);
      if (!runtimes.length) runtimes.push('runtime.chat');

      const name = h('input', { type: 'text', value: draft.name, placeholder: '名字' });
      const avatarInput = h('input', {
        type: 'text', value: draft.avatar || '',
        placeholder: '一个表情，或图片地址',
      });
      const greeting = h('textarea', { placeholder: '打开对话时它说的第一句话' },
        draft.greeting || '');
      const prompt = h('textarea', { placeholder: '这个人是谁、怎么说话、在意什么' },
        draft.persona?.prompt || '');
      const traits = h('input', {
        type: 'text',
        value: (draft.persona?.traits || []).join('、'),
        placeholder: '慢热、嘴硬、记性好',
      });
      const runtime = h('select', {}, runtimes.map((id) => h('option', {
        value: id,
        selected: (draft.runtime || 'runtime.chat') === id,
      }, id)));

      const row = (label, el) => h('div', { class: 'field' }, h('label', {}, label), el);
      const col = (label, el) => h('div', { class: 'field col' }, h('label', {}, label), el);

      body.replaceChildren(h('div', { class: 'settings scroll' },
        h('div', { class: 'group' },
          h('h2', {}, '基本信息'),
          row('名字', name),
          row('头像', avatarInput),
          row('脑子', runtime)),
        h('div', { class: 'group' },
          h('h2', {}, '它是谁'),
          col('人设', prompt),
          col('开场白', greeting),
          row('关键词', traits)),
        h('div', { class: 'group' },
          h('button', { class: 'btn primary', onclick: save }, '保存'),
          isNew ? null : h('button', { class: 'btn danger', onclick: remove }, '删除这个人物')),
        h('div', { class: 'foot-note' },
          '人设是它说话的依据；关键词只是给模型的提示，不写也行。'),
      ));

      async function save() {
        const data = {
          name: name.value.trim() || '无名',
          avatar: avatarInput.value.trim(),
          runtime: runtime.value,
          greeting: greeting.value.trim(),
          persona: {
            prompt: prompt.value.trim(),
            traits: traits.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
          },
        };
        try {
          if (isNew) await people.add(data);
          else await people.update(draft.id, data);
          toast('保存了');
          showList();
        } catch (err) {
          console.error('[contacts]', err);
          toast('没保存上');
        }
      }

      async function remove() {
        if (!confirm(`删掉「${draft.name}」？对话记录不会删，但列表里看不到了。`)) return;
        await people.remove(draft.id);
        toast('删了');
        showList();
      }
    }

    /* ---------------- 小工具 ---------------- */

    async function resetAll() {
      if (!confirm('恢复成 app.json 自带的人物？你新建和改过的都会没。')) return;
      await people.reset();
      toast('已恢复');
      showList();
    }

    function avatar(ch) {
      const raw = String(ch.avatar || '').trim();
      const isImage = /^(https?:|data:|\.\/|\.\.\/)/.test(raw);
      return h('div', { class: 'avatar' },
        isImage ? h('img', { src: raw, alt: ch.name }) : Array.from(raw || ch.name)[0]);
    }
  },
};
