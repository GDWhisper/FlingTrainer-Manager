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
