// 桌機與手機截圖（Playwright）；同時收集瀏覽器錯誤。用法：node scripts/screenshots.mjs [網址] [輸出資料夾]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const base = process.argv[2] || 'http://localhost:8787/';
const out = process.argv[3] || 'screenshots';
mkdirSync(out, { recursive: true });

const pages = [
  ['01-總覽', '#/'],
  ['02-發文日曆', '#/organic?view=calendar'],
  ['03-貼文清單-粉專', '#/organic?view=list&type=page'],
  ['04-單篇貼文', '#/post/test-post-11'],
  ['05-專案總覽', '#/p/test-proj-jsn/overview'],
  ['06-廣告素材比較', '#/p/test-proj-jsn/creatives'],
  ['07-投放波次', '#/p/test-proj-jsn/campaigns'],
  ['08-登錄與匯入', '#/p/test-proj-jsn/entry'],
  ['09-玉欣珍專案', '#/p/test-proj-yxz/overview'],
]
const viewports = [['桌機', { width: 1440, height: 900 }, 1], ['手機', { width: 390, height: 844 }, 2]];

const browser = await chromium.launch();
const errors = [];
for (const [vname, viewport, scale] of viewports) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${vname} ${page.url()}：${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${vname} ${page.url()}：${m.text()}`));
  for (const [name, hash] of pages) {
    await page.goto(base + hash, { waitUntil: 'networkidle' });
    await page.waitForSelector('main.page h1', { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${vname}-${name}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) errors.push(`${vname} ${name}：頁面橫向溢出 ${overflow}px`);
  }
  await ctx.close();
}
const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'zh-TW' });
const dp = await dark.newPage();
await dp.goto(base + '#/', { waitUntil: 'networkidle' });
await dp.waitForSelector('main.page h1');
await dp.screenshot({ path: `${out}/桌機-深色-總覽.png`, fullPage: true });
await browser.close();
console.log(errors.length ? '問題：\n' + errors.join('\n') : '沒有瀏覽器錯誤，沒有橫向溢出');
