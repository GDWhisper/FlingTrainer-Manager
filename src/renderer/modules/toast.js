// 浮动提示

/**
 * 显示浮动提示
 * @param {string} message - 提示内容
 * @param {number} duration - 显示时长（毫秒），默认 4000
 */
export function showToast(message, duration = 4000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, duration);
}
