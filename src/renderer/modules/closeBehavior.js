// 关闭行为询问模块
// 主进程在用户未设置过关闭方式时拦截关闭并发送事件，由此弹窗询问

import { showToast } from './toast.js';

let pending = null; // 弹窗已打开时的单例守卫（防 Alt+F4 连按重复弹出）

/**
 * 初始化：订阅主进程的关闭询问事件（静态订阅，窗口隐藏到托盘期间依然有效）
 */
export function initCloseBehavior() {
  if (typeof window.api === 'undefined' || !window.api.onCloseBehaviorConfirmRequested) return;

  const unsubscribe = window.api.onCloseBehaviorConfirmRequested(() => {
    askUser().catch((err) => console.error('关闭行为询问失败:', err));
  });

  window.addEventListener('beforeunload', () => {
    unsubscribe();
  });
}

async function askUser() {
  if (pending) return pending;
  pending = showCloseBehaviorDialog();
  try {
    const { action, remember } = await pending;
    if (!action) return; // 取消：什么都不做

    if (remember) {
      try {
        const result = await window.api.saveSettings({ minimizeToTray: action === 'tray' });
        if (result.success) {
          const checkbox = document.getElementById('minimize-to-tray');
          if (checkbox) checkbox.checked = action === 'tray';
        } else {
          showToast('保存设置失败：' + (result.error || '未知错误'));
        }
      } catch (err) {
        console.error('保存关闭行为设置失败:', err);
        showToast('保存设置失败');
      }
    }

    if (action === 'tray') {
      await window.api.minimizeToTray();
    } else {
      await window.api.quitApp();
    }
  } finally {
    pending = null;
  }
}

/**
 * 弹出关闭行为询问对话框
 * @returns {Promise<{ action: 'tray'|'quit'|null, remember: boolean }>} action 为 null 表示取消
 */
function showCloseBehaviorDialog() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('close-behavior-dialog-overlay');
    const rememberEl = document.getElementById('close-behavior-remember');
    const cancelBtn = document.getElementById('close-behavior-cancel');
    const quitBtn = document.getElementById('close-behavior-quit');
    const trayBtn = document.getElementById('close-behavior-tray');

    if (rememberEl) rememberEl.checked = false;
    if (overlay) overlay.classList.remove('hidden');

    const cleanup = () => {
      if (overlay) overlay.classList.add('hidden');
      if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
      if (quitBtn) quitBtn.removeEventListener('click', handleQuit);
      if (trayBtn) trayBtn.removeEventListener('click', handleTray);
    };

    const handleCancel = () => {
      cleanup();
      resolve({ action: null, remember: false });
    };
    const handleQuit = () => {
      cleanup();
      resolve({ action: 'quit', remember: rememberEl ? rememberEl.checked : false });
    };
    const handleTray = () => {
      cleanup();
      resolve({ action: 'tray', remember: rememberEl ? rememberEl.checked : false });
    };

    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    if (quitBtn) quitBtn.addEventListener('click', handleQuit);
    if (trayBtn) trayBtn.addEventListener('click', handleTray);
  });
}
