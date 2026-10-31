// node:sqlite 轉接層（Node ≥ 22.13 內建，無需原生編譯套件）
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function openNodeDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  let depth = 0;
  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  return {
    raw: db,
    exec: (sql) => db.exec(sql),
    run(sql, params = []) { const r = stmt(sql).run(...params); return { changes: Number(r.changes), id: Number(r.lastInsertRowid) }; },
    get(sql, params = []) { const r = stmt(sql).get(...params); return r ? { ...r } : undefined; },
    all(sql, params = []) { return stmt(sql).all(...params).map((r) => ({ ...r })); },
    tx(fn) {
      const sp = `sp${depth}`;
      db.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`);
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
    close: () => db.close(),
  };
}

export function nodeEnv({ now = () => Date.now() } = {}) {
  return {
    now,
    randomToken: () => randomBytes(24).toString('hex'),
    hashPassword(pw) {
      const salt = randomBytes(16).toString('hex');
      return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
    },
    verifyPassword(pw, stored) {
      const [alg, salt, hash] = String(stored).split('$');
      if (alg !== 'scrypt') return false;
      const a = Buffer.from(hash, 'hex');
      const b = scryptSync(pw, salt, 32);
      return a.length === b.length && timingSafeEqual(a, b);
    },
  };
}
