# AGENTS.md — xiaoshouji（代码内规矩）

> 产品视角看 [docs/产品说明.md](docs/产品说明.md)，内核边界看 [docs/内核边界.md](docs/内核边界.md)。
> 项目背景、22 条已定决策、路线图看 [../framework/项目总纲.md](../framework/项目总纲.md)。
> 改代码前先读本文件。

## 跑

```bash
cd /root/workspace/xiaoshouji
python3 -m http.server 8770     # 打开 http://127.0.0.1:8770/
```

没有构建、没有打包、没有 npm 依赖（`tests/` 除外）。改完刷新就是最新。

## 验收（每次都跑）

```bash
cd tests && npm test
```

- `smoke.mjs`：启动 → 桌面 → 列表 → 对话 → 流式回复 → 设置 → 提示词 → 落盘 → 导出
- `swap.mjs`：只改 `app.json` 的 `shell` 字段，换外壳后聊天照常
- `market.mjs`：商店里换桌面 / 装卸应用，不刷新页面，商店自身只读
- `contacts.mjs`：新建人物 → 聊天列表出现 → 用新人设聊一句 → 删除 → 恢复默认 → 落盘
- `memory.mjs`：聊够轮数自动记一笔 → 记忆 App 可见 → 进提示词 → 能删
- `wallpaper.mjs`：装完桌面多图标 → 点开是编辑器 → 换模板落盘 → 换另一款只留一层
- `registry.mjs`：老快照不挡住新增 App → 卸载生效 → 卸载后新增 App 仍在
- `stale.mjs`：本机名单里留着不存在的模块 → 照常启动 → 自动摘掉
- `ui.mjs`：不装任何东西按钮就是好的（内核基线）→ 商城「界面」切到「线框按钮」→ 发送键当场变描边 → 换回「内置」恢复

改完内核或加模块，**这九条必须还是全绿**。红了先修，别加新功能。

## 硬规矩

1. `modules/` 里**不许出现 import**。要能力就从 `ctx` 拿。
   这是"模块可以被 eject"的前提，破了这条整套设计就塌了。
2. 模块声明 `api: '1.x'`，不符 `boot.js` 会拒绝加载。
3. 数据只写自己的命名空间：`ctx.vault.namespace('app.xxx')`。
4. 模块必须有 `destroy()`，把定时器、监听、DOM 都清掉。
5. **模块自带样式**：写 `css: 'style.css'` 并放进模块目录。`core/styles.css` 放控件基线
   （每个控件一份，简洁但不能丑）；皮肤模块只准覆盖这些类名，不许另起一套。
   模块专属的 `.shop-*` 这类，永远不进内核。
6. 颜色不许写死，一律走 CSS 变量（`--accent` `--surface` `--line` `--fg` `--dim` 等，`tokens.js` 注入）。
   商店自己也是这么写的——所以换主题时它跟着变，这是"全局生效"的验收方式。

## 加一个模块

```
modules/<id>/index.js
```

```js
export default {
  id: '<id>',
  kind: 'app',            // shell | app | runtime | feature | ui | theme | pack
  api: '1.x',
  meta: { name: '名字', icon: '▦', color: '#334455' },
  css: 'style.css',       // 可选：自带样式，内核只插一次 <link>
  setup(ctx) {},          // 可选
  mount(body, ctx, api) { return { destroy() {} }; },  // 只有 app 需要
};
```

然后在 `app.json` 里登记：
- 应用 → `apps` 数组
- 外壳 → `shell` 字段
- 角色脑子 → 人物的 `runtime` 字段（会在启动时自动装载）
- 界面皮肤（只有样式）→ **不进 `app.json`**，在商城「界面」里单选；不选就是内核基线

`feature` 类模块不画桌面，但可以 `ctx.host.registerApp({...})` 自带一个 App
（`memory.simple` 就是这么带出「记忆」页的）。功能模块在 `app.json` 的 `features` 数组里登记。

**想让它在商店里出现**，还要往 `store.json` 的 `modules` 里加一条：
`{ id, kind, name, version, icon, summary }`。商店只读这份清单，不读目录。

## 商城是怎么运作的

```
store.json ──读──> market ──写──> vault[core/market]
                     │                 （用户选了什么）
                     └──> boot.assemble() 重新装配
```

- 商城**不改 `app.json`、不下载、不安装**，只记"用户选了什么"
- 点一下 → `ctx.reboot('app.store')` → 原地重装，**不刷新页面**，商店自己还开着
- 重装顺序：销毁外壳 → 清 stage 上模块留下的节点 → `host.reset()` → `apps.clear()` → `prompt.reset()` → UI → 角色脑子 → 应用 → 功能 → 外壳
- 想回到 `app.json` 的初始状态：设置里"清空本机数据"，或 `market.reset()`

