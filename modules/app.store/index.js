/**
 * 应用：商店
 *
 * 左边竖向目录（类型 → 难度，逐层展开），右边上图下文字的格子。
 * 点格子进详情：封面、作者、日期、简介、教程、截图。
 */
export default {
  id: 'app.store',
  kind: 'app',
  api: '1.x',
  meta: { name: '商店', icon: '🛍', color: 'var(--accent)' },
  css: 'style.css',

  mount(body, ctx, api) {
    const { h } = ctx.ui;
    const market = ctx.market;

    let query = '';
    let cat = 'all';    // 当前类型
    let sub = 0;        // 0 全部难度 / 1 新手 / 2 进阶 / 3 高级

    const search = h('input', {
      class: 'shop-search',
      type: 'search',
      placeholder: '搜：聊天 / 深色 / 侧边栏',
      autocomplete: 'off',
    });
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      renderList();
    });

    const head = h('div', { class: 'shop-head' },
      h('div', { class: 'shop-hero' },
        h('div', { class: 'shop-hero-title' }, market.manifest().name || '商店'),
        h('div', { class: 'shop-hero-sub' }, '封面 · 详情 · 教程')),
      search,
    );

    const nav = h('div', { class: 'shop-nav' });
    const grid = h('div', { class: 'shop-grid scroll' });
    const pane = h('div', { class: 'shop-pane' }, nav, grid);
    const detailView = h('div', { class: 'shop-detail scroll' });
    body.replaceChildren(head, pane, detailView);
    renderList();

    /* ---------------- 数据 ---------------- */

    function groups() {
      const current = market.themeId();
      const themes = (market.themes() || []).map((t) => ({
        ...t,
        kind: 'theme',
        difficulty: 1,
        icon: '◐',
        color: `linear-gradient(135deg, ${t.vars?.bg || '#222'} 0 50%, ${t.vars?.accent || '#888'} 50% 100%)`,
        installed: current === t.id,
        active: current === t.id,
      }));

      const skin = market.ui()[0] || null;
      const uiItems = [
        {
          id: 'core.baseline', kind: 'ui', name: '内置（默认）', icon: '◻',
          author: '官方', updated: '', difficulty: 1,
          summary: '内核自带的基线样式：实心按钮，永远可用',
          detail: '不用装任何东西就有的一套控件样式。所有皮肤都是在这套之上覆盖出来的。',
          tutorial: '商城 → 界面 → 使用「内置（默认）」即可回到它。',
          installed: !skin, active: !skin,
        },
        ...market.list('ui'),
      ];

      return [
        { kind: 'shell', title: '桌面', items: market.list('shell') },
        { kind: 'app', title: '应用', items: market.list('app') },
        { kind: 'ui', title: '界面', items: uiItems },
        { kind: 'feature', title: '功能', items: market.list('feature') },
        { kind: 'wallpaper', title: '背景', items: market.list('wallpaper') },
        { kind: 'theme', title: '主题色', items: themes },
        { kind: 'runtime', title: '角色脑子', items: market.list('runtime') },
      ].filter((g) => g.items.length);
    }

    /* ---------------- 左边目录 ---------------- */

    function renderNav(all) {
      const total = all.reduce((n, g) => n + g.items.length, 0);
      const nodes = [navItem('all', '全部', total)];

      for (const g of all) {
        const on = cat === g.kind;
        nodes.push(navItem(g.kind, g.title, g.items.length));
        if (!on) continue;
        // 第二层：这个类型下的难度
        for (const [id, label] of [[0, '全部'], [1, '新手'], [2, '进阶'], [3, '高级']]) {
          const count = id ? g.items.filter((m) => (m.difficulty || 1) === id).length : g.items.length;
          if (id && !count) continue;
          nodes.push(h('button', {
            class: `nav-sub${sub === id ? ' on' : ''}`,
            onclick: () => { sub = id; renderList(); },
          }, label, h('em', {}, count)));
        }
      }
      nav.replaceChildren(...nodes);
    }

    function navItem(id, label, count) {
      return h('button', {
        class: `nav-item${cat === id ? ' on' : ''}`,
        onclick: () => { cat = id; sub = 0; renderList(); },
      }, label, h('em', {}, count));
    }

    /* ---------------- 右边格子 ---------------- */

    function renderList() {
      api.setBack(null);
      api.setSubtitle('');
      head.hidden = false;
      pane.hidden = false;
      detailView.hidden = true;

      const all = groups();
      renderNav(all);

      // 搜索时跨类型找；否则只显示当前类型
      const scope = query ? all : all.filter((g) => cat === 'all' || g.kind === cat);
      const nodes = [];
      for (const group of scope) {
        let items = group.items.filter(match);
        if (sub) items = items.filter((m) => (m.difficulty || 1) === sub);
        if (!items.length) continue;
        if (!query) {
          items = [...items].sort((a, b) =>
            (a.difficulty || 1) - (b.difficulty || 1) || String(a.name).localeCompare(String(b.name), 'zh'));
        }
        nodes.push(h('div', { class: 'group' },
          h('h2', {}, group.title, h('span', { class: 'count' }, items.length)),
          h('div', { class: 'shop-cards' }, items.map(card))));
      }

      grid.replaceChildren(...(nodes.length ? nodes : [empty()]));
    }

    function match(item) {
      if (!query) return true;
      const hay = [item.name, item.summary, item.id, ...(item.tags || [])]
        .join(' ').toLowerCase();
      return hay.includes(query);
    }

    function empty() {
      return h('div', { class: 'empty-state' }, '没找到。换个词试试，或点左边的「全部」。');
    }

    function card(item) {
      const act = actionFor(item);
      return h('div', {
        class: 'shop-card',
        onclick: (event) => {
          if (event.target.closest('.pill')) return;
          openDetail(item);
        },
      },
        cover(item),
        h('div', { class: 'shop-card-body' },
          h('div', { class: 'shop-card-name' }, item.name),
          h('div', { class: 'shop-card-meta' }, item.author || '官方', ' · ', dots(item.difficulty))),
        h('button', {
          class: `pill${act.on ? ' on' : ''} card-pill`,
          disabled: !act.run,
          onclick: act.run,
        }, act.label),
      );
    }

    function dots(n = 1) {
      return h('span', { class: 'dots' }, '●'.repeat(n) + '○'.repeat(Math.max(0, 3 - n)));
    }

    function cover(item, big = false) {
      const cls = `shop-cover${big ? ' big' : ''}`;
      if (item.cover) {
        return h('div', { class: cls }, h('img', { src: item.cover, alt: '', loading: 'lazy' }));
      }
      return h('div', {
        class: `${cls} fallback`,
        style: item.color ? { background: item.color } : null,
      }, item.icon || '▦');
    }

    /* ---------------- 详情 ---------------- */

    function openDetail(item) {
      head.hidden = true;
      pane.hidden = true;
      detailView.hidden = false;
      api.setSubtitle(item.name);
      api.setBack(() => renderList(), '‹ 商店');

      const act = actionFor(item);
      const sections = [
        ['简介', item.summary],
        ['详细介绍', item.detail],
        ['使用教程', item.tutorial],
      ].filter(([, text]) => text);

      detailView.replaceChildren(
        cover(item, true),
        h('div', { class: 'shop-detail-head' },
          h('h1', {}, item.name,
            item.version ? h('span', { class: 'ver' }, ` v${item.version}`) : null),
          h('div', { class: 'shop-card-meta' },
            item.author || '官方',
            item.updated ? ` · 更新于 ${item.updated}` : '', ' · 难度 ', dots(item.difficulty))),
        h('button', {
          class: `btn${act.on ? '' : ' primary'}`,
          disabled: !act.run,
          onclick: act.run,
        }, act.label),
        ...sections.map(([title, text]) => h('section', { class: 'shop-section' },
          h('h3', {}, title),
          h('p', {}, text))),
        ...(item.screenshots?.length
          ? [h('section', { class: 'shop-section' },
            h('h3', {}, '截图'),
            h('div', { class: 'shop-shots' },
              item.screenshots.map((src) => h('img', { src, alt: '', loading: 'lazy' }))))]
          : []),
      );
      detailView.scrollTop = 0;
    }

    /* ---------------- 动作 ---------------- */

    function actionFor(item) {
      if (item.kind === 'theme') {
        return { on: item.active, label: item.active ? '使用中' : '使用', run: () => applyTheme(item.id) };
      }
      if (item.kind === 'ui') {
        return {
          on: item.active,
          label: item.active ? '使用中' : '使用',
          run: () => apply('ui', item.id === 'core.baseline' ? null : item.id),
        };
      }
      if (item.kind === 'shell') {
        return { on: item.active, label: item.active ? '使用中' : '使用', run: () => apply('shell', item.id) };
      }
      if (item.kind === 'wallpaper') {
        return { on: item.active, label: item.active ? '使用中' : '使用', run: () => apply('wallpaper', item.id) };
      }
      if (item.kind === 'runtime') {
        return { on: false, label: '由人物决定', run: null };
      }
      if (item.id === 'app.store') {
        return { on: true, label: '已装', run: null };
      }
      if (item.kind === 'feature') {
        return {
          on: item.installed,
          label: item.installed ? '卸下' : '装上',
          run: () => apply(item.installed ? 'uninstall' : 'install', item.id, item.kind),
        };
      }
      return {
        on: item.installed,
        label: item.installed ? '卸载' : '安装',
        run: () => apply(item.installed ? 'uninstall' : 'install', item.id, item.kind),
      };
    }

    async function applyTheme(id) {
      await market.setTheme(id);
      await ctx.settings.set('theme.accent', null);
      ctx.applyTheme();
      renderList();
    }

    async function apply(action, id, kind = 'app') {
      try {
        if (action === 'shell') await market.setShell(id);
        else if (action === 'wallpaper') await market.setWallpaper(id);
        else if (action === 'ui') await market.setUi(id);
        else if (action === 'install') await market.install(id, kind);
        else await market.uninstall(id, kind);

        await ctx.reboot('app.store');
        const verb = { shell: '桌面换好了', ui: '界面换好了', install: '装好了', uninstall: '卸掉了' }[action];
        ctx.ui.toast(verb);
      } catch (err) {
        console.error('[app.store]', err);
        ctx.ui.toast('没换成功');
      }
    }
  },
};
