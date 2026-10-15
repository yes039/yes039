// 本機開發伺服器：用 node:sqlite 模擬 D1，開發模式自動帶入測試資料。只供開發測試，不是正式部署。
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeD1, nodeSqliteDriver } from '../src/d1shim.js';
import { handleApi } from '../src/api.js';
import { resetTestData } from '../src/seed.js';
import { todayTW } from '../src/periods.js';

const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.PORT || 8787);
const file = process.env.DB_FILE || ':memory:';
const fresh = file === ':memory:' || !existsSync(file);
const drv = nodeSqliteDriver(DatabaseSync, file);
drv.exec(readFileSync(root + 'schema.sql', 'utf8'));
const env = {
  DB: makeD1(drv),
  DEV_MODE: '1',
  DEV_USER: process.env.DEV_USER || 'admin@test.local',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin@test.local',
  HASH_SALT: 'dev-salt',
  TODAY: process.env.TODAY || undefined,
};
if (fresh) await resetTestData(env.DB, env.TODAY || todayTW(), env.HASH_SALT);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await handleApi(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body }), env);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
    res.end(readFileSync(root + 'dist/index.html'));
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
}).listen(port, () => console.log(`宣傳戰情室（開發模式，測試資料）http://localhost:${port}`));
