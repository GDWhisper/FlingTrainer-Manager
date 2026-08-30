// electron-builder afterPack hook: UPX compress the packed executable.
// UPX must be present in PATH; otherwise compression is skipped gracefully.
const { exec } = require('child_process');
const path = require('path');

module.exports = async function (context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }
  const exePath = path.join(context.appOutDir, '风灵月影宗.exe');
  return new Promise((resolve) => {
    exec(`upx --best "${exePath}"`, (error) => {
      if (error) console.log('UPX compression skipped:', error.message);
      resolve();
    });
  });
};
