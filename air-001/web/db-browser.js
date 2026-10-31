// 展示模式：sql.js（SQLite 編譯為 WebAssembly / asm.js）在瀏覽器記憶體中執行同一份 schema 與業務邏輯。
// 重要：展示模式資料只存在本頁記憶體，重新整理即重建模擬資料；不寫入 localStorage，也不是正式帳本。
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
}
let SQLPromise;
async function loadSql() {
  const attempts = [
    async () => { await loadScript('vendor/sql-wasm.js'); return window.initSqlJs({ locateFile: (f) => 'vendor/' + f }); },
    async () => { await loadScript('vendor/sql-asm.js'); return window.initSqlJs(); },
    async () => { await loadScript(CDN + 'sql-asm.js'); return window.initSqlJs(); },
  ];
  let last;
  for (const a of attempts) {
    try { return await a(); } catch (e) { last = e; window.initSqlJs = undefined; }
  }
  throw last;
}

export async function openBrowserDb() {
  SQLPromise ||= loadSql();
  const SQL = await SQLPromise;
  const db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON;');
  let depth = 0;
  const rows = (sql, params) => {
    const st = db.prepare(sql);
    try {
      st.bind(params.map((v) => (v === undefined ? null : v)));
      const out = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally { st.free(); }
  };
  return {
    exec: (sql) => db.exec(sql),
    run(sql, params = []) {
      rows(sql, params);
      const changes = db.getRowsModified();
      const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
      return { changes, id };
    },
    get: (sql, params = []) => rows(sql, params)[0],
    all: (sql, params = []) => rows(sql, params),
    tx(fn) {
      const sp = `sp${depth}`;
      db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
      depth++;
      try {
        const out = fn();
        depth--;
        db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
        return out;
      } catch (e) {
        depth--;
        db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
        throw e;
      }
    },
  };
}

// 展示模式密碼雜湊僅為示意（FNV-1a），正式環境由伺服器 scrypt / 身分服務處理
function fnv(s) { let h = 0x811c9dc5; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); }
export function browserEnv() {
  return {
    now: () => Date.now(),
    randomToken: () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join(''),
    hashPassword: (pw) => `demo$${fnv('air001:' + pw)}`,
    verifyPassword: (pw, h) => h === `demo$${fnv('air001:' + pw)}`,
  };
}
