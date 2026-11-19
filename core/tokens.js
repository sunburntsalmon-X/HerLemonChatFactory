/**
 * 主题 · 颜色令牌
 *
 * 一套主题只给四个基础色：背景 bg、文字 fg、强调 accent、装饰 deco。
 * 其余颜色全部在这里按"角色"算出来，模块只准用角色变量，不准自己调比例。
 *
 * ---------------------------------------------------------------------------
 * 角色表（core/styles.css 和所有模块都按这张表用色）
 *
 *   层 / 角色       变量               什么时候用
 *   ------------    -----------------  ------------------------------------
 *   页面底          --bg               页面、桌面、顶栏底
 *   卡片            --surface          设置分组、商店卡片、弹窗
 *   控件            --surface-2        输入框、封面、头像底座、AI 气泡
 *   按下 / 抬起     --surface-3        按下态、需要再抬一层的块
 *   分隔线          --line-soft        列表行之间的细线、卡片内部分隔
 *   边界            --line             输入框、卡片描边、需要看清的框
 *   正文            --fg               主要内容
 *   次要文字        --dim              说明、时间、预览、占位符
 *   主操作          --accent           发送、新建、主要按钮的底
 *   强调色上的字    --accent-ink       放在 --accent 上的文字
 *   强调色当文字    --accent-text      链接、返回键、选中的字
 *   强调浅底        --accent-soft      选中态胶囊、"使用中"这类状态
 *   强调描边        --accent-line      浅底强调块的边框
 *   装饰            --deco             圆点、小竖条、难度点
 *   危险            --danger / --danger-soft  删除、清空、错误
 *
 * 两条底线：
 * 1. 次要文字和背景的对比度不低于 4:1，强调色当文字用不低于 4.5:1；
 * 2. 换主题 = 全部重算一遍，深色/浅色主题都走同一套规则。
 * ---------------------------------------------------------------------------
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

/** 角色 → CSS 变量。主题里如果自带某一层（内置主题），优先用主题的。 */
const VAR_MAP = {
  bg: '--bg',
  surface: '--surface',
  surface2: '--surface-2',
  surface3: '--surface-3',
  line: '--line',
  lineSoft: '--line-soft',
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

  const bg = vars.bg || FALLBACK_THEME.vars.bg;
  // 主题自带的正文色先过一遍对比度：差的主题自动往黑/白推，正文永远看得清
  const fg = readableOn(bg, vars.fg || FALLBACK_THEME.vars.fg, 4.5);
  const accent = vars.accent || vars.deco || FALLBACK_THEME.vars.accent;
  const dark = relLuminance(hexToRgb(bg)) < 0.45;

  // 中性层：深色主题往亮里推、浅色主题往暗里推，一层比一层远。
  // "面"只要和底有区别就行，别做成两块差不多的灰。
  const near = dark ? 0.055 : 0.05;
  const surface = pick(vars.surface, mixToward(fg, bg, near));
  const surface2 = pick(vars.surface2, mixToward(fg, bg, near * 2));
  const surface3 = pick(vars.surface3, mixToward(fg, bg, near * 3.4));
  const line = pick(vars.line, mixToward(fg, bg, dark ? 0.16 : 0.14));
  const lineSoft = pick(vars.lineSoft, mixToward(fg, bg, dark ? 0.10 : 0.08));

  // 次要文字：至少 4:1，太淡的主题自动往正文色靠
  const dim = pick(vars.dim, riseTo(fg, bg, 0.58, 4.0));

  // 危险色：主题没给就从一个正红往文字色里调，浅底深底都能看清
  const danger = pick(vars.danger, mixToward(fg, '#c2453e', 0.3));
  const dangerSoft = mixToward(danger, bg, dark ? 0.2 : 0.12);

  const full = { bg, surface, surface2, surface3, line, lineSoft, fg, dim, danger };
  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    root.setProperty(cssVar, full[key]);
  }

  // 强调色：动作底、动作上的字、当文字用、浅底、描边，一共五个浓度
  const accentSoft = mixToward(accent, bg, dark ? 0.2 : 0.13);
  root.setProperty('--accent', accent);
  root.setProperty('--accent-ink', readableInk(accent));
  root.setProperty('--accent-text', accentAsText(accent, bg, fg));
  root.setProperty('--accent-soft', accentSoft);
  root.setProperty('--accent-line', mixToward(accent, bg, 0.4));
  root.setProperty('--accent-glow', hexToRgba(accent, 0.35));

  // 装饰色只用于点、细条，不承担正文
  root.setProperty('--deco', vars.deco || accent);
  root.setProperty('--danger-soft', dangerSoft);

  if (theme.radius != null) root.setProperty('--radius', `${theme.radius}px`);
  root.setProperty('--wallpaper', theme.wallpaper || 'none');

  if (stage) stage.dataset.wallpaper = theme.id || '';
  document.documentElement.dataset.theme = theme.id || 'custom';

  // 让 select 下拉、滚动条这些浏览器原生控件跟着主题走亮/暗，
  // 不然深色主题里会弹出一块白的，一眼出戏。
  root.setProperty('color-scheme', dark ? 'dark' : 'light');
}

