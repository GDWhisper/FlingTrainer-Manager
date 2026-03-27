// 请求限制器 - 用于防止过度调用目标网站

import fs from 'fs';
import path from 'path';
import { getCacheDir } from './cache.js';
import { REQUEST_LIMITS } from '../constants.js';

let requestStats = {
  date: null,
  refreshRequests: 0,
};

/**
 * 加载请求统计数据
 */
function loadStats() {
  const statsFile = path.join(getCacheDir(''), 'request-stats.json');
  const today = new Date().toDateString();
  
  try {
    if (fs.existsSync(statsFile)) {
      const data = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
      // 如果是同一天，则使用现有数据
      if (data.date === today) {
        requestStats = data;
        return;
      }
    }
  } catch (err) {
    console.warn('加载请求统计失败:', err.message);
  }
  
  // 新的一天或文件不存在，重置统计
  requestStats = {
    date: today,
    refreshRequests: 0,
  };
}

/**
 * 保存请求统计数据
 */
function saveStats() {
  try {
    const statsFile = path.join(getCacheDir(''), 'request-stats.json');
    fs.writeFileSync(statsFile, JSON.stringify(requestStats, null, 2), 'utf-8');
  } catch (err) {
    console.warn('保存请求统计失败:', err.message);
  }
}

/**
 * 检查是否可以执行刷新操作
 * @returns {boolean} true-可以刷新，false-已达限制
 */
export function canMakeRefresh() {
  loadStats();
  return requestStats.refreshRequests < REQUEST_LIMITS.MAX_REFRESH_PER_DAY;
}

/**
 * 记录一次刷新请求
 */
export function recordRefresh() {
  loadStats();
  requestStats.refreshRequests++;
  saveStats();
}

/**
 * 获取剩余的刷新次数
 * @returns {number} 剩余次数
 */
export function getRemainingRefreshes() {
  loadStats();
  return Math.max(0, REQUEST_LIMITS.MAX_REFRESH_PER_DAY - requestStats.refreshRequests);
}

/**
 * 获取今日已使用的刷新次数
 * @returns {number} 已使用次数
 */
export function getUsedRefreshes() {
  loadStats();
  return requestStats.refreshRequests;
}