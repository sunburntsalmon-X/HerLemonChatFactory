/**
 * 背景 App：主题色
 *
 * 装了就在桌面多一个图标，点开就是编辑器。
 * 和另外两个背景 App 共用一张背景层——打开哪个就用哪个，后开的会顶掉前一个。
 */
const ID = 'fx.bg.theme';
const TEMPLATES = [
  ['solid', '纯色'],
  ['linear', '渐变'],
  ['radial', '光晕'],
  ['mesh', '双光'],
  ['grid', '方格'],
  ['dots', '点阵'],
];

let conf = { template: 'linear' };

export default {
  id: ID,
  kind: 'app',
  api: '1.x',
  meta: { name: '主题色背景', icon: '◐' },

  async setup(ctx) {
    conf = { template: 'linear', ...(await ctx.vault.namespace(ID).get('config', {})) };
    // 上次用的就是它，开机直接把背景铺上
    if (ctx.market.wallpaper() === ID) paint(ctx);
  },

  mount(body, ctx, api) {
    const { h } = ctx.ui;
    api.setTitle('主题色背景');
    ctx.market.setWallpaper(ID);
    paint(ctx);

    const preview = h('div', { class: 'bg-preview' });
    const chips = h('div', { class: 'row-chips' });

    const render = () => {
      preview.style.background = templateCss(conf.template);
      chips.replaceChildren(...TEMPLATES.map(([id, label]) => h('button', {
        class: `chip${conf.template === id ? ' on' : ''}`,
        onclick: async () => {
          conf.template = id;
          paint(ctx);
          render();
          await ctx.vault.namespace(ID).set('config', conf);
        },
      }, label)));
    };

    body.append(h('div', { class: 'settings scroll' },
      h('div', { class: 'group' }, h('h2', {}, '模板'), preview, chips),
      h('div', { class: 'foot-note' },
        '颜色全部来自主题色，换主题时背景会跟着变。')));
    render();
    return { destroy() {} };
  },
};

function paint(ctx) {
  ctx.stage.querySelectorAll('#bg-layer').forEach((el) => el.remove());
  const layer = ctx.ui.h('div', { class: 'bg-layer', id: 'bg-layer', 'data-module-owned': ID });
  layer.setAttribute('style', templateCss(conf.template));
  ctx.stage.prepend(layer);
}

function templateCss(id) {
  const tint = (p) => `color-mix(in srgb, var(--accent) ${p}%, transparent)`;
  const line = 'color-mix(in srgb, var(--fg) 7%, transparent)';
  switch (id) {
    case 'solid':
      return 'linear-gradient(0deg, var(--bg), var(--bg))';
    case 'radial':
      return `radial-gradient(120% 90% at 85% 0%, ${tint(26)} 0%, transparent 62%), var(--bg)`;
    case 'mesh':
      return `radial-gradient(80% 70% at 10% 0%, ${tint(18)} 0%, transparent 55%),
              radial-gradient(90% 80% at 100% 100%, ${tint(14)} 0%, transparent 60%),
              var(--bg)`;
    case 'grid':
      return `linear-gradient(${line} 1px, transparent 1px),
              linear-gradient(90deg, ${line} 1px, transparent 1px),
              radial-gradient(120% 90% at 80% 0%, ${tint(14)} 0%, transparent 60%),
              var(--bg)`;
    case 'dots':
      return `radial-gradient(color-mix(in srgb, var(--fg) 12%, transparent) 1px, transparent 1px),
              radial-gradient(120% 90% at 20% 0%, ${tint(16)} 0%, transparent 60%),
              var(--bg)`;
    default:
      return `linear-gradient(165deg, ${tint(18)} 0%, var(--bg) 62%)`;
  }
}
