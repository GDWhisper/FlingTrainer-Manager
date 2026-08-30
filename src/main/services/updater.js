// 应用内更新服务（全自研，不依赖 electron-updater）
// 设计要点：
// 1. 更新托管在 GitHub Releases，清单走 releases/latest/download/latest.yml 稳定直链
// 2. 下载必须用户可感知、可暂停/停止/重试：自研 Range 断点续传（.part 保留，跨重启可续传）
// 3. sha512 流式校验通过后 .part 才改名为安装包；安装仅在用户确认后静默 /S 执行
// 4. 便携 zip 版不支持应用内安装，引导用户前往 Releases 页手动下载

import { EventEmitter } from 'events';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import axios from 'axios';
import { load as loadYaml } from 'js-yaml';
import { UPDATE_CONFIG } from '../constants.js';
import { getAppDataDirectory } from '../utils/cache.js';

// 状态机：idle → checking → available / not-available → downloading ⇄ paused
//   → verifying → downloaded → installing；任意阶段可进入 error
const STATE = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  NOT_AVAILABLE: 'not-available',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  VERIFYING: 'verifying',
  DOWNLOADED: 'downloaded',
  INSTALLING: 'installing',
  ERROR: 'error',
};

// 中止标记：区分用户主动暂停/停止与真实网络错误
const ABORTED = 'UPD_ABORTED';

/**
 * 三段式版本号比较（x.y.z）
 * @returns {number} a > b 返回 1，a < b 返回 -1，相等返回 0
 */
function compareVersions(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

/**
 * 将 axios 错误转换为用户可读的提示
 */
function friendlyNetworkError(err) {
  const code = err?.code || '';
  if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return '网络连接超时或被重置，请检查网络后重试';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return '无法连接到 GitHub，请检查网络或代理设置';
  }
  if (code === 'ERR_CANCELED') {
    return '请求已取消';
  }
  return err?.message || '未知错误';
}

class UpdateService extends EventEmitter {
  constructor() {
    super();
    this.state = STATE.IDLE;
    this.errorMessage = '';
    this.manifest = null; // { latestVersion, releaseDate, fileName, sha512, fileSize, downloadUrl }
    this.progress = { percent: 0, downloadedSize: 0, fileSize: 0, speed: 0 };
    this._abortController = null;
    this._pauseRequested = false;
    this._cancelRequested = false;
    this._notifyTimer = null;
    this._stallTimer = null;
    this._isPortable = null; // 延迟探测并缓存
  }

  // ========== 状态与通知 ==========

  onStateChanged(callback) {
    this.on('state-changed', callback);
    return () => this.off('state-changed', callback);
  }

  _setState(state, errorMessage = '') {
    this.state = state;
    this.errorMessage = errorMessage;
    this._notify();
  }

  _notify() {
    this.emit('state-changed', this.getSnapshot());
  }

  /**
   * 状态快照（全部可序列化字段，直接推给渲染进程）
   */
  getSnapshot() {
    const fileSize = this.manifest?.fileSize || this.progress.fileSize || 0;
    const downloading = this.state === STATE.DOWNLOADING || this.state === STATE.VERIFYING;
    const partialSize = downloading ? this.progress.downloadedSize : this._partialSize();
    const doneSize = Math.min(partialSize, fileSize) || 0;
    const percent = fileSize > 0 ? Math.min(100, (doneSize / fileSize) * 100) : 0;
    return {
      currentVersion: app.getVersion(),
      latestVersion: this.manifest?.latestVersion || '',
      releaseDate: this.manifest?.releaseDate || '',
      fileName: this.manifest?.fileName || '',
      downloadUrl: this.manifest?.downloadUrl || '',
      releasePageUrl: UPDATE_CONFIG.RELEASES_PAGE_URL,
      state: this.state,
      errorMessage: this.errorMessage,
      isPortable: this.isPortable(),
      partialSize: partialSize,
      progress: {
        percent,
        downloadedSize: doneSize,
        fileSize,
        speed: downloading ? this.progress.speed : 0,
      },
    };
  }

  // ========== 路径与形态探测 ==========

