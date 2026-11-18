/**
 * DOM 小工具：省掉一堆 createElement 样板代码
 * h('div', { class: 'x', onclick: fn }, '文字', childNode)
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

/** 极简 Toast，两秒后自己消失 */
export function toast(text) {
  const el = h('div', { class: 'toast' }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 2000);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
