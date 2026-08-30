# AGENTS.md

只记录「读代码、看配置推断不出来」的约束。项目介绍看 `README.md`，打包细节以 `build.md` 为准（配置权威仍是 `package.json`），路线图与发布核对清单见 `docs/ROADMAP.md`，不要从本文件复制这些内容。

## 项目定位

仅面向 Windows 的 Electron 桌面应用（产品名「风灵月影宗」）：抓取 flingtrainer.com 的游戏修改器（Trainer）并提供一键下载与本地管理。纯 JavaScript，无前端框架，无 TypeScript。

## 目录导航

| 位置 | 职责 |
|---|---|
| `src/main/index.js` | 主进程入口，只负责窗口与生命周期 |
| `src/main/ipc/` | IPC 处理器；`ipc/index.js` 是唯一注册入口 |
| `src/main/services/` | `crawler.js`（cheerio 抓取）、`downloader.js`（内存下载队列单例）、`updater.js`（应用内更新） |
| `src/main/utils/` | `cache.js`（运行时数据路径）、`http.js`、`requestLimiter.js`（刷新配额） |
| `src/main/constants.js` | 目标 URL、缓存 TTL、限流参数 |
| `src/preload/index.js` | contextBridge，暴露 `window.api` |
| `src/renderer/` | 单页原生 ESM；`index.html` 含 5 个 `.page` 区块；功能模块在 `modules/` |
| `.dev_docs/` | 进行中的分析与重构文档（见「禁区」） |
| `scripts/gen-icon.py` | 应用图标生成脚本；`app-icon-dark.png` / `icon.ico` / `build/icon.ico` 均由它产出，改图标跑脚本，勿直接改图 |

## 常用命令

```bash
npm install        # registry 与 Electron 镜像在 .npmrc（npmmirror），勿删
npm run dev        # electron-vite dev；渲染进程 dev server 固定为 http://localhost:5173
npm run build      # electron-vite build → out/
npm run preview    # 运行 out/ 产物（npm start 等价）
npm run dist       # build + electron-builder → dist/
```

一键打包：`.\build.ps1`（PowerShell，推荐）；`build.bat` 仅限 CMD 运行。

**没有 test / lint / typecheck 脚本。** 不要臆造 `npm test`、`npm run lint` 之类命令；验证手段只有 `npm run build` + `npm run dev` 手动验证（手工用例见 `docs/ROADMAP.md` 发布核对清单）。

## 架构约束（为什么）

1. **仓库没有 `electron.vite.config.js`**：依赖 electron-vite 的默认入口约定（`src/main/index.js`、`src/preload/index.js`、`src/renderer/index.html`）。`main/index.js` 硬编码开发模式加载 `http://localhost:5173`——如需新增构建配置，不要改变入口与端口。
2. **限流是有意设计，不是性能缺陷**：`http.js` 的随机延迟、`requestLimiter.js` 的每日刷新配额与冷却、图片并发上限均为「道德爬虫」策略（见 `constants.js REQUEST_LIMITS`）。不要为提速移除。
3. **下载状态推送的三重防护**（近期两个提交 ce651b6 / 7db1758 修的内存泄漏）：主进程 `setInterval` 每秒推送，必须同时保留 ① 渲染进程 `beforeunload` 调 `stopDownloadListener` ② `onDownloadStatusChanged` 返回的解绑函数被调用 ③ 主进程 `sender.isDestroyed()` 兜底。改这段逻辑时三者缺一不可。
4. **`sanitizeTask` 白名单**（`downloader.js`）：推送给渲染进程的任务字段以白名单为准（`AbortController` 等不可序列化）。给下载任务新增字段时，必须同步加入白名单，否则渲染进程拿不到。
5. **运行时数据路径**（`utils/cache.js`）：dev 写仓库根 `.data/`（gitignored）；生产写 exe 旁 `FlingTrainer-Manager-Data/`（绿色便携设计），失败才回退 userData。读写缓存/设置一律经 `getCacheDir()` / `getAppDataPath()`，不要自拼路径——`files.js` 里硬编码 `.data/settings.json` 是已知 bug（见 `INITIAL_ANALYSIS.md`），不要照抄。
6. **主窗口 `devTools: false`**：无法直接开 DevTools。调试渲染进程：开发时用浏览器打开 `http://localhost:5173`（渲染层对 `window.api` 未定义有保护），或临时改该开关。
7. **无边框窗口** `frame: false`：最小化/最大化/关闭走 `ipc/window.js` + 渲染进程自定义标题栏，不要恢复系统边框。
8. **模块风格分裂是有意的**：`preload/index.js` 用 CJS（require/contextBridge），main 与 renderer 用 ESM，保持现状。
9. **版本号唯一权威是 `package.json` 的 `version`**（产物文件名依赖它）。`constants.js` 的 `APP_VERSION = '0.2.6'` 已过时（仅在 `main/index.js` 被 import，从未使用），不要依赖或扩展它。
10. **占位 IPC `show-confirm-dialog`，勿在其上构建功能**：恒返回 true（真实确认弹窗在渲染进程 `modules/downloads.js` 的 `showConfirmDialog`）。原「检查更新占位」已替换为真实实现（见下条）。
11. **下载任务不持久化**：任务只存在于 `downloader.js` 的内存 Map，重启即丢，这是有意现状（持久化在 `docs/ROADMAP.md` 路线图中），不要当作 bug 上报或顺手加持久化。
12. **应用内更新是全自研的，勿换回 electron-updater**（`services/updater.js`）：electron-updater 6.x 的下载器无 pause、无 Range 断点续传（取消重试即从头下载），不满足「可暂停/停止/重试」的产品要求。约束：清单走 GitHub `releases/latest/download/latest.yml` 稳定直链（`UPDATE_CONFIG.GITHUB_BASE` 可覆盖以便本地冒烟）；`.part` 保留即暂停、删除即停止，跨重启凭磁盘 `.part` 续传；sha512 校验通过才改名；安装仅 `spawn /S` 且需用户确认，绝不自动下载；dev（`app.isPackaged === false`）不检查更新；`update-state-changed` 推送与下载监听同样适用三重防护（见第 3 条）。

