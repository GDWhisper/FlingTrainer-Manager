// 日间/夜间主题切换
// 交互：短按 → 手动切换并记住偏好；长按 → 清除偏好回到"跟随系统"（带充能特效）。
// 跟随系统：系统开夜间模式则深色，否则日光模式，系统切换时实时跟随。
// index.html 头部的内联脚本在样式应用前用同样规则先设一次，避免启动闪烁。

import { showToast } from './toast.js';

const THEME_KEY = 'app-theme';
const HOLD_MS = 900; // 长按判定时长，与充能动画时长保持一致
const THEME_NAMES = { dark: '夜间模式', light: '日光模式' };

/**
 * 获取当前主题（'dark' | 'light'）
 */
export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/**
 * 是否处于"跟随系统"（用户未手动选择过）
 */
function isFollowingSystem() {
  return !localStorage.getItem(THEME_KEY);
}

/**
 * 更新切换按钮的悬浮提示文案
 */
function updateToggleTip(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const other = THEME_NAMES[theme === 'dark' ? 'light' : 'dark'];
  const action = btn.querySelector('.tip-action');
  const hint = btn.querySelector('.tip-hint');
  if (isFollowingSystem()) {
    if (action) action.textContent = `已跟随系统 · ${THEME_NAMES[theme]}`;
    if (hint) hint.textContent = `点击切换到${other}`;
  } else {
    if (action) action.textContent = `切换到${other}`;
    if (hint) hint.textContent = '长按切换到跟随系统';
  }
}

/**
 * 应用主题
 * @param {'dark' | 'light'} theme
 * @param {boolean} persist - 是否写入用户偏好（跟随系统时为 false）
 */
export function applyTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem(THEME_KEY, theme);
  updateToggleTip(theme);
}

/**
 * 初始化主题切换按钮
 */
export function initThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  const followSystem = (notify = false) => {
    if (!isFollowingSystem()) return;
    applyTheme(systemDark.matches ? 'dark' : 'light', false);
    if (notify) showToast(`已跟随系统 · 当前为${THEME_NAMES[getTheme()]}`);
  };

  if (btn) {
    let holdTimer = null;
    let longPressed = false;

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      longPressed = false;
      btn.classList.remove('charge-done');
      btn.classList.add('charging');
      holdTimer = setTimeout(() => {
        longPressed = true;
        btn.classList.remove('charging');
        btn.classList.add('charge-done'); // 充能完成闪光
        setTimeout(() => btn.classList.remove('charge-done'), 450);
        localStorage.removeItem(THEME_KEY);
        followSystem(true);
      }, HOLD_MS);
    });

    const cancelCharge = () => {
      clearTimeout(holdTimer);
      btn.classList.remove('charging');
    };
    btn.addEventListener('pointerup', cancelCharge);
    btn.addEventListener('pointerleave', cancelCharge);
    btn.addEventListener('pointercancel', cancelCharge);

    btn.addEventListener('click', () => {
      if (longPressed) {
        longPressed = false; // 长按已生效，吞掉随之而来的 click
        return;
      }
      // 点击即视为用户偏好，此后不再跟随系统
      applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  followSystem();
  systemDark.addEventListener('change', () => followSystem());
}
