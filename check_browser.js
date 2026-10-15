const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    return {
      canvasCount: document.querySelectorAll('canvas').length,
      fallbackCount: document.querySelectorAll('[data-testid="crown-stage-fallback"]').length,
      containerCount: document.querySelectorAll('[data-testid="crown-stage-container"]').length,
      innerWidth: window.innerWidth,
    };
  });
  console.log('DOM INFO:', JSON.stringify(info));
  await browser.close();
})();
