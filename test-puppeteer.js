// test-puppeteer.js
const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 正在启动 Puppeteer...');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://httpbin.org/ip', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });

    const html = await page.content();
    console.log('✅ 页面内容:', html);

    await browser.close();
    console.log('🎉 测试成功！');
  } catch (err) {
    console.error('❌ 测试失败:', err.message);
    if (browser) await browser.close().catch(() => {});
  }
})();