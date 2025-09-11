// vite.config.js
import { defineConfig } from 'electron-vite';
import bytecodePlugin from 'vite-plugin-bytecode';

export default defineConfig({
  main: {
    plugins: [
      bytecodePlugin() // 保护主进程代码
    ]
  },
  preload: {
    plugins: [
      bytecodePlugin() // 保护预加载脚本
    ]
  },
  renderer: {
    plugins: [
      bytecodePlugin() // 保护渲染进程代码
    ],
    // 显式指定入口，确保 Vite 正确打包和 HMR
    build: {
      rollupOptions: {
        input: {
          index: 'src/renderer/index.html' // 指定 HTML 入口
        }
      }
    }
  }
});