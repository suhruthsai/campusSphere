const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  for (const cfg of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: cfg.width, height: cfg.height },
      deviceScaleFactor: 1,
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    const canvasBox = await page.locator('canvas').boundingBox();
    await page.screenshot({ path: `outputs/home-${cfg.name}.png`, fullPage: true });
    console.log(`${cfg.name}: canvas ${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  for (const route of ['/navigation', '/student', '/faculty', '/analytics', '/events']) {
    await page.goto(`http://127.0.0.1:5173${route}`, { waitUntil: 'networkidle' });
    const h1 = await page.locator('h1').first().innerText();
    console.log(`${route}: ${h1.slice(0, 70)}`);
  }
  await page.close();
  await browser.close();

  if (errors.length) {
    console.error('Errors:', errors.join('\n'));
    process.exit(1);
  }
})();