  _updateDir() {
    const dir = path.join(getAppDataDirectory(), 'update');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  _partFile() {
    return path.join(this._updateDir(), `${this.manifest.fileName}.part`);
  }

  _finalFile() {
    return path.join(this._updateDir(), this.manifest.fileName);
  }

  _partialSize() {
    if (!this.manifest?.fileName) return 0;
    try {
      const partFile = this._partFile();
      return fs.existsSync(partFile) ? fs.statSync(partFile).size : 0;
    } catch {
      return 0;
    }
  }

  /**
   * 便携版判定：exe 旁没有 NSIS 卸载器即为便携 zip 版（不支持应用内安装）
   */
  isPortable() {
    if (this._isPortable === null) {
      try {
        if (!app.isPackaged) {
          this._isPortable = false; // 开发环境按安装版处理，便于调试完整流程
        } else {
          const exeDir = path.dirname(process.execPath);
          this._isPortable = !fs.existsSync(
            path.join(exeDir, UPDATE_CONFIG.UNINSTALLER_NAME)
          );
        }
      } catch {
        this._isPortable = false;
      }
    }
    return this._isPortable;
  }

  // ========== 检查更新 ==========

  async check() {
    if ([STATE.DOWNLOADING, STATE.PAUSED, STATE.VERIFYING, STATE.CHECKING].includes(this.state)) {
      return this.getSnapshot(); // 下载/校验进行中不允许并发检查
    }

    this._setState(STATE.CHECKING);
    const manifestUrl = `${UPDATE_CONFIG.GITHUB_BASE}/${UPDATE_CONFIG.GITHUB_OWNER}/${UPDATE_CONFIG.GITHUB_REPO}/releases/latest/download/latest.yml`;

    try {
      const response = await axios.get(manifestUrl, {
        timeout: UPDATE_CONFIG.CHECK_TIMEOUT,
        responseType: 'text',
        // 保持原始文本交给 js-yaml，避免 axios 默认 transform 干扰
        transformResponse: [(data) => data],
        headers: { Accept: '*/*' },
        maxRedirects: 5,
      });

      const raw = loadYaml(response.data);
      const latestVersion = String(raw?.version || '');
      const fileEntry = Array.isArray(raw?.files) ? raw.files[0] : null;
      const fileName = raw?.path || fileEntry?.url || '';
      const sha512 = raw?.sha512 || fileEntry?.sha512 || '';
      const fileSize = Number(fileEntry?.size || 0);

      if (!latestVersion || !fileName || !sha512) {
        throw new Error('更新清单格式异常');
      }

      this.manifest = {
        latestVersion,
        releaseDate: raw?.releaseDate || '',
        fileName,
        sha512,
        fileSize,
        downloadUrl: `${UPDATE_CONFIG.GITHUB_BASE}/${UPDATE_CONFIG.GITHUB_OWNER}/${UPDATE_CONFIG.GITHUB_REPO}/releases/latest/download/${encodeURIComponent(fileName)}`,
      };

      const hasUpdate = compareVersions(latestVersion, app.getVersion()) > 0;
      this._setState(hasUpdate ? STATE.AVAILABLE : STATE.NOT_AVAILABLE);
      return this.getSnapshot();
    } catch (err) {
      // 检查失败不覆盖已有清单状态：之前已发现更新时保持 available
      const keepAvailable = this.manifest && this.state !== STATE.CHECKING;
      this._setState(
        keepAvailable ? STATE.AVAILABLE : STATE.ERROR,
        keepAvailable ? '' : `检查更新失败：${friendlyNetworkError(err)}`
      );
      if (keepAvailable) return this.getSnapshot();
      throw new Error(this.errorMessage);
    }
  }

  // ========== 下载（可暂停/停止/续传） ==========

  startDownload() {
    if (this.state === STATE.DOWNLOADING || this.state === STATE.VERIFYING) {
      return { success: true, snapshot: this.getSnapshot() }; // 幂等
    }
    if (!this.manifest || ![STATE.AVAILABLE, STATE.PAUSED, STATE.ERROR].includes(this.state)) {
      return { success: false, error: '当前状态不允许开始下载，请先检查更新' };
    }

    this._setState(STATE.DOWNLOADING);
    this._runDownload().catch((err) => {
      console.error('更新下载流程异常:', err);
    });
    return { success: true, snapshot: this.getSnapshot() };
  }

  async _runDownload() {
    try {
      // 上次已下载完成但未安装（如重启后）：先快速校验，通过则直接进入可安装态
      const finalFile = this._finalFile();
      if (fs.existsSync(finalFile)) {
        this._setState(STATE.VERIFYING);
        if (await this._verifySha512(finalFile, this.manifest.sha512)) {
          this._setState(STATE.DOWNLOADED);
          return;
        }
        try { fs.unlinkSync(finalFile); } catch { /* 忽略 */ }
      }

      await this._downloadFile();

      // 下载完成 → 校验
      this._setState(STATE.VERIFYING);
      const partFile = this._partFile();
      if (await this._verifySha512(partFile, this.manifest.sha512)) {
        fs.renameSync(partFile, this._finalFile());
        this._setState(STATE.DOWNLOADED);
      } else {
        try { fs.unlinkSync(partFile); } catch { /* 忽略 */ }
        this._setState(STATE.ERROR, '安装包校验失败（sha512 不匹配），已删除损坏文件，请重试');
      }
    } catch (err) {
      if (err?.message === ABORTED) {
        if (this._pauseRequested) {
          this._pauseRequested = false;
          this._setState(STATE.PAUSED); // 保留 .part
        } else if (this._cancelRequested) {
          this._cancelRequested = false;
          try { fs.unlinkSync(this._partFile()); } catch { /* 忽略 */ }
          this._setState(STATE.AVAILABLE); // 回到可下载态
        }
      } else {
        // 真实错误：保留 .part 以便续传重试
        this._setState(STATE.ERROR, `下载失败：${friendlyNetworkError(err)}`);
      }
    }
  }

  async _downloadFile() {
    const partFile = this._partFile();
    let partialSize = this._partialSize();
    const fileSize = this.manifest.fileSize || 0;

    if (partialSize > fileSize && fileSize > 0) {
      // 残留 .part 比目标还大（清单变更等），直接作废重下
      try { fs.unlinkSync(partFile); } catch { /* 忽略 */ }
      partialSize = 0;
    }
    if (fileSize > 0 && partialSize === fileSize) {
      return; // 已下载完整（上次中断于改名前），直接进入校验
    }

    let resumed = partialSize > 0;
    // 302 落地端可能丢弃 Range，响应非 206 时需要从头重下，这里循环兜底
    for (;;) {
      const controller = new AbortController();
      this._abortController = controller;
      this.progress = {
        percent: 0,
        downloadedSize: partialSize,
        fileSize: fileSize || this.progress.fileSize,
        speed: 0,
      };

      const headers = {};
      if (resumed) headers.Range = `bytes=${partialSize}-`;

      let response;
      try {
        response = await axios.get(this.manifest.downloadUrl, {
          responseType: 'stream',
          decompress: false, // 二进制安装包按原始字节落盘，保证 Range 偏移与 sha512 可靠
          timeout: UPDATE_CONFIG.DOWNLOAD_TIMEOUT,
          maxRedirects: 5,
          signal: controller.signal,
          headers,
        });
      } catch (err) {
        if (controller.signal.aborted) throw new Error(ABORTED);
        throw err;
      }

      if (resumed && response.status !== 206) {
        // 服务器不支持续传：丢弃本次响应，从头下载
        response.data.destroy();
        partialSize = 0;
        resumed = false;
        controller.abort(); // 关闭本次请求连接
        fs.writeFileSync(partFile, ''); // 清空残留
        continue;
      }

      if (!this.progress.fileSize) {
        const contentLength = parseInt(response.headers['content-length'] || '0', 10);
        this.progress.fileSize = contentLength + partialSize;
      }

      await this._pipeResponse(controller, response, partFile, partialSize);
      return;
    }
  }

  /**
   * 接流写盘：进度/速度采样（500ms）、停滞看门狗、暂停/停止中止
   */
  _pipeResponse(controller, response, partFile, startSize) {
    return new Promise((resolve, reject) => {
      const stream = response.data;
      const writer = fs.createWriteStream(partFile, { flags: startSize > 0 ? 'a' : 'w' });

      let received = startSize;
      let lastSampleSize = startSize;
      let lastSampleTime = Date.now();
      const speedSamples = [];
      let settled = false;
      let stallTimer = null;
      let sourceEnded = false;

      // 唯一的收口：先终止数据流，再冲刷写入缓冲，等句柄关闭后返回，
      // 保证 .part 落盘尺寸与后续 stat 一致（暂停/续传的字节偏移依赖这一点）
      const settle = (err) => {
        if (settled) return;
        settled = true;
        if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
        if (!sourceEnded) stream.destroy();
        writer.end();
        writer.on('close', () => (err ? reject(err) : resolve()));
      };

      const restartStallWatchdog = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          settle(new Error(`下载停滞（${UPDATE_CONFIG.STALL_TIMEOUT / 1000} 秒未收到数据）`));
        }, UPDATE_CONFIG.STALL_TIMEOUT);
      };

      // 暂停/停止经由 controller.abort() 触达此监听
      controller.signal.addEventListener('abort', () => settle(new Error(ABORTED)));
      // 覆盖重连窗口期：接流前用户已请求暂停/停止（信号尚未作用于本次连接）
      if (controller.signal.aborted || this._pauseRequested || this._cancelRequested) {
        settle(new Error(ABORTED));
        return;
      }

      stream.on('data', (chunk) => {
        received += chunk.length;
        this.progress.downloadedSize = received;
        restartStallWatchdog();

        const now = Date.now();
        if (now - lastSampleTime >= 500) {
          const instantSpeed = (received - lastSampleSize) / ((now - lastSampleTime) / 1000);
          speedSamples.push(instantSpeed);
          if (speedSamples.length > 5) speedSamples.shift();
          this.progress.speed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
          lastSampleSize = received;
          lastSampleTime = now;

          const fileSize = this.progress.fileSize;
          if (fileSize > 0) {
            this.progress.percent = Math.min(100, (received / fileSize) * 100);
          }
          this._notify();
        }
      });

      stream.on('error', (err) => {
        // axios 的 signal 监听先于我们注册，abort 时它会抢先让流抛出 CanceledError；
        // 此时按用户意图（暂停/停止）转换为 ABORTED 标记，而不是当作网络错误
        const aborted = controller.signal.aborted || this._pauseRequested || this._cancelRequested;
        settle(aborted ? new Error(ABORTED) : err);
      });
      writer.on('error', (err) => settle(err));

      stream.on('end', () => {
        // 源流读取完毕，停止看门狗，等待写入缓冲冲刷完成
        sourceEnded = true;
        if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
        writer.end();
      });

      // 冲刷完成（finish）即下载成功
      writer.on('finish', () => settle(null));

      stream.pipe(writer);
      restartStallWatchdog();
    });
  }

  pauseDownload() {
    if (this.state !== STATE.DOWNLOADING) {
      return { success: false, error: '当前没有进行中的下载' };
    }
    this._pauseRequested = true;
    this._abortController?.abort();
    return { success: true };
  }

  cancelDownload() {
    if (this.state !== STATE.DOWNLOADING && this.state !== STATE.PAUSED) {
      return { success: false, error: '当前没有可停止的下载' };
    }
    if (this.state === STATE.PAUSED) {
      // 暂停态直接删除 .part 并回到可下载态
      try { fs.unlinkSync(this._partFile()); } catch { /* 忽略 */ }
      this._setState(STATE.AVAILABLE);
      return { success: true };
    }
    this._cancelRequested = true;
    this._abortController?.abort();
    return { success: true };
  }

  // ========== 校验与安装 ==========

  _verifySha512(filePath, expectedB64) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha512');
      const rs = fs.createReadStream(filePath);
      rs.on('data', (chunk) => hash.update(chunk));
      rs.on('error', reject);
      rs.on('end', () => resolve(hash.digest('base64') === expectedB64));
    });
  }

  startInstall() {
    if (this.state !== STATE.DOWNLOADED) {
      return { success: false, error: '安装包尚未就绪' };
    }
    if (this.isPortable()) {
      return { success: false, error: '便携版不支持应用内安装，请前往下载页手动更新' };
    }

    const installerPath = this._finalFile();

    this._setState(STATE.INSTALLING);
    try {
      const child = spawn(installerPath, ['/S'], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(installerPath),
      });
      // spawn 的失败（含安装包不存在）都是异步 error 事件，不会进入下面的 catch；
      // 不做 existsSync 预检查：杀软可能短暂锁住刚改名的安装包导致误判丢失
      child.on('error', (err) => {
        const msg =
          err?.code === 'ENOENT' ? '安装包丢失，请重新下载' : `启动安装器失败：${err.message}`;
        this._setState(STATE.ERROR, msg);
      });
      child.unref();
      // 给安装器拉起留一点时间，随后退出当前应用由安装器接管；
      // 若拉起已失败（状态回到 error）则不退出
      setTimeout(() => {
        if (this.state === STATE.INSTALLING) app.quit();
      }, 500);
      return { success: true };
    } catch (err) {
      this._setState(STATE.ERROR, `启动安装器失败：${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

// 导出单例（与 downloader.js 的 downloadManager 同风格）
export const updateService = new UpdateService();
