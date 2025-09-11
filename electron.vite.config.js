// 
import { defineConfig, bytecodePlugin } from 'electron-vite';
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [bytecodePlugin()],
  },
  preload: {
    plugins: [bytecodePlugin()],
  },
  renderer: {
    plugins: [bytecodePlugin()],
    build: {
      rollupOptions: {
        input: {
          index: "src/renderer/index.html",
        },
      },
    },
    // 确保静态资源被正确处理
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
        "@assets": resolve(__dirname, "src/renderer/assets"),
      },
    },
  },
});
