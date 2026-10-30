// 小貨 片型丁：用無頭 Chrome 把 圖卡.html 逐格截成透明圖
// 用法：node 渲染.mjs <案子資料夾> [只渲染這幾格，例如 30,330,600]
import puppeteer from 'puppeteer-core';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] || '.'), only = process.argv[3];
const TL = JSON.parse(fs.readFileSync(path.join(root, '時間軸.json'), 'utf8'));
const FPS = 30, N = Math.ceil(TL.total * FPS);
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('❌ 找不到 Google Chrome'); process.exit(1); }
const out = path.join(root, '圖卡幀'); fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb'] });
const pg = await b.newPage(); await pg.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await pg.goto('file://' + path.join(here, '圖卡.html')); await pg.evaluate(t => { TL = t }, TL);
await pg.evaluateHandle('document.fonts.ready');
const frames = only ? only.split(',').map(Number) : [...Array(N).keys()];
for (const f of frames) {
  await pg.evaluate(t => render(t), f / FPS);
  await pg.screenshot({ path: path.join(out, String(f).padStart(5, '0') + '.png'), omitBackground: true });
}
await b.close(); console.log('✅ 渲染完成', frames.length, '格 →', out);
