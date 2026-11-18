/**
 * 外壳：侧边栏
 */
export default {
  id: 'shell.sidebar',
  kind: 'shell',
  api: '1.x',
  meta: { name: '侧边栏' },
  css: 'style.css',

  mount(stage, ctx, { apps }) {
    const { h } = ctx.ui;

    const rail = h('div', { class: 'sidebar-list' });
    const pane = h('div', { class: 'sidebar-body' });
    const wrap = h('div', { class: 'sidebar' }, rail, pane);
    stage.append(wrap);

    const render = () => {
      rail.replaceChildren(...apps.list().map((app) => h('button',
        { class: 'sidebar-item', onclick: () => ctx.host.open(app.id) },
        h('span', { class: 'tile' }, app.meta?.icon || '▦'),
        h('span', {}, app.meta?.name || app.id))));

      pane.replaceChildren(h('div', { style: { padding: '32px 22px' } },
        h('div', { style: { fontSize: '20px', fontWeight: '600', lineHeight: '1.35' } }, '侧边栏外壳'),
        h('div', { style: { color: 'var(--dim)', fontSize: '13px', marginTop: '8px' } },
          `${ctx.people.list().length} 个人物 · ${apps.list().length} 个应用`)));
    };

    render();
    const off = apps.on(render);

    return { destroy() { off(); wrap.remove(); } };
  },
};
