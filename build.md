# 构建与打包指南 - 风灵月影宗

> 打包配置以 `package.json` 的 `build` 段为唯一权威，本文档只做说明；两者不一致时以 `package.json` 为准。

## 环境要求

- Node.js ≥ 18（推荐 v20+），npm ≥ 9
- 目标平台：Windows 10/11 x64（仅构建 Windows）
- `.npmrc` 已将 npm registry、Electron 与 electron-builder 二进制下载指向 npmmirror 国内镜像；换网络环境后安装变慢或失败，优先怀疑网络，勿删镜像配置

## 安装依赖

```bash
npm install
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（HMR；渲染进程 dev server 为 http://localhost:5173） |
| `npm run build` | 构建生产资源 → `out/` |
| `npm run preview` / `npm start` | 预览 `out/` 产物 |
| `npm run dist` | build + electron-builder 打包 → `dist/` |

## 一键打包

```powershell
.\build.ps1   # PowerShell，推荐
build.bat     # 仅限 CMD 环境；在 PowerShell 中运行会报语法错误
```

脚本流程：环境检查 → 自动安装依赖 → 清理旧产物（`out/`、`dist/`）→ `npm run build` → `electron-builder` 打包。

注意：`build.bat` 必须保持纯 ASCII 英文输出（历史上出过编码事故），不要往里加中文。

## 打包产物

位于 `dist/`，文件名中的版本号来自 `package.json` 的 `version`（ASCII 命名，便于 GitHub Releases 直链下载与应用内更新）：

| 文件 | 类型 | 用途 |
|------|------|------|
| `FlingTrainer-Manager-Setup-x.x.x.exe` | NSIS 安装包（可选安装目录、桌面 + 开始菜单快捷方式） | 正式分发（应用内更新的下载对象） |
| `FlingTrainer-Manager-x.x.x-win.zip` | 便携版（解压即用） | 随身携带 |
| `FlingTrainer-Manager-x.x.x-win.zip.blockmap` / `builder-effective-config.yaml` | 差分更新元数据 / 生效配置快照 | 顺带生成 |

## 关键打包配置（已启用）

- `asar.smartUnpack` —— 源码保护 + 二进制文件智能解包
- `compression: maximum` —— 最高压缩级别
- NSIS：非 one-click、允许自选安装目录、Unicode、差分更新（`differentialPackage`）
- `win.requestedExecutionLevel: asInvoker`；禁用代码签名（`signAndEditExecutable: false`，规避符号链接权限问题）
- `publish` 指向 GitHub `GDWhisper/FlingTrainer-Manager`（应用内更新的清单与资产来源）
- `afterPack` 钩子（`build/after-pack.js`）：UPX 压缩主程序，UPX 不在 PATH 时优雅跳过

## 应用内更新的发布流程

应用自带的更新功能（`src/main/services/updater.js`）从 GitHub Release 拉取清单与安装包，发版时需手动上传「四件套」到对应 Release：

1. 改 `package.json` 的 `version` → `npm run dist`
2. 上传到 GitHub Release（draft → publish）：
   - `FlingTrainer-Manager-Setup-x.x.x.exe`（NSIS 安装包，应用内更新的下载对象）
   - `FlingTrainer-Manager-x.x.x-win.zip`（便携版）
   - `latest.yml`（更新清单：版本号、文件名、sha512、大小）
   - `.exe.blockmap`（保留即可，应用内更新暂不使用差分下载）
3. 校验：发布后访问 `https://github.com/GDWhisper/FlingTrainer-Manager/releases/latest/download/latest.yml` 能取到新版本清单，旧版本应用即可在「设置 → 软件更新」中看到更新

注意：应用内更新下载的是 NSIS 安装包；便携 zip 用户走「前往下载页」手动更新（通过 exe 旁有无 NSIS 卸载器自动判定）。

## 常见问题

### 打包提示「无法创建符号链接」
以管理员身份运行 PowerShell 重试；或启用 Windows 开发者模式（设置 → 更新和安全 → 开发者）。

### 杀毒软件误报
electron-builder 产物可能被误判：加入杀软白名单，或对安装包做数字签名（需证书）。

### 依赖 / Electron 下载缓慢
检查 `.npmrc` 镜像配置是否完整。

### 修改版本号
只改 `package.json` 的 `version` 字段，产物文件名自动跟随。

## 修复日志

### 2026-03-27
- 修复 PowerShell 兼容性问题，新增 `build.ps1`
- 移除 electron-builder 25 不再支持的 `nsis.compressor` / `nsis.solid` 配置，改用 `build/installer.nsh` 中的 `SetCompressor lzma`
- 修复 `asar.ordering` 配置导致的目录读取错误（该配置已移除）
- 修复 NSIS 脚本中 `WriteUninstaller` 的使用错误（electron-builder 会自动处理卸载器）
- 禁用代码签名以规避符号链接权限问题

---

**许可证**: GPL v3 | **作者**: Github@GDWhisper
