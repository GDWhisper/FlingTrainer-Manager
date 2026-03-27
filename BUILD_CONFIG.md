# Build Configuration Guide - 风灵月影宗

## 📦 打包配置说明

本项目已针对 Windows x64 平台进行了深度优化，使用 electron-builder 进行高效打包。

### 应用信息

- **产品名称**: 风灵月影宗
- **应用 ID**: `com.gdw.flingtrainermanager`
- **当前版本**: 0.3.0
- **目标平台**: Windows x64
- **安装包类型**: NSIS (支持自定义安装路径)
- **便携版本**: 独立可执行文件

---

## 🚀 体积优化策略

### 1. ASAR 智能打包

```json
{
  "asar": {
    "smartUnpack": true,      // 自动解包二进制文件
    "ordering": "src"         // 优化文件加载顺序
  }
}
```

**优势**:
- 保护源码安全
- 减少文件数量，提升读取速度
- 智能处理需要直接访问的二进制文件

### 2. 压缩配置

#### 全局压缩
```json
{
  "compression": "maximum"    // 最高级别压缩
}
```

#### NSIS 压缩
```json
{
  "nsis": {
    "compressor": "lzma",     // LZMA 算法（高压缩率）
    "solid": true,            // 固实压缩
    "unicode": true           // Unicode 支持
  }
}
```

**压缩算法对比**:
| 算法 | 压缩率 | 解压速度 | 适用场景 |
|------|--------|----------|----------|
| LZMA | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 网络分发（推荐） |
| ZLIB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 快速安装 |

### 3. 文件排除规则

electron-builder 自动排除以下文件（无需手动配置）：
- `.git/`, `.svn/`, `.hg/` - 版本控制目录
- `node_modules/` 中的开发依赖（通过 `package.json.dependencies` 识别）
- `test/`, `tests/`, `spec/` - 测试目录
- `*.md`, `*.txt` - 文档文件（LICENSE 除外）
- `.map` - 源码映射文件
- `.npmrc`, `.editorconfig` - 配置文件

### 4. 进一步优化的建议

如果追求极致体积，可以考虑：

#### a) 使用 UPX 压缩可执行文件
在 `package.json` 中添加 `afterPack` 钩子：

```json
{
  "build": {
    "afterPack": "build/after-pack.js"
  }
}
```

创建 `build/after-pack.js`:
```javascript
const { exec } = require('child_process');
const path = require('path');

module.exports = async function(context) {
  if (context.electronPlatformName === 'win32') {
    const exePath = path.join(context.appOutDir, '风灵月影宗.exe');
    return new Promise((resolve) => {
      exec(`upx --best "${exePath}"`, (error) => {
        if (error) console.log('UPX compression skipped:', error.message);
        resolve();
      });
    });
  }
};
```

#### b) 移除不需要的 Electron 模块
⚠️ **高级操作，可能导致功能异常**

使用 `electron-rebuild` 和自定义构建脚本剔除未使用的原生模块。

#### c) 调整压缩级别
如需更快的构建速度，修改为：
```json
{
  "compression": "normal",
  "nsis": {
    "compressor": "zlib",
    "solid": false
  }
}
```

---

## 🛠️ 构建脚本说明

### build.bat (PowerShell 兼容版)

**特性**:
- ✅ 纯英文输出，避免编码冲突
- ✅ 自动环境检查（Node.js、npm、磁盘空间）
- ✅ 详细的进度提示和时间戳
- ✅ 构建统计信息（文件大小、生成时间）
- ✅ 完整的错误诊断和解决方案提示

**使用方法**:
```powershell
# 方式 1: 双击运行 build.bat
# 方式 2: 在 PowerShell 中执行
.\build.bat
```

**输出示例**:
```
==========================================
  FlingTrainer Manager Build Script
  PowerShell Compatible Version
==========================================

[INFO] Checking disk space...
[INFO] Drive: E:
[INFO] Disk space check completed

[INFO] Checking Node.js installation...
[OK] Node.js is installed
[VERSION] Node.js: v20.11.0

[INFO] Checking npm installation...
[OK] npm is installed
[VERSION] npm: 10.2.4

[INFO] Loading project version...
[VERSION] Application Version: 0.3.0
[VERSION] Product Name: 风灵月影宗

==========================================
  Build Configuration
==========================================
[CONFIG] Mode: Production
[CONFIG] Output: out/
[CONFIG] Package: dist/
[CONFIG] Platform: Windows x64
[CONFIG] Installer: NSIS
[CONFIG] Portable: Enabled
==========================================

Step 1/2: Building production resources
[BUILD] Starting electron-vite build...
[TIME] Start time: 14:35:22.45
...
[OK] Build completed successfully

Step 2/2: Packaging application
[PACKAGE] Starting electron-builder...
...
[OK] Packaging completed successfully

==========================================
  BUILD COMPLETED SUCCESSFULLY
==========================================

[OUTPUT] Files located in: dist/

[FILES] Generated files:
风灵月影宗 Setup 0.3.0.exe
风灵月影宗-0.3.0-Portable.exe

[SIZE] File sizes:
风灵月影宗 Setup 0.3.0.exe: 85 MB
风灵月影宗-0.3.0-Portable.exe: 92 MB

[SUMMARY] Application: 风灵月影宗 v0.3.0
[SUMMARY] App ID: com.gdw.flingtrainermanager
[SUMMARY] Platform: Windows x64
[SUMMARY] Package Type: NSIS Installer + Portable
```

