// scripts/process-renderer-assets.js
const fs = require("fs").promises;
const path = require("path");
const { minify } = require("html-minifier-terser");
const CleanCSS = require("clean-css");
const JavaScriptObfuscator = require("javascript-obfuscator");

const rendererDir = "./out/renderer";
const assetsDir = "./out/renderer/assets";

// 处理HTML文件
async function processHTML() {
  const htmlPath = path.join(rendererDir, "index.html");

  try {
    await fs.access(htmlPath);
    const html = await fs.readFile(htmlPath, "utf8");

    const minified = await minify(html, {
      removeComments: true,
      collapseWhitespace: true,
      minifyJS: true,
      minifyCSS: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      sortClassName: true,
      useShortDoctype: true,
      removeEmptyAttributes: true,
      removeOptionalTags: true,
    });

    await fs.writeFile(htmlPath, minified, "utf8");
    console.log("✅ HTML 压缩完成: index.html");
  } catch (err) {
    console.error("❌ HTML 处理失败: index.html", err);
  }
}

// 处理CSS文件
async function processCSSFiles() {
  try {
    const files = await fs.readdir(assetsDir);
    const cssFiles = files.filter((file) => file.endsWith(".css"));

    for (const file of cssFiles) {
      const filePath = path.join(assetsDir, file);
      try {
        const css = await fs.readFile(filePath, "utf8");
        const result = new CleanCSS({
          level: {
            1: {
              // 保持特殊注释
              specialComments: 0,
              // 保持空格
              removeWhitespace: false,
            },
            2: {
              // 禁用合并规则等可能导致布局问题的选项
              mergeMedia: false,
              mergeSemantically: false,
              restructureRules: false,
              removeUnusedAtRules: false,
            },
          },
          // 保持兼容性
          compatibility: "*",
          // 不重新计算单位
          rebase: false,
          // 保持源地图
          sourceMap: false,
        }).minify(css);

        if (result.errors && result.errors.length > 0) {
          throw new Error("CSS 处理错误: " + result.errors.join("\n"));
        }

        await fs.writeFile(filePath, result.styles, "utf8");
        console.log(`✅ CSS 压缩完成: ${file}`);
      } catch (err) {
        console.error(`❌ CSS 处理失败: ${file}`, err);
      }
    }
  } catch (err) {
    console.log("未找到 assets 目录或读取目录失败:", err.message);
  }
}

// 处理JavaScript文件
async function processJSFiles() {
  try {
    const files = await fs.readdir(assetsDir);
    const jsFiles = files.filter((file) => file.endsWith(".js"));

    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      try {
        const code = await fs.readFile(filePath, "utf8");

        // 混淆JavaScript代码
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          identifierNamesGenerator: "hexadecimal",
          rotateStringArray: true,
          selfDefending: true,
          stringArray: true,
          stringArrayEncoding: ["base64"],
          stringArrayThreshold: 0.75,
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
        }).getObfuscatedCode();

        await fs.writeFile(filePath, obfuscatedCode);
        console.log(`✅ JavaScript 混淆完成: ${file}`);
      } catch (err) {
        console.error(`❌ JavaScript 处理失败: ${file}`, err);
      }
    }
  } catch (err) {
    console.log("未找到 assets 目录或读取目录失败:", err.message);
  }
}

// 主处理函数
async function main() {
  console.log("开始处理渲染器资源...");

  try {
    // 处理HTML文件
    await processHTML();

    // 处理CSS文件
    await processCSSFiles();

    // 处理JavaScript文件
    await processJSFiles();

    console.log("🎉 渲染器资源处理完成！");
  } catch (err) {
    console.error("❌ 资源处理过程中发生错误:", err);
    process.exit(1);
  }
}

// 执行主函数
main();
