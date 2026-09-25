// 將 scene.html 逐格渲染成 1080x1920 MP4。
// 用法：[CTA=結尾按鈕文字] [BGM=v2] node promo/render.mjs [輸出檔]（預設 promo/out/huobar-promo.mp4）
// 素材放在 promo/media/：影片 <名稱>.mp4（已轉成 1080x1920 SDR）、照片 <名稱>.jpg，於 scene.html 的 SHOTS 指定。
import { chromium } from 'playwright';
import { spawn, execSync, execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] || join(here, 'out', 'huobar-promo.mp4'));
const FPS = 30, DURATION = 30;

const ffmpeg = process.env.FFMPEG ||
  execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();

// 影片抽格
const media = join(here, 'media');
const frames = {};
for (const f of readdirSync(media).filter(f => f.endsWith('.mp4'))) {
  const name = f.replace(/\.mp4$/, '');
  const dir = join(here, '.cache', 'frames', name);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    execFileSync(ffmpeg, ['-v', 'error', '-i', join(media, f), '-vf', `fps=${FPS}`, '-q:v', '3', join(dir, '%04d.jpg')]);
  }
  frames[name] = readdirSync(dir).sort().map(x => pathToFileURL(join(dir, x)).href);
  console.log(`${name}: ${frames[name].length} 格`);
}

mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(([f, cta]) => { window.__RENDERING__ = true; window.FRAMES = f; window.CTA = cta; }, [frames, process.env.CTA || '']);
await page.goto(pathToFileURL(join(here, 'scene.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  const text = document.body.innerText;
  await Promise.all(['900 100px "Noto Serif TC"', '900 100px "Noto Sans TC"', '500 100px "Noto Sans TC"']
    .map(f => document.fonts.load(f, text)));
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
});

// 背景音樂：music.py（bgm.wav）或 music_v2.py（BGM=v2 → bgm-v2.wav）合成的原創配樂，音量正規化到 -14 LUFS
const v = process.env.BGM === 'v2' ? '-v2' : '';
const bgm = join(media, `bgm${v}.wav`);
if (!existsSync(bgm)) execFileSync('python3', [join(here, `music${v.replace('-', '_')}.py`)], { stdio: 'inherit' });
const ff = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-i', bgm,
  '-map', '0:v', '-map', '1:a',
  '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
  '-ar', '44100',
  '-t', String(DURATION),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20',
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out
], { stdio: ['pipe', 'ignore', 'inherit'] });

const total = FPS * DURATION;
for (let i = 0; i < total; i++) {
  await page.evaluate(t => window.render(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`frame ${i}/${total}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`完成：${out}`);
