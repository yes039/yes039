const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [mode, a, b] = process.argv.slice(2);
  const subs = JSON.parse(fs.readFileSync('subs.json', 'utf8'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGEERR', e.message));
  await page.goto('file://' + __dirname + '/index.html');
  await page.evaluate(s => setSubs(s), subs);
  await page.evaluate(() => document.fonts.ready);
  if (mode === 'stills') {
    fs.mkdirSync('stills', { recursive: true });
    for (const t of a.split(',').map(Number)) {
      await page.evaluate(t => render(t), t);
      await page.screenshot({ path: `stills/t${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 80 });
    }
  } else {
    fs.mkdirSync('frames', { recursive: true });
    const from = +a, to = +b;
    for (let i = from; i < to; i++) {
      await page.evaluate(t => render(t), i / 30);
      await page.screenshot({ path: `frames/f${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 });
    }
  }
  await browser.close();
})();
