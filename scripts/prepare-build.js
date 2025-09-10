// scripts/prepare-build.js
const fs = require('fs');
const path = require('path');

// 复制 package.json 到 build 目录并修改 main 字段
const packageJson = require('../package.json');
packageJson.main = 'main.js'; // 确保在 build 目录中指向正确的文件

// 写入修改后的 package.json 到 build 目录
fs.writeFileSync(
  path.join(__dirname, '../build/package.json'),
  JSON.stringify(packageJson, null, 2)
);

// 复制其他必要文件
if (fs.existsSync('./icon.ico')) {
  fs.copyFileSync('./icon.ico', './build/icon.ico');
}

console.log('✅ 准备构建完成');