/* ==========================================================================
   计算工具：全部在 sRGB 和相对亮度之间换算，保证对比度判断是真的
   ========================================================================== */

/** 主题给了就用主题的，没给才用算出来的 */
function pick(given, computed) {
  return given || computed;
}

/** a 混到 b 上，t = a 的比例 */
function mixToward(a, b, t) {
  return rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), clamp01(t)));
}

/** 从"正文色"往"背景色"调，直到和背景的对比度够 min 为止 */
function riseTo(fg, bg, start, min) {
  const F = hexToRgb(fg);
  const B = hexToRgb(bg);
  let t = clamp01(start);
  while (t < 1) {
    if (contrastRgb(mixRgb(F, B, t), B) >= min) break;
    t = Math.min(1, t + 0.05);
  }
  return rgbToHex(mixRgb(F, B, t));
}

/**
 * 正文色和背景对比不够时，往黑或白推，直到够 min。
 * 先比较黑字/白字哪个能做到更高对比，再往那个方向推——
 * 亮底（比如糖果玫红）配白字最多只有 4:1，配黑字才够 5:1。
 */
function readableOn(bg, fg, min) {
  const B = hexToRgb(bg);
  const F = hexToRgb(fg);
  if (contrastRgb(F, B) >= min) return fg;

  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const target = contrastRgb(black, B) >= contrastRgb(white, B) ? black : white;

  let best = F;
  let bestC = contrastRgb(F, B);
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mixRgb(F, target, Math.min(1, t));
    const cc = contrastRgb(c, B);
    if (cc > bestC) {
      bestC = cc;
      best = c;
    }
    if (cc >= min) return rgbToHex(c);
  }
  return rgbToHex(best);
}

/** 强调色当文字用时：对比度不够就往正文色靠，仍保留一点色相 */
function accentAsText(accent, bg, fg) {
  const A = hexToRgb(accent);
  const B = hexToRgb(bg);
  const F = hexToRgb(fg);
  if (contrastRgb(A, B) >= 4.5) return accent;
  let c = A;
  for (let t = 0.1; t <= 0.9; t += 0.1) {
    c = mixRgb(A, F, t);
    if (contrastRgb(c, B) >= 4.5) return rgbToHex(c);
  }
  // 实在调不到（主题正文色本身就贴边），直接用正文色，至少能看清
  return rgbToHex(F);
}

/**
 * 强调色上的文字：深底配浅字，浅底配深字。
 * 白字能到 3:1 就用白字——深绿、酱红这类主题配黑字会"闷"成一块。
 */
function readableInk(hex) {
  const whiteContrast = 1.05 / (relLuminance(hexToRgb(hex)) + 0.05);
  return whiteContrast >= 3.0 ? '#f7f9f8' : '#10130f';
}

function mixRgb(A, B, t) {
  return {
    r: Math.round(A.r * t + B.r * (1 - t)),
    g: Math.round(A.g * t + B.g * (1 - t)),
    b: Math.round(A.b * t + B.b * (1 - t)),
  };
}

function contrastRgb(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 相对亮度：先把 sRGB 转成线性，再按人眼加权 */
function relLuminance({ r, g, b }) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '').trim();
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
