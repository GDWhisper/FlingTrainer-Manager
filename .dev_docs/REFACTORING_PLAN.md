# 风灵月影宗 - 总体重构方案

> **文档版本**: 1.0.0  
> **创建日期**: 2026-07-16  
> **适用范围**: v0.3.0 → v1.0.0  
> **基于**: `.dev_docs/INITIAL_ANALYSIS.md` 及完整代码分析

---

## 📋 一、重构目标

### 1.1 核心目标
1. **提升可维护性** - 降低代码复杂度,提高开发效率
2. **增强稳定性** - 统一错误处理,减少线上问题
3. **改善用户体验** - 现代化 UI,流畅交互
4. **扩展功能边界** - 为未来迭代奠定基础

### 1.2 量化指标
| 指标 | 当前 (v0.3.0) | 目标 (v1.0.0) |
|------|--------------|--------------|
| 代码可维护性评分 | 6/10 | 9/10 |
| 单元测试覆盖率 | 0% | >80% (核心模块) |
| 冷启动时间 | ~3s | <2s |
| 内存占用 | ~500MB | <300MB |
| 错误处理覆盖率 | ~70% | 100% |
| 技术债务 | 中高 | 低 |

### 1.3 重构原则
1. **渐进式重构** - 不破坏现有功能,边迭代边优化
2. **向后兼容** - 保持配置文件、缓存格式兼容
3. **小步快跑** - 每个阶段 2-4 周,快速验证
4. **风险可控** - 每个阶段都有回滚方案

---

## 🎯 二、当前架构诊断

### 2.1 架构图

┌─────────────────────────────────────────┐
│         Electron Main Process           │
│  ┌───────────────────────────────────┐  │
│  │   Entry: main/index.js            │  │
│  └───────────────────────────────────┘  │
│              ↓                          │
│  ┌───────────────────────────────────┐  │
│  │   IPC Layer (6 handlers)          │  │
│  │   ipc/index.js → 集中注册         │  │
│  └───────────────────────────────────┘  │
│              ↓                          │
│  ┌───────────────────────────────────┐  │
│  │   Service Layer (3 services)      │  │
│  │   - crawler.js (爬虫)             │  │
│  │   - downloader.js (下载)          │  │
│  │   - downloaded-games-icons.js     │  │
│  └───────────────────────────────────┘  │
│              ↓                          │
│  ┌───────────────────────────────────┐  │
│  │   Utils Layer (3 utilities)       │  │
│  │   - cache.js (缓存)               │  │
│  │   - http.js (HTTP 客户端)         │  │
│  │   - requestLimiter.js (限流)      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              ↓ ↑ IPC
┌─────────────────────────────────────────┐
│      Electron Renderer Process          │
│  ┌───────────────────────────────────┐  │
│  │   Entry: renderer/index.js        │  │
│  └───────────────────────────────────┘  │
│              ↓                          │
#### 1.2 配置管理系统

**实施步骤:**

**Step 1: 创建配置管理器**
**方向**: 创建统一的配置管理类，集中管理所有应用配置项，包括默认配置、加载/保存逻辑、配置热更新支持。配置文件应存储在统一的应用数据目录，避免硬编码路径。javascript
// src/main/utils/config.js

import path from 'path';
import fs from 'fs';
**Step 2: 统一配置访问**

**方向**: 重构 settings.js 和相关模块，统一通过配置管理器访问配置项，消除硬编码路径。
import { getAppDataPath } from './cache.js';

