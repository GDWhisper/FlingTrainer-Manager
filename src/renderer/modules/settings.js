// 设置模块

import { showToast } from './toast.js';

/**
 * 初始化设置页面
 */
export async function initSettings() {
  const folderInput = document.getElementById('download-folder');
  const folderBtn = document.getElementById('select-folder-btn');
  const openFolderBtn = document.getElementById('open-folder-btn');
  const autoCheckUpdateEl = document.getElementById('auto-check-update');

  if (!folderInput || !folderBtn) return;

  // 加载已保存的设置（保留完整对象，保存时整体回写避免覆盖丢失其它键）
  let settings = {};
  try {
    if (typeof window.api !== 'undefined') {
      settings = await window.api.loadSettings();
      if (settings.downloadFolder) {
        folderInput.value = settings.downloadFolder;
      }
    }
  } catch (err) {
    console.error('加载设置失败:', err);
  }

  // 自动检查更新开关（默认开启；save-settings 是整文件覆盖，必须合并保存）
  if (autoCheckUpdateEl) {
    autoCheckUpdateEl.checked = settings.autoCheckUpdate !== false;
    autoCheckUpdateEl.addEventListener('change', async () => {
      try {
        if (typeof window.api === 'undefined') return;
        const merged = { ...settings, autoCheckUpdate: autoCheckUpdateEl.checked };
        const result = await window.api.saveSettings(merged);
        if (result.success) {
          settings = merged;
          showToast(autoCheckUpdateEl.checked ? '已开启启动时自动检查更新' : '已关闭启动时自动检查更新');
        } else {
          showToast('保存设置失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('保存自动检查更新设置失败:', err);
        showToast('保存设置失败');
      }
    });
  }

  // 关闭时最小化到托盘开关（键不存在 = 未设置过，关闭时会弹窗询问；勾选/取消后视为已主动设置）
  const minimizeToTrayEl = document.getElementById('minimize-to-tray');
  if (minimizeToTrayEl) {
    minimizeToTrayEl.checked = settings.minimizeToTray === true;
    minimizeToTrayEl.addEventListener('change', async () => {
      try {
        if (typeof window.api === 'undefined') return;
        const result = await window.api.saveSettings({ minimizeToTray: minimizeToTrayEl.checked });
        if (result.success) {
          showToast(minimizeToTrayEl.checked ? '已开启关闭时最小化到托盘' : '已关闭「关闭时最小化到托盘」');
        } else {
          showToast('保存设置失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('保存托盘设置失败:', err);
        showToast('保存设置失败');
      }
    });
  }

  // 开机自启开关（默认关闭；走专用 IPC 同步系统登录项，dev 下仅存设置不写注册表）
  const launchAtStartupEl = document.getElementById('launch-at-startup');
  if (launchAtStartupEl) {
    launchAtStartupEl.checked = settings.launchAtStartup === true;
    launchAtStartupEl.addEventListener('change', async () => {
      try {
        if (typeof window.api === 'undefined') return;
        const result = await window.api.setLaunchAtStartup(launchAtStartupEl.checked);
        if (result.success) {
          settings = { ...settings, launchAtStartup: launchAtStartupEl.checked };
          showToast(launchAtStartupEl.checked ? '已开启开机自动启动' : '已关闭开机自动启动');
        } else {
          launchAtStartupEl.checked = !launchAtStartupEl.checked;
          showToast('设置开机自启失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('设置开机自启失败:', err);
        launchAtStartupEl.checked = !launchAtStartupEl.checked;
        showToast('设置开机自启失败');
      }
    });
  }

  // 选择文件夹按钮 - 选择后自动保存
  folderBtn.addEventListener('click', async () => {
    try {
      if (typeof window.api === 'undefined') return;
      const folder = await window.api.selectFolder();
      if (folder) {
        folderInput.value = folder;
        // 自动保存设置
        await window.api.saveSettings({ downloadFolder: folder });
        showToast('下载文件夹已更新');
      }
    } catch (err) {
      console.error('选择文件夹失败:', err);
      showToast('选择文件夹失败');
    }
  });

  // 打开文件夹按钮
  if (openFolderBtn) {
    openFolderBtn.addEventListener('click', async () => {
      const downloadFolder = folderInput.value.trim();
      if (!downloadFolder) {
        showToast('请先选择下载文件夹');
        return;
      }

      try {
        if (typeof window.api === 'undefined') return;
        await window.api.openFolder(downloadFolder);
      } catch (err) {
        console.error('打开文件夹失败:', err);
        showToast('打开文件夹失败');
      }
    });
  }
}