## 主题

- 主题是**数据**，写在 `store.json` 的 `themes` 数组里，没有模块目录
- 每条主题：`{ id, name, summary, vars{bg,surface,surface2,line,fg,dim,accent,danger}, wallpaper }`
- 换主题**不重装**：`market.setTheme(id)` → `ctx.settings.set('theme.accent', null)` → `ctx.applyTheme()`
- 设置里的"强调色"是覆盖项；挑主题会把它清掉，让主题自带的颜色回来
- 新增主题只要往 `themes` 里加一条，商店自动出现（带四格色板）

**加主题时注意**：先确认浅色主题的对比度。`fg`/`dim`/`line` 三个值如果和 `bg` 太接近，
对话框会糊成一片。`--accent-ink` 是自动算的（按亮度配黑字或白字），不用手填。

## 改内核时注意

- `boot.js` 里模块装载顺序：**UI → 角色脑子 → 应用 → 功能(feature) → 外壳**。
  UI 排最前，它的样式表才在应用 css 前面，应用能盖掉它（D19）。功能自带的 App 靠这个顺序排在配置应用后面。
- **App 只能通过 `ctx.apps.register()` 进桌面**，外壳订阅 `apps:changed` 自己重画。别再往 `mount` 里塞数组——快照式的，后加的 App 永远不显示。
- 任何"重装"路径都必须先 `ctx.prompt.reset()`，否则人设会被拼两遍；`prompt` 的贡献者是数组，不是 Map。
- `host.reset()` 会清掉应用注册表，重装前必须调，否则旧应用还挂在里面。
- `host.js` 的 `open()` 会把 `ctx` 一起传给 `mount`，别改成全局变量。
- `vault.js` 的 key 用 `\u0000` 分隔命名空间，改之前先想清楚导出格式。

## 界面规矩

- **内核不做假手机**：没有状态栏、没有"小手机"标题。想要这些，写在模板外壳里。
- 只用标度变量：`--sp-*` `--fs-*` `--r-*`，不要写 `13px` 这种裸值。
- 手机上铺满，宽屏（≥720px）收成 420px 的"手机"，这条写在 `core/styles.css` 的 `.stage` 里，别在模块里重复实现。
- `:active` 必须有；`:hover` 只在 `@media (hover: hover)` 里写，否则手机上会粘住。
- **外壳必须自带整套桌面样式**（网格、图标底座、Dock/侧栏）。内核只提供 `.stage` 容器，
  不许再定义 `.desktop / .icon-grid / .appicon / .tile`——踩过坑：这样会导致切换外壳时只有排布变。
- 允许外壳之间重复写 `.appicon/.tile`。要统一，就做一个 UI 模块让大家依赖，别塞回内核。
- **`ctx.stage` 只许背景类模块碰**（现在只有 `fx.bg.*` 三个）。它插的节点要带
  `data-module-owned`，重装时 `boot` 会清掉；模块自己的监听要在 setup 里换掉旧的，否则闭包会过期。

## 外壳

| 模块 | 样子 |
|---|---|
| `shell.grid` | 默认，朴素方块网格（自带 style.css） |
| `shell.asael` | 玻璃图标 + 底部 Dock（自带 style.css） |
| `shell.sidebar` | 左列 + 右内容（自带 style.css） |

## 内核红线

`core/` 的 JS 控制在 **1500 行**以内（现在 1253）。加功能前先问：能不能做成模块？
只有"所有模块都要用"的才进内核。CSS 同理，模块专属样式放模块里。

## 铁律

**模块装完必须在桌面可见。** 槽位、后台挂载这类"看不见的生效"一律不做——
背景模块返工三次就是踩在这个上。

例外只有 `kind: 'ui'` 的皮肤：它没有图标，但永远在商城「界面」里，随时能换回「内置（默认）」。
验收看"切到它按钮当场变样、换回内置立刻恢复"——它不是后台挂载，是一层可替换的样式。

## 已知待办

- 导入时"模块不在 → 暂存区"的逻辑（`vault.importAll` 目前是直接覆盖）
- 人物头像只能填表情或图片地址，还不能上传本地图（要做的话得先有图片压缩）
- 记忆只有"最近 + 关键字"召回，没有向量检索；想要更聪明的记忆，新写一个 `memory.*` 模块替换它
