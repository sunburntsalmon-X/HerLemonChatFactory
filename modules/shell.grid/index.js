/**
 * 外壳：格栅桌面（默认）
 *
 * 朴素到没有状态栏、没有标题。App 列表来自 ctx.apps 注册表，
 * 一有增减就自己重画，不用整机重装。
 */
export default {
  id: 'shell.grid',
  kind: 'shell',
  api: '1.x',
  meta: { name: '格栅桌面' },
  css: 'style.css',

  mount(stage, ctx, { apps }) {
    const { h } = ctx.ui;

    const icon = (app) => h('button',
      { class: 'appicon', onclick: () => ctx.host.open(app.id) },
      h('span', { class: 'tile' }, app.meta?.icon || '▦'),
      h('small', {}, app.meta?.name || app.id));

    const grid = h('div', { class: 'icon-grid' });
    const desktop = h('div', { class: 'desktop' }, grid);
    stage.append(desktop);

    const render = () => grid.replaceChildren(...apps.list().map(icon));
    render();
    const off = apps.on(render);

    return { destroy() { off(); desktop.remove(); } };
  },
};
