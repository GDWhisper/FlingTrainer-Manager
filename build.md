# 风灵月影宗 FlingTrainer-Manager

> 风灵月影宗 - 专为下载并管理单机游戏辅助工具而设计的 Electron 桌面程序。

## 📋 目录

- [环境要求](#环境要求)
- [安装依赖](#安装依赖)
- [开发指南](#开发指南)
- [构建打包](#构建打包)
- [体积优化](#体积优化)
- [常见问题](#常见问题)

---

## 🔧 环境要求

在开始之前，请确保您的系统满足以下要求：

- **Node.js**: v18 或更高版本（推荐 v20+）
- **npm**: v9 或更高版本（或使用 yarn/pnpm）
- **操作系统**: Windows/macOS/Linux
- **Git**: 用于代码管理（可选）

### 检查 Node.js 版本

```bash
node -v
npm -v
```

如果版本过低，请前往 [Node.js 官网](https://nodejs.org/) 下载最新版本。

---

## 📦 安装依赖

### 1. 克隆项目（如果是首次获取）

```bash
git clone <repository-url>
cd FlingTrainer-Manager
```

### 2. 安装项目依赖

使用 npm：
```bash
npm install
```

或使用 yarn：
```bash
yarn install
```

或使用 pnpm：
```bash
pnpm install
```

### 3. 配置 Electron 镜像（可选）

项目已包含 `.npmrc` 文件，配置了 Electron 镜像源以加速下载。如果遇到下载缓慢的问题，可以检查该文件内容：

```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
```

---

## 💻 开发指南

### 启动开发服务器

在项目根目录执行以下命令启动开发环境：

```bash
npm run dev
```

这将：
- 使用 `electron-vite` 构建项目
- 自动打开应用程序窗口
- 启用热模块替换（HMR），代码更改后自动刷新

**提示**：开发模式下，您可以实时查看代码更改效果，适合调试和开发新功能。

### 预览构建结果

如果您想预览生产构建的效果（但不打包）：

```bash
npm run preview
```

---

## 🏗️ 构建打包

### 1. 构建生产资源

仅构建不打包（生成 `out/` 目录）：

```bash
npm run build
```

### 2. 完整打包（推荐）

构建并生成可分发的安装包：

```bash
npm run dist
```

这个命令会：
1. 先执行 `npm run build` 构建生产资源
2. 然后使用 `electron-builder` 打包成可执行程序

### 3. 输出产物

打包完成后，生成的文件位于 `dist/` 目录下：

- **安装包版本**: `风灵月影宗 Setup x.x.x.exe`（NSIS 安装包）
- **便携版本**: `风灵月影宗-x.x.x-Portable.exe`（便携版可执行文件）

其中 `x.x.x` 为您的应用版本号（在 `package.json` 中定义）。

### 4. 打包配置说明

根据 `package.json` 中的配置，打包选项包括：

- **产品名称**: 风灵月影宗
- **应用 ID**: com.gdw.flingtrainermanager
- **安装包类型**: NSIS（Windows Installer）
- **安装选项**: 
  - 允许用户选择安装目录
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式
- **ASAR 打包**: 启用（保护源码并减小体积）
- **压缩级别**: Maximum（LZMA + 固实压缩）
- **输出目录**: `dist/`

---

## 🚀 构建说明

### 一键打包脚本

项目提供了便捷的一键打包脚本，自动化完成整个构建和打包流程。

#### Windows 系统

**推荐使用 PowerShell 脚本 (⭐首选):**

```powershell
.\build.ps1
```

**特性**:
- ✅ PowerShell 原生语法，完美兼容 Windows 10/11
- ✅ 彩色输出，更清晰的日志提示
- ✅ 更好的错误处理和诊断信息
- ✅ 自动计算文件大小（MB 单位）
- ✅ 详细的时间戳和统计信息

**或使用 CMD 脚本 (传统方式):**

```cmd
build.bat
```

**注意**: 
- ⚠️ 仅限在 Windows CMD 环境中运行
- ⚠️ 在 PowerShell 中运行 `build.bat` 会出现语法错误
- ⚠️ 如果不确定，请使用 `build.ps1`

#### macOS / Linux 系统

**使用 `build.sh` 脚本:**

1. **赋予执行权限** (首次运行):
   ```bash
   chmod +x build.sh
   ```

2. **运行脚本**:
   ```bash
   ./build.sh
   ```

### 脚本功能

两个脚本均提供以下功能:

✅ **环境检查**: 自动检测 Node.js 和 npm 是否安装  
✅ **依赖管理**: 首次运行时自动安装项目依赖  
✅ **版本显示**: 显示当前项目版本号  
✅ **清理旧文件**: 自动删除之前的构建产物 (`out/` 和 `dist/`)  
✅ **构建编译**: 执行 `npm run build` 编译 Electron 应用  
✅ **打包发布**: 执行 `electron-builder` 生成安装包  
✅ **错误处理**: 任何步骤失败时会显示错误信息并暂停  

### 输出产物

打包完成后，在 `dist/` 目录下生成:

- **风灵月影宗 Setup x.x.x.exe** - NSIS 安装包 (推荐)
- **风灵月影宗-x.x.x-Portable.exe** - 便携版可执行文件

### 手动构建命令

如果不想使用脚本，也可以手动执行:

```bash
# 安装依赖 (首次)
npm install

# 构建
npm run build

# 打包
npm run dist
```

### 系统要求

- **Node.js**: >= 18 (推荐 v18+)
- **npm**: 最新版本
- **操作系统**: Windows 10/11, macOS 10.13+, Linux

---

## 📊 体积优化策略

本项目采用了多项体积优化技术，在保证功能完整的前提下尽可能减小安装包大小。

### 已启用的优化

#### 1. ASAR 智能打包
```json
{
  "asar": {
    "smartUnpack": true,
    "ordering": "src"
  }
}
```
- 自动解包需要直接访问的二进制文件
- 优化文件加载顺序，提升启动速度

#### 2. 最大压缩级别
```json
{
  "compression": "maximum",
  "nsis": {
    "compressor": "lzma",
    "solid": true
  }
}
```
- 使用 LZMA 压缩算法（比传统 zlib 压缩率更高）
- 固实压缩（Solid Compression）提升整体压缩率

#### 3. 自动排除开发依赖
- electron-builder 自动识别并排除 `devDependencies`
- 排除测试文件、文档、配置文件等非必要内容

### 进一步优化（可选）

如需更极致的体积优化，可以使用 UPX 压缩可执行文件：

#### 安装 UPX
1. 下载：https://github.com/upx/upx/releases
2. 解压并将 `upx.exe` 添加到系统 PATH
3. 在 `package.json` 中启用 afterPack 钩子：
```json
{
  "build": {
    "afterPack": "build/after-pack.js"
  }
}
```

**预期效果**: 可额外减少约 15-25% 的体积

### 性能与体积对比

| 配置方案 | 安装包大小 | 便携版大小 | 构建时间 | 推荐场景 |
|---------|-----------|-----------|---------|---------|
| 默认配置 | ~95 MB | ~105 MB | 快 | 快速迭代开发 |
| **当前优化** | **~85 MB** | **~92 MB** | 中等 | **正式分发（推荐）** |
| UPX+LZMA | ~75 MB | ~82 MB | 慢 | 极致体积优化 |

*注：以上数据为预估值，实际大小取决于项目内容和依赖*

### 详细文档

更详细的构建配置和优化策略说明，请参阅 [`BUILD_CONFIG.md`](BUILD_CONFIG.md)。

---

## ❓ 常见问题

### Q1: 依赖安装失败

**问题**: 运行 `npm install` 时出现错误

**解决方案**:
```bash
# 清除缓存后重试
npm cache clean --force
npm install

# 或者删除 node_modules 和 package-lock.json 后重新安装
rm -rf node_modules package-lock.json
npm install
```

### Q2: Electron 下载缓慢

**问题**: 下载 electron 依赖时速度很慢

**解决方案**: 确认 `.npmrc` 文件中已配置国内镜像源：
```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
```

### Q3: 打包时提示找不到图标文件

**问题**: `icon.ico` 文件不存在

**解决方案**: 
1. 准备一个 256x256 像素的 ICO 格式图标
2. 将其放置在项目根目录
3. 重新运行打包命令

### Q4: 开发服务器启动失败

**问题**: 运行 `npm run dev` 时报错

**解决方案**:
```bash
# 检查是否有语法错误
npm run build

# 查看具体错误信息
# 根据错误提示修复代码问题
```

### Q5: 如何修改应用版本号？

编辑 `package.json` 文件，修改 `version` 字段：

```json
{
  "version": "0.2.7"  // 修改这里的版本号
}
```

然后重新运行 `npm run dist` 进行打包。

### Q6: 打包时提示"无法创建符号链接"

**错误信息**: `Cannot create symbolic link : 客户端没有所需的特权`

**解决方案**:
1. **以管理员身份运行 PowerShell**（推荐）
   - 右键点击 PowerShell → "以管理员身份运行"
   - 然后执行 `.\build.bat`

2. **启用 Windows 开发者模式**
   - 设置 → 更新和安全 → 开发者 → 启用"开发者模式"
   - 重启终端

3. **修改组策略**
   - 运行 `secpol.msc`
   - 本地策略 → 用户权限分配 → "创建符号链接"
   - 添加当前用户

### Q7: 安装包体积过大

**优化建议**:
1. 检查是否包含了不必要的大文件
2. 确认 `out/` 目录中没有开发调试文件
3. 考虑使用 UPX 压缩（见上方"进一步优化"）
4. 如果使用了很多大型依赖，考虑按需加载

### Q8: 杀毒软件误报

**原因**: electron-builder 打包的可执行文件可能被误判

**解决方案**:
1. 向杀毒软件添加白名单
2. 考虑对安装包进行数字签名（需要购买证书）
3. 已在配置中添加 `"requestedExecutionLevel": "asInvoker"` 降低敏感度

> **注意**: 推荐使用 `build.bat` 脚本进行打包，脚本会自动处理所有步骤，包括依赖安装、构建和打包。

---

## 🛠️ 技术栈

- **Electron**: v37.4.0
- **Vite**: v5.4.0
- **electron-vite**: v2.0.0
- **electron-builder**: v25.1.8
- **axios**: v1.11.0
- **cheerio**: v1.1.2

---

## 📝 其他命令

| 命令 | 说明 |
|------|------|
| `npm run start` | 快速预览（使用 electron-vite preview） |
| `npm run dev` | 开发模式（支持热更新） |
| `npm run preview` | 预览生产构建 |
| `npm run build` | 构建生产资源 |
| `npm run dist` | 完整构建并打包 |

---

## 📄 许可证

GPL v3

## 👤 作者

Github@GDWhisper

---

**祝您使用愉快！** 🎮
