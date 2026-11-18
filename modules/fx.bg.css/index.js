/**
 * 背景 App：自定义 CSS
 *
 * 只接受"声明"，不接受选择器——作用在背景这一层，不会污染别处。
 */
const ID = 'fx.bg.css';
const TEMPLATE = `background:
  radial-gradient(120% 90% at 80% 0%,
    color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%),
  var(--bg);
background-size: cover;

/* 能用的变量：
   var(--accent) 主题色   var(--bg) 背景
   var(--surface) 卡片     var(--fg) 文字
   color-mix(in srgb, 颜色 20%, transparent) 调透明度 */`;

let conf = { css: TEMPLATE };

export default {
  id: ID,
  kind: 'app',
  api: '1.x',
  meta: { name: '自定义背景', icon: '⌘' },

  async setup(ctx) {
    conf = { css: TEMPLATE, ...(await ctx.vault.namespace(ID).get('config', {})) };
    if (ctx.market.wallpaper() === ID) paint(ctx);
  },

  mount(body, ctx, api) {
    const { h } = ctx.ui;
    const store = ctx.vault.namespace(ID);
    api.setTitle('自定义背景');
    ctx.market.setWallpaper(ID);
    paint(ctx);

    const area = h('textarea', { class: 'css-area', spellcheck: 'false' }, conf.css || TEMPLATE);

    body.append(h('div', { class: 'settings scroll' },
      h('div', { class: 'group' },
        h('h2', {}, 'CSS 声明'),
        h('div', { class: 'foot-note', style: { marginBottom: '10px' } },
          '只写声明，不用写选择器。它只作用在背景这一层。'),
        area),
      h('div', { class: 'row-actions' },
        h('button', {
          class: 'btn primary',
          onclick: async () => {
            conf.css = area.value;
            paint(ctx);
            await store.set('config', conf);
            ctx.ui.toast('背景已更新');
          },
        }, '应用'),
        h('button', { class: 'btn', onclick: () => { area.value = TEMPLATE; } }, '重置模板')),
      h('div', { class: 'foot-note' }, '改完点「应用」，桌面会立刻换。')));
    return { destroy() {} };
  },
};

function paint(ctx) {
  ctx.stage.querySelectorAll('#bg-layer').forEach((el) => el.remove());
  const layer = ctx.ui.h('div', { class: 'bg-layer', id: 'bg-layer', 'data-module-owned': ID });
  layer.setAttribute('style', conf.css || '');
  ctx.stage.prepend(layer);
}
