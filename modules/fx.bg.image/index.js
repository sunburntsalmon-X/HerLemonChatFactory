/**
 * 背景 App：自定义图片
 */
const ID = 'fx.bg.image';
const FILTERS = [
  ['none', '原图', 'none'],
  ['mono', '黑白', 'grayscale(1) contrast(1.05)'],
  ['warm', '暖调', 'sepia(.35) saturate(1.25)'],
  ['cool', '冷调', 'hue-rotate(-12deg) saturate(1.1) brightness(1.02)'],
  ['fade', '褪色', 'saturate(.6) contrast(.9) brightness(1.06)'],
  ['deep', '压暗', 'brightness(.72) contrast(1.1)'],
];

let conf = { image: '', filter: 'none', blur: 0, opacity: 1 };

export default {
  id: ID,
  kind: 'app',
  api: '1.x',
  meta: { name: '图片背景', icon: '🖼' },

  async setup(ctx) {
    conf = { image: '', filter: 'none', blur: 0, opacity: 1, ...(await ctx.vault.namespace(ID).get('config', {})) };
    if (ctx.market.wallpaper() === ID) paint(ctx);
  },

  mount(body, ctx, api) {
    const { h } = ctx.ui;
    const store = ctx.vault.namespace(ID);
    api.setTitle('图片背景');
    ctx.market.setWallpaper(ID);
    paint(ctx);

    const preview = h('div', { class: 'bg-preview' });
    const chips = h('div', { class: 'row-chips' });
    const picker = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });

    const render = () => {
      preview.style.background = conf.image
        ? `center/cover no-repeat url(${conf.image})`
        : 'var(--surface-2)';
      preview.style.filter = filterCss(conf.filter);

      chips.replaceChildren(...FILTERS.map(([id, label]) => h('button', {
        class: `chip${conf.filter === id ? ' on' : ''}`,
        onclick: async () => {
          conf.filter = id;
          paint(ctx); render();
          await store.set('config', conf);
        },
      }, label)));
    };

    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        ctx.ui.toast('正在处理…');
        conf.image = await shrink(file);
        paint(ctx); render();
        await store.set('config', conf);
      } catch (err) {
        console.error('[fx.bg.image]', err);
        ctx.ui.toast('这张图读不出来');
      }
    });

    const slider = (label, value, min, max, step, onInput) => h('div', { class: 'row-slider' },
      h('span', { class: 'row-label' }, label),
      h('input', {
        type: 'range', min, max, step, value,
        oninput: (e) => { onInput(Number(e.target.value)); },
        onchange: () => store.set('config', conf),
      }));

    body.append(h('div', { class: 'settings scroll' },
      h('div', { class: 'group' },
        h('h2', {}, '图片'),
        preview,
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn primary', onclick: () => picker.click() },
            conf.image ? '换一张' : '选一张图'),
          conf.image ? h('button', {
            class: 'btn',
            onclick: async () => {
              conf.image = '';
              paint(ctx); render();
              await store.set('config', conf);
            },
          }, '移除') : null)),
      h('div', { class: 'group' }, h('h2', {}, '滤镜'), chips),
      h('div', { class: 'group' }, h('h2', {}, '微调'),
        slider('模糊', conf.blur, 0, 24, 1, (v) => { conf.blur = v; paint(ctx); }),
        slider('透明度', conf.opacity, 0.2, 1, 0.05, (v) => { conf.opacity = v; paint(ctx); })),
      h('div', { class: 'foot-note' }, '图片会先压到 1440 长边再存，不会撑爆本机。'),
      picker));

    render();
    return { destroy() {} };
  },
};

function paint(ctx) {
  ctx.stage.querySelectorAll('#bg-layer').forEach((el) => el.remove());
  if (!conf.image) return;
  const layer = ctx.ui.h('div', { class: 'bg-layer', id: 'bg-layer', 'data-module-owned': ID });
  layer.style.backgroundImage = `url(${conf.image})`;
  layer.style.filter = `${filterCss(conf.filter)} blur(${conf.blur}px)`;
  layer.style.opacity = String(conf.opacity);
  layer.style.transform = conf.blur > 0 ? 'scale(1.08)' : 'none';
  ctx.stage.prepend(layer);
}

function filterCss(id) {
  return (FILTERS.find(([key]) => key === id) || FILTERS[0])[2];
}

async function shrink(file, max = 1440, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
