// 开机自启服务：Windows 下经 app.setLoginItemSettings 写 HKCU Run 注册表项实现。
// 设置开关的用户意图存 settings.json（launchAtStartup），注册表为落地结果。

import { app } from 'electron';

/**
 * 将开机自启设置落地到系统登录项。
 * dev 环境跳过：execPath 是 electron.exe，注册到登录项无意义（语义与 updater 一致）。
 */
export function applyAutoStart(enabled) {
  if (app.isPackaged === false) return;
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    path: process.execPath,
  });
}

/**
 * 启动时自愈：设置开启但注册表项已失效（便携版挪动目录后路径过期）时重写。
 * 用户已在任务管理器手动关闭（openAtLogin=false）时不越权重开，尊重用户操作。
 * @param {object} settings - 启动时已加载的设置对象
 */
export function repairAutoStart(settings) {
  if (!settings || settings.launchAtStartup !== true || app.isPackaged === false) return;
  try {
    const state = app.getLoginItemSettings();
    if (state.openAtLogin && !state.executableWillLaunchAtLogin) {
      applyAutoStart(true);
    }
  } catch (err) {
    console.warn('开机自启状态自愈失败:', err);
  }
}
