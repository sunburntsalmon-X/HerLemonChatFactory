/**
 * 界面模块：弹窗
 *
 * 内核给了机制（遮罩 + 面板 + Esc 关闭），这里给四个方向和一套皮肤。
 * 换方向是设置项，改完立刻生效，不用重装。
 */
export default {
  id: 'ui.sheet',
  kind: 'ui',
  api: '1.x',
  meta: { name: '弹窗', icon: '▭' },
  css: 'style.css',

  setup(ctx) {
    ctx.bus.settings.register({
      id: 'ui.sheet',
      title: '弹窗',
      fields: [
        {
          key: 'ui.sheet.side',
          label: '方向',
          type: 'select',
          options: [
            ['bottom', '下往上'],
            ['right', '右往左'],
            ['left', '左往右'],
            ['float', '悬空'],
          ],
          hint: '立刻生效',
        },
      ],
    });

    const sync = () => {
      document.documentElement.dataset.sheetSide = ctx.settings.get('ui.sheet.side', 'bottom');
    };
    sync();
    ctx.bus.on('settings:changed', ({ path }) => {
      if (String(path).startsWith('ui.sheet')) sync();
    });
  },
};
