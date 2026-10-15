// 瀏覽器預覽：在頁面內用 sql.js 跑同一套 API 與測試資料，不連任何伺服器
// 用純 JavaScript 版 sql.js（不用 WebAssembly），避免預覽環境的安全政策擋下
import initSqlJs from 'sql.js/dist/sql-asm.js';
import schema from '../schema.sql';
import { makeD1, sqlJsDriver } from '../src/d1shim.js';
import { handleApi } from '../src/api.js';
import { resetTestData } from '../src/seed.js';
import { todayTW } from '../src/periods.js';
import { mount } from './app.js';

const env = { DEV_MODE: '1', ADMIN_EMAILS: 'preview@test.local', DEV_USER: 'preview@test.local', HASH_SALT: 'preview-salt' };

async function boot() {
  const SQL = await initSqlJs();
  const setup = async () => {
    const drv = sqlJsDriver(SQL);
    drv.exec(schema);
    env.DB = makeD1(drv);
    await resetTestData(env.DB, todayTW(), env.HASH_SALT);
  };
  await setup();
  window.__PREVIEW__ = true;
  window.__LOCAL_API__ = (req) => handleApi(req, env);
  window.__RESET__ = () => { location.hash = '#/'; location.reload(); };
  mount();
}

boot().catch((e) => {
  document.getElementById('app').textContent = '預覽載入失敗：' + e.message;
});
