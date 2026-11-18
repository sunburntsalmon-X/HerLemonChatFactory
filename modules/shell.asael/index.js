/**
 * 外壳：Asael 桌面
 *
 * 照着 Asael 的手机桌面做的：玻璃质感图标 + 底部 Dock。
 * App 列表来自注册表，一有增减就重画；Dock 只放常驻的三个。
 */
const DOCK = ['app.store', 'app.settings', 'app.contacts'];

export default {
  id: 'shell.asael',
  kind: 'shell',
  api: '1.x',
  meta: { name: 'Asael 桌面' },
  css: 'style.css',

  mount(stage, ctx, { apps }) {
    const { h } = ctx.ui;

    const icon = (app) => h('button',
      { class: 'appicon', onclick: () => ctx.host.open(app.id) },
      h('span', { class: 'tile' }, app.meta?.icon || '▦'),
      h('small', {}, app.meta?.name || app.id));

    const grid = h('div', { class: 'icon-grid' });
    const dock = h('div', { class: 'phone-dock' });
    const home = h('div', { class: 'phone-home' },
      h('div', { class: 'phone-scroll' }, grid),
      dock);
    stage.append(home);

    const render = () => {
      const all = apps.list();
      grid.replaceChildren(...all.filter((a) => !DOCK.includes(a.id)).map(icon));

      const slots = all.filter((a) => DOCK.includes(a.id)).map(icon);
      while (slots.length < 4) slots.push(h('div', { class: 'dock-slot' }));
      dock.replaceChildren(...slots);
    };

    render();
    const off = apps.on(render);

    return { destroy() { off(); home.remove(); } };
  },
};
