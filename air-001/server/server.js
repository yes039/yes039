// AIR-001 原型伺服器：Node 內建 http + node:sqlite，零外部執行期相依。
// 用法：npm start → http://localhost:8787   （PORT、DB_FILE 可用環境變數覆寫）
import http from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openNodeDb, nodeEnv } from './db-node.js';
import { createService } from '../core/service.js';
import { createRouter } from '../core/router.js';
import { buildDemo, runTestSuite } from '../core/demo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const DB_FILE = process.env.DB_FILE || join(ROOT, 'data', 'air001.db');
const env = nodeEnv();

let db; let svc; let handle;
async function open({ reset = false } = {}) {
  await mkdir(dirname(DB_FILE), { recursive: true });
  if (db) db.close();
  if (reset) for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) await rm(f, { force: true });
  db = openNodeDb(DB_FILE);
  svc = createService(db, env);
  svc.init();
  if (svc.isEmpty()) {
    db.tx(() => buildDemo(svc));
    console.log('已建立模擬資料（帳號：owner/owner123、dispatch/dispatch123、account/account123、driver1/driver123）');
  }
  handle = createRouter(svc, {
    runTests: () => runTestSuite(() => openNodeDb(':memory:'), env),
    resetDemo: () => open({ reset: true }),
  });
}
await open({ reset: process.argv.includes('--reset') || process.argv.includes('--reset-only') });
if (process.argv.includes('--reset-only')) { console.log('資料庫已重置：' + DB_FILE); process.exit(0); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };

async function serveStatic(res, urlPath) {
  let rel = urlPath === '/' ? '/web/index.html' : urlPath;
  if (rel.startsWith('/vendor/')) rel = '/node_modules/sql.js/dist/' + rel.slice(8);
  else if (!rel.startsWith('/core/') && !rel.startsWith('/web/')) rel = '/web' + rel;
  const file = normalize(join(ROOT, rel));
  if (![join(ROOT, 'web'), join(ROOT, 'core'), join(ROOT, 'node_modules', 'sql.js', 'dist')].some((d) => file.startsWith(d))) { res.writeHead(403).end(); return; }
  try {
    let body = await readFile(file);
    // index.html 以「片段」撰寫（同時可作為 Artifact 發佈），由伺服器補上完整文件骨架
    if (file.endsWith('index.html')) body = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>' + body + '</body></html>';
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(res, url.pathname);
  let body = {};
  if (['POST', 'PUT'].includes(req.method)) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) { res.writeHead(413).end(); return; } }
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null;
  const out = await handle(req.method, url.pathname, { query: Object.fromEntries(url.searchParams), body, token });
  res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(out.body));
}).listen(PORT, () => console.log(`AIR-001 原型已啟動：http://localhost:${PORT}  （資料庫：${DB_FILE}）`));
