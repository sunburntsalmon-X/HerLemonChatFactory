/**
 * UI 皮肤：线框按钮
 *
 * 内核基线是"实心"（surface-2 底 + 无边框），这一层把它全换成描边：
 * 透明底 + 1px 边 + 强调色文字（M3 的 outlined button）。
 *
 * 只覆盖基线，不新增类名。应用到最后还是能盖掉它——层序是：
 * 内核基线 → UI 皮肤 → 应用自己的 css。
 */
export default {
  id: 'ui.button',
  kind: 'ui',
  api: '1.x',
  meta: { name: '线框按钮', icon: '▢' },
  css: 'style.css',
};
