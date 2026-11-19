/**
 * 弹窗（抽屉）
 *
 * 内核只给机制：一层遮罩 + 一块面板，点遮罩或按 Esc 关掉。
 * 长什么样由 ui.sheet 之类的模块决定（data-side 控制从哪边出来）。
 */
import { h } from './dom.js';

export function sheet({ title, content, side = 'bottom', actions = [] } = {}) {
  const body = h('div', { class: 'sheet-body' });
  if (content != null) {
    body.append(typeof content === 'string' ? document.createTextNode(content) : content);
  }

  const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'sheet-handle' }),
    title ? h('h2', { class: 'sheet-title' }, title) : null,
    body,
    actions.length ? h('div', { class: 'sheet-actions' }, actions) : null);

  const mask = h('div', { class: 'sheet-mask', 'data-side': side }, panel);
  document.body.append(mask);
  document.addEventListener('keydown', onKey);
  mask.addEventListener('click', (event) => {
    if (event.target === mask) close();
  });

  function onKey(event) {
    if (event.key === 'Escape') close();
  }

  function close() {
    document.removeEventListener('keydown', onKey);
    mask.remove();
  }

  panel.querySelector('button')?.focus?.({ preventScroll: true });
  return { close, panel };
}
