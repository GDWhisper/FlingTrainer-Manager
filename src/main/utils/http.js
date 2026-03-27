// 共享 HTTP 客户端

import axios from 'axios';
import { DEFAULT_HEADERS, REQUEST_TIMEOUT, REQUEST_LIMITS } from '../constants.js';

/**
 * 随机延迟函数
 * @param {number} min - 最小延迟（毫秒）
 * @param {number} max - 最大延迟（毫秒）
 * @returns {Promise<void>}
 */
async function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 创建带有默认配置的 axios 实例
 * @param {object} extraHeaders - 额外的请求头
 * @param {boolean} enableRandomDelay - 是否启用随机延迟（用于搜索功能）
 * @returns {import('axios').AxiosInstance}
 */
export function createHttpClient(extraHeaders = {}, enableRandomDelay = false) {
  const client = axios.create({
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
    timeout: REQUEST_TIMEOUT,
  });

  // 添加请求拦截器，实现随机延迟
  if (enableRandomDelay) {
    client.interceptors.request.use(async (config) => {
      // 仅对目标网站域名生效
      if (config.baseURL?.includes('flingtrainer.com') || 
          config.url?.includes('flingtrainer.com')) {
        await randomDelay(REQUEST_LIMITS.RANDOM_DELAY_MIN, REQUEST_LIMITS.RANDOM_DELAY_MAX);
      }
      return config;
    });
  }

  return client;
}