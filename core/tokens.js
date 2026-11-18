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

  for (const [key, cssVar] of Object.entries(VAR_MAP)) {
    if (vars[key]) root.setProperty(cssVar, vars[key]);
  }

  if (vars.accent) {
    root.setProperty('--accent', vars.accent);
    root.setProperty('--accent-ink', readableInk(vars.accent));
    root.setProperty('--accent-glow', hexToRgba(vars.accent, 0.35));
  }

  if (theme.radius != null) root.setProperty('--radius', `${theme.radius}px`);
  root.setProperty('--wallpaper', theme.wallpaper || 'none');

  if (stage) stage.dataset.wallpaper = theme.id || '';
  document.documentElement.dataset.theme = theme.id || 'custom';
}

/** 亮点色配深字，暗点色配浅字 */
function readableInk(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#12140f' : '#0b0e14';
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
