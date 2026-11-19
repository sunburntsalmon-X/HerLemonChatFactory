/**
 * 主题
 *
 * 一套主题 = 一组颜色变量 + 一张壁纸。换主题 = 换这十几个变量，
 * 所有模块（包括商店自己）都不许写死颜色，所以会一起变。
 */

/** 内核兜底：store.json 读不到时至少能看清界面 */
export const FALLBACK_THEME = {
  id: 'fallback',
  name: '墨黑',
  vars: {
    bg: '#0d0f13', surface: '#15181e', surface2: '#1c2027', line: '#272c36',
    fg: '#e6e9f0', dim: '#8b93a3', accent: '#9db8d2', danger: '#e08a8a',
  },
  wallpaper: 'radial-gradient(120% 80% at 100% 0%, #1a2130 0%, transparent 55%)',
};

const VAR_MAP = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  line: '--line',
  fg: '--fg',
  dim: '--dim',
  danger: '--danger',
};

/**
 * @param {object} theme  { id, name, vars, wallpaper, radius }
 * @param {Element} [stage] 外壳挂载的根节点，用来换壁纸
 */
export function applyTheme(theme = {}, stage) {
  const root = document.documentElement.style;
  const vars = theme.vars || {};

  // 四色设计：主题只给 bg / fg / accent / deco，其余按比例算出来
  const bg = vars.bg || '#0d0f13';
  const fg = vars.fg || '#e6e9f0';
  const full = {
    bg,
    fg,
    surface: vars.surface || mix(fg, bg, 0.06),
    surface2: vars.surface2 || mix(fg, bg, 0.11),
    line: vars.line || mix(fg, bg, 0.16),
    dim: vars.dim || mix(fg, bg, 0.60),
    danger: vars.danger || '#e08a8a',
  };
  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    root.setProperty(cssVar, full[key]);
  }

  if (vars.accent) {
    root.setProperty('--accent', vars.accent);
    root.setProperty('--accent-ink', readableInk(vars.accent));
    root.setProperty('--accent-glow', hexToRgba(vars.accent, 0.35));
    // 强调色当文字用时的安全版本：和底色对比不够就往文字色靠
    root.setProperty('--accent-text', contrast(vars.accent, bg) >= 3.2
      ? vars.accent
      : mix(vars.accent, fg, 0.55));
  }
  // 装饰色：只用于点、线、高亮，不当正文颜色
  root.setProperty('--deco', vars.deco || vars.accent || fg);

  if (theme.radius != null) root.setProperty('--radius', `${theme.radius}px`);
  root.setProperty('--wallpaper', theme.wallpaper || 'none');

  if (stage) stage.dataset.wallpaper = theme.id || '';
  document.documentElement.dataset.theme = theme.id || 'custom';

  // 让 select 下拉、滚动条这些浏览器原生控件跟着主题走亮/暗，
  // 不然深色主题里会弹出一块白的，一眼出戏。
  root.setProperty('color-scheme', relLuminance(hexToRgb(bg)) > 0.5 ? 'light' : 'dark');
}


/** a 盖在 b 上，t = a 的比例 */
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const ch = (x, y) => Math.round(x * t + y * (1 - t)).toString(16).padStart(2, '0');
  return `#${ch(A.r, B.r)}${ch(A.g, B.g)}${ch(A.b, B.b)}`;
}

/** 粗略对比度：够不够看清 */
function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 相对亮度：先把 sRGB 转成线性，再按人眼加权 */
function luminance(hex) {
  return relLuminance(hexToRgb(hex));
}

function relLuminance({ r, g, b }) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/**
 * 强调色上的字：深色底配浅字，浅色底配深字。
 *
 * 旧版两个分支都返回近黑色，深绿 / 酱红这类深强调色上就成了
 * "黑字压深底"，按钮和气泡糊成一块。现在按白字的对比度分档：
 * 白字能到 3:1 就用浅字（深绿、藏蓝、朱红都走这档），否则用深字。
 */
function readableInk(hex) {
  const light = relLuminance(hexToRgb(hex));
  const whiteContrast = 1.05 / (light + 0.05);
  return whiteContrast >= 3.0 ? '#f7f9f8' : '#10130f';
}

function hexToRgb(hex) {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
