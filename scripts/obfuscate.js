// scripts/obfuscate.js
const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const srcDir = "./src";
const buildDir = "./build";

const jsFiles = [
  "main.js",
  "games.js",
  "search.js",
  "download.js",
  "preload.js",
  "renderer.js" 
];

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

jsFiles.forEach((file) => {
  const inputPath = path.join(srcDir, file);
  const outputPath = path.join(buildDir, file);

  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  ${inputPath} 不存在，跳过`);
    return;
  }

  const code = fs.readFileSync(inputPath, "utf8");
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

  fs.writeFileSync(outputPath, obfuscatedCode);
  console.log(`✅ 混淆完成: ${file}`);
});
