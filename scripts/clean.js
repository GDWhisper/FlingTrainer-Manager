const fs = require('fs');
const path = require('path');

function cleanDirectory(dir) {
  if (fs.existsSync(dir)) {
    console.log(`🧹 清理目录: ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 清理构建目录
cleanDirectory('./build');
cleanDirectory('./dist');
cleanDirectory('./release');

console.log('✅ 清理完成');