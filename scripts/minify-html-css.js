// scripts/minify-html-css.js
const fs = require('fs').promises;
const path = require('path');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const srcDir = './src';
const buildDir = './build';

async function minifyHTML(file) {
  const inputPath = path.join(srcDir, file);
  const outputPath = path.join(buildDir, file);

  try {
    await fs.access(inputPath); // 检查文件是否存在
    const html = await fs.readFile(inputPath, 'utf8');
    const minified = await minify(html, {
      removeComments: true,
      collapseWhitespace: true,
      minifyJS: true,
      minifyCSS: true
    });
    await fs.writeFile(outputPath, minified, 'utf8');
    console.log(`✅ HTML 压缩完成: ${file}`);
  } catch (err) {
    console.error(`❌ HTML 压缩失败: ${file}`, err);
  }
}

async function minifyCSS(file) {
  const inputPath = path.join(srcDir, file);
  const outputPath = path.join(buildDir, file);

  try {
    await fs.access(inputPath);
    const css = await fs.readFile(inputPath, 'utf8');
    const result = new CleanCSS({}).minify(css);

    if (result.errors && result.errors.length > 0) {
      throw new Error('CSS 压缩错误: ' + result.errors.join('\n'));
    }

    const minified = result.styles;
    await fs.writeFile(outputPath, minified, 'utf8');
    console.log(`✅ CSS 压缩完成: ${file}`);
  } catch (err) {
    console.error(`❌ CSS 压缩失败: ${file}`, err);
  }
}

(async () => {
  try {
    // 确保 build 目录存在
    try {
      await fs.access(buildDir);
    } catch {
      await fs.mkdir(buildDir, { recursive: true });
    }

    const htmlFiles = ['index.html'];
    const cssFiles = ['styles.css'];

    // 并行处理所有文件
    await Promise.all([
      ...htmlFiles.map(minifyHTML),
      ...cssFiles.map(minifyCSS)
    ]);

    console.log('🎉 所有文件处理完成！');
  } catch (err) {
    console.error('❌ 脚本执行失败:', err);
    process.exit(1);
  }
})();