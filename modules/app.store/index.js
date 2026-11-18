/**
 * 应用：商店
 *
 * 目录式布局：搜索 + 分类 + 分组。
 * 所有颜色都走主题变量，所以换主题时商店自己也跟着变——它没有自己的配色。
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
    let kind = 'all';

    const search = h('input', {
      class: 'shop-search',
      type: 'search',
      placeholder: '搜：聊天 / 深色 / 侧边栏',
      autocomplete: 'off',
    });
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      renderBody();
    });

    const chips = h('div', { class: 'shop-chips' });
    const listEl = h('div', { class: 'shop-list scroll' });

    body.replaceChildren(
      h('div', { class: 'shop-head' },
        h('div', { class: 'shop-hero' },
          h('div', { class: 'shop-hero-title' }, market.manifest().name || '商店'),
          h('div', { class: 'shop-hero-sub' }, '点一下就生效，不用改代码')),
        search,
        chips,
      ),
      listEl,
    );

    renderBody();

    /* ---------------- 数据 ---------------- */

    function groups() {
      const current = market.themeId();
      const themes = (market.themes() || []).map((t) => ({
        ...t,
        kind: 'theme',
        installed: current === t.id,
        active: current === t.id,
      }));

      // 皮肤是单选，得给一个"退回内核基线"的选项，否则挑了就回不去
      const skin = market.ui()[0] || null;
      const uiItems = [
        {
          id: 'core.baseline',
          kind: 'ui',
          name: '内置（默认）',
          icon: '◻',
          summary: '内核自带的基线样式：实心按钮，永远可用',
          installed: !skin,
          active: !skin,
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

    /* ---------------- 渲染 ---------------- */

    function renderBody() {
      const all = groups();
      const total = all.reduce((n, g) => n + g.items.length, 0);

      chips.replaceChildren(
        chip('all', '全部', total),
        ...all.map((g) => chip(g.kind, g.title, g.items.length)),
      );

      const nodes = [];
      for (const group of all) {
        if (kind !== 'all' && kind !== group.kind) continue;
        const items = group.items.filter(match);
        if (!items.length) continue;
        nodes.push(h('div', { class: 'group' },
          h('h2', {}, group.title, h('span', { class: 'count' }, items.length)),
          items.map(card)));
      }

      listEl.replaceChildren(...(nodes.length ? nodes : [empty()]));
    }

    function chip(id, label, count) {
      return h('button', {
        class: `chip${kind === id ? ' on' : ''}`,
        onclick: () => {
          kind = id;
          renderBody();
        },
      }, label, h('em', {}, count));
    }

    function match(item) {
      if (!query) return true;
      const hay = [item.name, item.summary, item.id, ...(item.tags || [])]
        .join(' ').toLowerCase();
      return hay.includes(query);
    }

    function card(item) {
      const isStore = item.id === 'app.store';
      const isRuntime = item.kind === 'runtime';
      const isTheme = item.kind === 'theme';
      const isShell = item.kind === 'shell';

      let label;
      let on = false;
      let action = null;

      if (isTheme) {
        on = item.active;
        label = on ? '使用中' : '使用';
        action = () => applyTheme(item.id);
      } else if (item.kind === 'wallpaper') {
        on = item.active;
        label = on ? '使用中' : '使用';
        action = () => apply('wallpaper', item.id);
      } else if (isShell) {
        on = item.active;
        label = on ? '使用中' : '使用';
        action = () => apply('shell', item.id);
      } else if (isRuntime) {
        label = '由人物决定';
      } else if (item.kind === 'ui') {
        on = item.active;
        label = on ? '使用中' : '使用';
        action = () => apply('ui', item.id === 'core.baseline' ? null : item.id);
      } else if (item.kind === 'feature') {
        on = item.installed;
        label = on ? '卸下' : '装上';
        action = () => apply(on ? 'uninstall' : 'install', item.id, item.kind);
      } else if (isStore) {
        on = true;
        label = '已装';
      } else {
        on = item.installed;
        label = on ? '卸载' : '安装';
        action = () => apply(on ? 'uninstall' : 'install', item.id);
      }

      return h('div', { class: `shop-item${isTheme ? ' theme-item' : ''}` },
        isTheme ? swatches(item) : h('div', {
          class: 'tile',
          style: item.color ? { background: item.color } : null,
        }, item.icon || '▦'),
        h('div', { class: 'info' },
          h('div', { class: 'name' }, item.name,
            item.version ? h('span', { class: 'ver' }, ` v${item.version}`) : null),
          h('div', { class: 'desc' }, item.summary || item.id)),
        h('button', {
          class: `pill${on ? ' on' : ''}`,
          disabled: !action,
          onclick: action,
        }, label));
    }

    function swatches(item) {
      const vars = item.vars || {};
      return h('div', { class: 'swatches' },
        h('span', { style: { background: vars.bg || '#222' } }),
        h('span', { style: { background: vars.surface2 || '#333' } }),
        h('span', { style: { background: vars.accent || '#888' } }),
        h('span', { style: { background: vars.fg || '#eee' } }));
    }

    function empty() {
      return h('div', { class: 'empty-state' },
        '没找到。换个词试试，或者切回「全部」。');
    }

    /* ---------------- 动作 ---------------- */

    async function applyTheme(id) {
      await market.setTheme(id);
      await ctx.settings.set('theme.accent', null); // 主题自带的颜色优先
      ctx.applyTheme();
      api.setSubtitle(market.themes().find((t) => t.id === id)?.name || '');
      renderBody();
    }

    async function apply(action, id, kind = 'app') {
      try {
        if (action === 'shell') await market.setShell(id);
        else if (action === 'wallpaper') await market.setWallpaper(id);
        else if (action === 'ui') await market.setUi(id);
        else if (action === 'install') await market.install(id, kind);
        else await market.uninstall(id, kind);

        await ctx.reboot('app.store');
        const verb = {
          shell: '桌面换好了',
          ui: '界面换好了',
          install: '装好了',
          uninstall: '卸掉了',
        }[action];
        ctx.ui.toast(verb);
      } catch (err) {
        console.error('[app.store]', err);
        ctx.ui.toast('没换成功');
      }
    }
  },
};