class ConfigManager {
  constructor() {
    this.configDir = getAppDataPath();
    this.configFile = path.join(this.configDir, 'config.json');
    this.defaults = {
      downloadFolder: '',
      maxConcurrentDownloads: 3,
      cacheEnabled: true,
      autoCheckUpdates: true,
      theme: 'auto'
    };
**验收标准:**
- [ ] 所有配置统一管理
- [ ] 支持配置热更新
- [ ] 配置文件路径单一来源

---
**方向**: 设计窗口级生命周期管理机制，确保每个窗口的资源（如定时器、事件监听器）在窗口关闭时自动清理，防止内存泄漏。

#### 1.3 内存泄漏修复

**问题分析:**
javascript
// ❌ 当前问题
ipcMain.handle('start-download-listener', async (event) => {
  statusListenerInterval = setInterval(() => {
    event.sender.send('download-status-changed', { tasks });
**方向**: 增强爬虫解析的健壮性，包括：
1. 添加解析结果校验层，确保数据结构完整
2. 实现多级降级策略，主选择器失效时尝试备用选择器
3. 添加解析失败的优雅降级和错误提示
  }, 1000);
});
// 渲染进程崩溃时,interval 不会自动清理


**解决方案:**
javascript
// ✅ 改进方案
class DownloadStatusBroadcaster {
**验收标准:**
- [ ] 页面结构变化时优雅降级
- [ ] 解析失败有明确错误提示
- [ ] 添加解析结果单元测试

---

### Phase 2: 代码质量提升 (3-4 周)

#### 目标
引入 TypeScript,建立测试体系,提升代码可维护性。

#### 2.1 TypeScript 迁移

**迁移策略: 渐进式迁移**

**方向**: 
1. 初始化 TypeScript 配置，启用严格模式，允许 JS/TS 混合存在
2. 定义核心类型接口（Game、DownloadTask、Settings 等）
3. 按优先级渐进式迁移：types → utils → services → ipc → renderer
4. 保留 JS 兼容层，不强制一次性全部迁移
**Step 1: 初始化 TypeScript**
json
// tsconfig.json
**Step 2: 定义核心类型**

**方向**: 创建类型定义文件，定义核心数据结构接口，如 Game、DownloadTask、Settings、CacheData 等。
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./out",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "allowJs": true,      // 允许 JS 文件
    "checkJs": false       // 不强制检查 JS
  },
**迁移优先级**:
1. types/（类型定义）
2. utils/（工具函数 - 无依赖）
3. services/（业务逻辑）
4. ipc/（IPC handlers）
5. renderer/modules/（前端模块）
**Step 3: 按模块迁移**

优先级:
1. types/ (类型定义)
2. utils/ (工具函数 - 无依赖)
3. services/ (业务逻辑)
4. ipc/ (IPC handlers)
5. renderer/modules/ (前端模块)


**验收标准:**
- [ ] 核心模块 100% TypeScript
- [ ] 无类型错误
**方向**: 
1. 配置 Vitest 测试框架，设置覆盖率报告
2. 为核心模块（crawler、downloader、cache、http）编写单元测试
3. 建立测试覆盖率目标：核心模块 >80%
4. 配置 CI 自动运行测试
- [ ] 保留部分 JS 文件作为过渡

---

#### 2.2 测试体系建立

**Step 1: 配置 Vitest**
javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'out/']
    }
  }
});

**验收标准:**
- [ ] 测试覆盖率 > 80% (核心模块)
- [ ] CI 自动运行测试
- [ ] 测试运行时间 < 30s

---

#### 2.3 结构化日志系统

**实施方案:**
javascript
// src/main/utils/logger.js
import winston from 'winston';
import path from 'path';
import { getAppDataPath } from './cache.js';

const logDir = path.join(getAppDataPath(), 'logs');

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
**验收标准:**
- [ ] 所有日志结构化输出
- [ ] 日志文件自动轮转
- [ ] 开发/生产环境差异化配置

---

### Phase 3: UI/UX 现代化 (3-4 周)

#### 目标
现代化用户界面,提升用户体验。

#### 3.1 CSS 架构重构

**Step 1: 引入 CSS Variables 主题系统**
css
/* src/renderer/styles/variables.css */

