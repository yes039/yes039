import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { makeD1, nodeSqliteDriver } from '../src/d1shim.js';
import { handleApi } from '../src/api.js';
import { resetTestData } from '../src/seed.js';

export const TODAY = '2026-10-15';

export async function setup({ seed = true } = {}) {
  const drv = nodeSqliteDriver(DatabaseSync);
  drv.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const DB = makeD1(drv);
  const env = { DB, DEV_MODE: '1', ADMIN_EMAILS: 'admin@test.local', DEV_USER: 'admin@test.local', TODAY, HASH_SALT: 'test-salt' };
  if (seed) await resetTestData(DB, TODAY, env.HASH_SALT);
  const call = async (method, path, body, user) => {
    const headers = { 'content-type': 'application/json' };
    if (user) headers['x-dev-user'] = user;
    const res = await handleApi(new Request('http://x/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
  return { env, DB, call, drv };
}
