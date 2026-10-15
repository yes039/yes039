// 打包：一般版 → dist/index.html 與 dist/html.js（給 Worker 內嵌）；--preview → preview/index.html（瀏覽器內跑 API 與測試資料）
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const preview = process.argv.includes('--preview');
const root = new URL('..', import.meta.url).pathname;

const result = await build({
  entryPoints: [root + (preview ? 'web/preview.js' : 'web/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  write: false,
  loader: { '.wasm': 'binary', '.sql': 'text' },
  external: ['fs', 'path', 'crypto'],
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(root + 'web/styles.css', 'utf8');
const html = readFileSync(root + 'web/index.html', 'utf8')
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js);

if (preview) {
  mkdirSync(root + 'preview', { recursive: true });
  writeFileSync(root + 'preview/index.html', html);
  console.log(`preview/index.html ${(html.length / 1024).toFixed(0)} KB`);
} else {
  mkdirSync(root + 'dist', { recursive: true });
  writeFileSync(root + 'dist/index.html', html);
  writeFileSync(root + 'dist/html.js', `// 自動產生，請勿手動修改（npm run build）\nexport const HTML = ${JSON.stringify(html)};\n`);
  console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
}