:root {
  /* 颜色系统 */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-bg: #ffffff;
  --color-bg-secondary: #f3f4f6;
  --color-text: #1f2937;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;
  
  /* 间距系统 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
**验收标准:**
- [ ] 启动时自动检查更新
- [ ] 下载进度实时显示
- [ ] 更新完成后一键安装

---

### Phase 4: 功能增强 (4-6 周)

#### 目标
添加高级功能,提升产品竞争力。

#### 4.1 数据持久化升级

**实施方案:**
javascript
// src/main/database/index.js
import Database from 'better-sqlite3';
import path from 'path';
import { getAppDataPath } from '../utils/cache.js';

class Database {
  constructor() {
    const dbPath = path.join(getAppDataPath(), 'app.db');
    this.db = new Database(dbPath);
---

### Phase 5: 长期优化 (持续)

#### 目标
性能优化与功能扩展。

#### 5.1 启动速度优化

**实施方案:**
javascript
// 延迟加载非关键模块
const modules = {
  games: () => import('./modules/games.js'),
  downloads: () => import('./modules/downloads.js'),
  settings: () => import('./modules/settings.js')
};

// 按需加载
document.addEventListener('DOMContentLoaded', async () => {
  await modules.games(); // 首屏关键路径
  modules.downloads();   // 后台加载
});


### 8.1 每个阶段的通用标准
- [ ] 代码 Review 通过
- [ ] 单元测试覆盖达标
- [ ] 手动测试通过
- [ ] 性能不劣化
- [ ] 文档更新完整

### 8.2 v1.0.0 发布标准
- [ ] Phase 1-4 全部完成
- [ ] 单元测试覆盖率 > 80%
- [ ] 无 P0/P1 级别 bug
- [ ] 性能指标达标 (启动 <2s, 内存 <300MB)
- [ ] 用户文档完整
- [ ] CI/CD 流水线稳定

---

## 🔄 九、回滚策略

### 9.1 阶段级回滚
每个阶段完成后再进入下一阶段,保留上一阶段的 git tag。

bash
# 如果 Phase 2 出现问题
git checkout v1.0.0-phase1-complete


### 9.2 功能开关
javascript
// 新功能通过配置开关控制
if (configManager.get('enableNewFeature')) {
  // 新逻辑
} else {
  // 旧逻辑
}


### 9.3 数据备份
javascript
// 每次启动自动备份
setInterval(() => {
  backupDatabase();
}, 24 * 60 * 60 * 1000); // 每 24 小时


---

## 📚 十、文档要求

### 10.1 代码文档
- [ ] JSDoc/TSDoc 注释覆盖率 100%
- [ ] 复杂逻辑添加注释
- [ ] README 保持更新

### 10.2 架构文档
- [ ] 架构图更新
- [ ] 数据流图更新
- [ ] API 文档 (IPC channels)

### 10.3 用户文档
- [ ] 更新日志 (CHANGELOG)
- [ ] 用户手册
- [ ] 常见问题 FAQ

---

## 🎯 十一、下一步行动

### 立即执行 (本周)
1. ✅ **Review 本方案** - 团队对齐目标
2. ✅ **创建重构分支** - `git checkout -b refactor/phase1`
3. ✅ **建立 CI/CD** - 按 Phase 0 任务执行

### 短期执行 (2周内)
1. 统一错误处理系统
2. 配置管理重构
3. 内存泄漏修复

### 中期执行 (1-2月)
1. TypeScript 迁移
2. 测试体系建立
3. UI 现代化

---

## 📖 附录

### A. 参考文档
- `INITIAL_ANALYSIS.md` - 初步分析方案
- `docs/ROADMAP.md` - 路线图
- `build.md` - 构建与打包指南

### B. 技术选型清单

| 用途 | 当前方案 | 建议方案 | 理由 |
|------|---------|---------|------|
| 类型系统 | 纯 JS | TypeScript | 类型安全,可维护性 |
| 测试框架 | 无 | Vitest | 快速,兼容 Vite |
| 日志 | console.log | Winston | 结构化,可配置 |
| 数据库 | JSON 文件 | better-sqlite3 | 性能,可靠性 |
| UI 状态 | 手动 DOM | Preact Signals | 轻量,响应式 |
| 自动更新 | 无 | electron-updater | 官方推荐 |

### C. 关键指标监控

建议建立性能监控体系，跟踪以下关键指标：
- 启动时间
- 内存占用
- 错误率
- 下载成功率

可考虑集成第三方监控服务（如 Sentry）或自建监控系统。

---

**文档结束**

**下一步**: 等待团队反馈,调整方案后进入 Phase 0 执行。
