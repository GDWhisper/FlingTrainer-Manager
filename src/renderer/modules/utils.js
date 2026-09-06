// 工具函数（纯函数，无副作用）

/**
 * 获取默认图片路径
 */
export function getDefaultImage() {
  return import.meta.env.DEV ? '/pic/default.png' : './pic/default.png';
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期
 */
export function formatDate(date) {
  return new Date(date).toLocaleString('zh-CN');
}

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML 转义（防止 XSS）。引号必须转义：textContent→innerHTML 只转义 & < >，
 * 模板里大量 data-x="${escapeHtml(...)}" 属性插值，漏引号即可被注入任意属性。
 */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}