---

## 📊 预期产物

打包完成后，在 `dist/` 目录下生成：

### 1. 风灵月影宗 Setup 0.3.0.exe
- **类型**: NSIS 安装包
- **特点**: 
  - 支持自定义安装路径
  - 创建桌面快捷方式
  - 创建开始菜单文件夹
  - 包含卸载程序
- **大小**: ~80-90 MB（取决于实际内容）
- **适用场景**: 正式分发、用户安装

### 2. 风灵月影宗-0.3.0-Portable.exe
- **类型**: 便携版可执行文件
- **特点**:
  - 无需安装，双击运行
  - 所有数据存储在本地
  - 适合 U 盘携带
- **大小**: ~90-100 MB
- **适用场景**: 临时使用、多设备携带

---

## 🔧 手动构建命令

如果不使用脚本，可以手动执行：

```powershell
# 1. 安装依赖（首次）
npm install

# 2. 构建生产资源
npm run build

# 3. 打包应用程序
npm run dist

# 或一步完成（构建 + 打包）
npm run dist
```

---

## ❓ 常见问题

### Q1: 打包时提示"无法创建符号链接"

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

### Q2: 安装包体积过大

**优化建议**:
1. 检查是否包含了不必要的大文件
2. 确认 `out/` 目录中没有开发调试文件
3. 考虑使用 UPX 压缩（见上方"进一步优化建议"）
4. 如果使用了很多大型依赖，考虑按需加载

### Q3: 构建速度过慢

**加速方案**:
1. **使用 SSD 硬盘**: 显著提升读写速度
2. **增加内存**: 建议 16GB+
3. **调整压缩级别**: 
   ```json
   {
     "compression": "normal",
     "nsis": {
       "solid": false
     }
   }
   ```
4. **排除更多文件**: 在 `package.json.build.files` 中添加排除规则

### Q4: 杀毒软件误报

**原因**: electron-builder 打包的可执行文件可能被误判

**解决方案**:
1. 向杀毒软件添加白名单
2. 考虑对安装包进行数字签名（需要购买证书）
3. 在 `package.json` 中添加：
   ```json
   {
     "build": {
       "win": {
         "requestedExecutionLevel": "asInvoker"
       }
     }
   }
   ```

---

## 📈 性能与体积对比

| 配置方案 | 安装包大小 | 便携版大小 | 构建时间 | 安装时间 |
|---------|-----------|-----------|---------|---------|
| 默认配置 | ~95 MB | ~105 MB | 快 | 快 |
| **当前优化** | **~85 MB** | **~92 MB** | **中等** | **中等** |
| 极速构建 | ~92 MB | ~100 MB | 很快 | 很快 |
| UPX+LZMA | ~75 MB | ~82 MB | 慢 | 中等 |

*注：以上数据仅供参考，实际大小取决于项目内容和依赖*

---

## 📝 最佳实践建议

### 开发阶段
```json
// 使用快速构建配置
{
  "compression": "normal",
  "nsis": {
    "compressor": "zlib",
    "solid": false
  }
}
```

### 发布阶段
```json
// 使用最大压缩配置（当前默认）
{
  "compression": "maximum",
  "nsis": {
    "compressor": "lzma",
    "solid": true
  }
}
```

### 网络分发优化
- 启用差分更新：`"nsis.differentialPackage": true`
- 使用 CDN 托管安装包
- 提供 BT 种子（对于大文件）

---

## 🎯 总结

当前配置已在**体积**、**性能**和**兼容性**之间取得平衡：

✅ **已启用的优化**:
- ASAR 智能打包
- LZMA 最大压缩
- 固实压缩（Solid Compression）
- 自动排除开发依赖
- Unicode 支持
- 差分更新支持

✅ **兼容性保证**:
- Windows 10/11 完全兼容
- 支持 64 位系统
- 支持中文路径
- 支持自定义安装

✅ **用户体验**:
- 桌面快捷方式
- 开始菜单文件夹
- 友好的卸载程序
- 安装路径可选

---

**作者**: Github@GDWhisper  
**许可证**: GPL v3  
**更新日期**: 2026-03-27
