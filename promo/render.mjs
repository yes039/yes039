// 將 scene.html 逐格渲染成 1080x1920 MP4。
// 用法：node promo/render.mjs [輸出檔]（預設 promo/out/huobar-promo.mp4）
// 照片放在 promo/photos/（jpg/png/webp），依檔名排序自動套入。
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] || join(here, 'out', 'huobar-promo.mp4'));
const FPS = 30, DURATION = 15;

const ffmpeg = process.env.FFMPEG ||
  execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();

const photoDir = join(here, 'photos');
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const photos = existsSync(photoDir)
  ? readdirSync(photoDir).filter(f => mime[extname(f).toLowerCase()]).sort()
      .map(f => `data:${mime[extname(f).toLowerCase()]};base64,${readFileSync(join(photoDir, f)).toString('base64')}`)
  : [];
console.log(`照片 ${photos.length} 張`);

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(p => { window.__RENDERING__ = true; window.PHOTOS = p; }, photos);
await page.goto(pathToFileURL(join(here, 'scene.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const text = document.body.innerText;
  await Promise.all(['900 100px "Noto Serif TC"', '900 100px "Noto Sans TC"', '500 100px "Noto Sans TC"']
    .map(f => document.fonts.load(f, text)));
  await document.fonts.ready;
});

const ff = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18',
  '-c:a', 'aac', '-movflags', '+faststart', out
], { stdio: ['pipe', 'ignore', 'inherit'] });

const total = FPS * DURATION;
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.render(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) console.log(`frame ${i}/${total}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`完成：${out}`);
