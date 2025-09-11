// scripts/compile-js.js
const fs = require("fs");
const path = require("path");
const bytenode = require("bytenode");

const jsFiles = ["main.js", "preload.js"];

function compileJsToJsc(jsFilePath) {
  const jscFilePath = jsFilePath.replace(".js", ".jsc");
  bytenode.compileFile({
    filename: jsFilePath,
    output: jscFilePath,
    stripDebug: true,
    compress: true,
    deleteSourceFile: false,
  });
  console.log(`Compiled ${jsFilePath} to ${jscFilePath}`);
}

function compileAllJs() {
  const srcDir = path.join(__dirname, "../src");
  
  jsFiles.forEach((jsFile) => {
    const jsPath = path.join(srcDir, jsFile);
    if (fs.existsSync(jsPath)) {
      compileJsToJsc(jsPath);
      console.log(`✅ Compiled ${jsFile} to .jsc`);
    } else {
      console.warn(`⚠️  ${jsPath} 不存在，跳过编译`);
    }
  });
}

compileAllJs();