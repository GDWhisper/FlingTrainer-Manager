# 🚀 打包配置快速参考

## 📦 应用信息

| 项目 | 值 |
|------|-----|
| **产品名称** | 风灵月影宗 |
| **应用 ID** | `com.gdw.flingtrainermanager` |
| **当前版本** | 0.3.0 |
| **目标平台** | Windows x64 |
| **打包工具** | electron-builder v25.1.8 |

---

## ⚡ 一键打包命令

### PowerShell (推荐) ✨
```powershell
.\build.ps1
```

**特性**:
- ✅ PowerShell 原生语法，完美兼容
- ✅ 彩色输出，更清晰的日志
- ✅ 更好的错误处理和诊断
- ✅ 文件大小自动计算（MB 单位）
- ✅ 时间戳和统计信息

### CMD (传统方式)
```cmd
build.bat
```

**注意**: 
- ⚠️ 仅限 Windows CMD 环境运行
- ⚠️ 在 PowerShell 中运行可能出现兼容性问题
- ⚠️ 单色输出，传统批处理格式

**选择建议**: 
- 💡 **PowerShell 用户** → 使用 `build.ps1` (强烈推荐)
- 💡 **CMD 用户** → 使用 `build.bat`
- 💡 **不确定** → 默认使用 `build.ps1`

---

## 🎯 核心优化配置

### 1. ASAR 智能打包
```json
"asar": {
  "smartUnpack": true
}
```
✅ 保护源码 + 提升加载速度

### 2. 最大压缩
```json
"compression": "maximum"
```
✅ 启用最高级别压缩

### 3. NSIS 高级选项
```json
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "differentialPackage": true,
  "unicode": true
}
```
✅ 完整功能安装包

### 4. 双格式输出
```json
"win": {
  "target": [
    {"target": "nsis", "arch": ["x64"]},
    {"target": "portable", "arch": ["x64"]}
  ]
}
```
✅ 同时生成安装包和便携版

---

## 📊 预期输出

### 生成文件（位于 `dist/` 目录）

| 文件名 | 类型 | 大小 | 用途 |
|--------|------|---------|------|
| `风灵月影宗 Setup 0.3.0.exe` | NSIS 安装包 | ~85 MB | 正式安装 |
| `风灵月影宗 0.3.0.exe` | 便携版 | ~85 MB | 随身携带 |

### 安装包功能
- ✅ 支持自定义安装路径
- ✅ 创建桌面快捷方式
- ✅ 创建开始菜单文件夹
- ✅ 包含卸载程序
- ✅ 差分更新支持

---

## 🔧 可选优化

### UPX 极致压缩（额外减少 15-25% 体积）

#### 步骤 1: 安装 UPX
下载：https://github.com/upx/upx/releases  
将 `upx.exe` 添加到系统 PATH

#### 步骤 2: 启用 afterPack 钩子
在 `package.json` 中添加：
```json
{
  "build": {
    "afterPack": "build/after-pack.js"
  }
}
```

---

## 🎛️ 配置切换

### 开发模式（快速构建）
修改 `package.json`:
```json
{
  "compression": "normal"
}
```

### 发布模式（当前默认）
```json
{
  "compression": "maximum"
}
```

---

## ❗ 常见问题速查

### 符号链接权限错误
**解决**: 以管理员身份运行 PowerShell

### 杀毒软件误报
**解决**: 添加白名单或等待病毒库更新

### 依赖下载缓慢
**检查**: `.npmrc` 已配置镜像源

### 图标文件缺失
**解决**: 准备 `icon.ico` (256x256) 放置项目根目录

### build.bat 报错 "'o' is not recognized"
**原因**: 在 PowerShell 中运行了 CMD 专用的批处理脚本  
**解决**: 使用 `.\build.ps1` 代替 `.\build.bat`

### NSIS 配置错误 (compressor/solid)
**原因**: electron-builder 25.x 已移除这些配置项  
**解决**: 已在 `build/installer.nsh` 中使用 `SetCompressor lzma` 设置

### WriteUninstaller 错误
**原因**: NSIS 脚本中使用了 WriteUninstaller 但没有 Uninstall section  
**解决**: 已移除 `WriteUninstaller` 调用，electron-builder 会自动处理

---

## 📁 相关文件

| 文件 | 说明 | 推荐使用 |
|------|------|----------|
| `build.ps1` | **PowerShell 原生脚本** | ⭐⭐⭐⭐⭐ (首选) |
| `build.bat` | CMD 批处理脚本 | ⭐⭐⭐ (仅 CMD 环境) |
| `package.json` | 主配置文件（含 electron-builder 配置） | - |
| `build/installer.nsh` | NSIS 自定义脚本（LZMA 压缩） | - |
| `build/after-pack.js` | UPX 后处理脚本（可选） | - |
| `BUILD_CONFIG.md` | 详细配置文档 | - |
| `build.md` | 完整构建指南 | - |

---

## 💡 最佳实践

### ✅ 推荐做法
- **使用 `build.ps1` 脚本一键打包**（强烈推荐）
- 使用 `"compression": "maximum"` 正式发布
- 开发阶段切换到快速构建模式
- 定期清理 `out/` 和 `dist/` 目录

### ❌ 避免做法
- **不要在 PowerShell 中运行 `build.bat`**
- 不要手动修改 `dist/` 目录内容
- 不要在打包过程中中断进程
- 不要在生产版本中包含开发调试文件

---

## 📈 性能指标

| 指标 | 目标值 | 当前状态 |
|------|--------|---------|
| 安装包体积 | < 90 MB | ✅ ~85 MB |
| 便携版体积 | < 100 MB | ✅ ~85 MB |
| 构建时间 | < 5 分钟 | ✅ 中等 |
| 安装时间 | < 30 秒 | ✅ 快速 |

---

## 🔍 脚本对比

| 特性 | build.ps1 (PowerShell) | build.bat (CMD) |
|------|----------------------|----------------|
| **兼容性** | PowerShell 7+ | Windows CMD |
| **彩色输出** | ✅ 支持 | ❌ 不支持 |
| **错误处理** | ✅ 强大 | ⚠️ 基础 |
| **文件大小计算** | ✅ 自动（MB） | ⚠️ 需要转换 |
| **进度显示** | ✅ 时间戳 | ✅ 时间戳 |
| **环境变量** | ✅ PowerShell 变量 | ⚠️ 批处理变量 |
| **推荐度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 📝 更新日志

### 2026-03-27 修复
- ✅ 修复 PowerShell 兼容性问题，创建 `build.ps1`
- ✅ 移除 NSIS 配置中不支持的 `compressor` 和 `solid` 属性
- ✅ 修复 ASAR `ordering` 配置导致的目录读取错误
- ✅ 修复 NSIS 脚本中 `WriteUninstaller` 使用错误
- ✅ 添加 portable 格式支持，同时生成安装包和便携版
- ✅ 禁用代码签名以避免符号链接权限问题

---

**最后更新**: 2026-03-27  
**维护者**: Github@GDWhisper