## 边界与禁区

- **`.dev_docs/REFACTORING_PLAN.md` 是未批准方案**：其中的 TypeScript 迁移、Vitest、winston、better-sqlite3 等，未经用户明确要求不要主动引入。
- **不要提交**：`.data/`（运行时数据，删它会清掉本地缓存与设置）、`out/`、`dist/`。
- **`build.bat` 保持纯 ASCII 英文输出**（commit 74e4908 是编码事故）；不要往里加中文。
- 不要改 `webPreferences` 的安全配置（`contextIsolation: true` / `nodeIntegration: false` / `sandbox: false`）。

## 常见任务配方

- **新增 IPC 功能**：① `src/main/ipc/<module>.js` 加 handler 并在 `ipc/index.js` 注册；② `preload/index.js` 挂到 `window.api`；③ renderer 调用。通道名 kebab-case；handler 返回值统一 `{ success, ... }` / `{ success: false, error }`。
- **新增页面/页签**：`index.html` 加 `.page` 容器与 `nav-link[data-page]`（页签为 `.tab-btn` / `.tab-pane`）→ `modules/navigation.js` 处理切换与懒加载标志 → `index.js` 的 DOMContentLoaded 里初始化。
- **抓取解析失效**（目标站改版时）：改 `services/crawler.js` / `downloader.js` 里的 cheerio 选择器；限流参数在 `constants.js`。
- **发版**：改 `package.json version`（产物文件名自动跟随）→ `npm run dist` → 在 GitHub Releases 手动上传安装包、便携 zip、`latest.yml` 与 `.blockmap` 四件套（`build/publish` 已指向 GDWhisper/FlingTrainer-Manager，应用内更新依赖该 Release 的 latest.yml）。

## 环境前置

- Node.js ≥ 18（推荐 v20+），npm。
- `.npmrc` 将 npm registry、Electron 与 electron-builder 二进制下载都指向 npmmirror 国内镜像；换网络环境安装变慢或失败时优先怀疑网络，而不是删镜像。
- 只构建 Windows x64（NSIS + zip）；产品名与产物文件名含中文，跨平台脚本注意编码。

## 领域术语

| 术语 | 含义 |
|---|---|
| Trainer / 修改器 | 游戏修改器，本应用下载管理的资源（.exe/.zip/.rar/.7z） |
| 风灵月影宗 | 本产品名；flingtrainer.com 为被抓取的目标站 |
| 页签 | tab；「我的修改器」页含「已下载 / 下载列表」两个页签 |
