// 设置模块

import { showToast } from './toast.js';

/**
 * 初始化设置页面
 */
export async function initSettings() {
  const folderInput = document.getElementById('download-folder');
  const folderBtn = document.getElementById('select-folder-btn');
  const openFolderBtn = document.getElementById('open-folder-btn');

  if (!folderInput || !folderBtn) return;

  // 加载已保存的设置
  try {
    if (typeof window.api !== 'undefined') {
      const settings = await window.api.loadSettings();
      if (settings.downloadFolder) {
        folderInput.value = settings.downloadFolder;
      }
    }
  } catch (err) {
    console.error('加载设置失败:', err);
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
