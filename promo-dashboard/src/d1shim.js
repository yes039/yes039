// 與 Cloudflare D1 相同介面的薄包裝，給本機開發（node:sqlite）與瀏覽器預覽（sql.js）使用。
// 正式環境直接使用 D1，不經過這個檔案。

const clean = (args) => args.map((a) => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a));

class Stmt {
  constructor(drv, sql, args = []) { this.drv = drv; this.sql = sql; this.args = args; }
  bind(...args) { return new Stmt(this.drv, this.sql, clean(args)); }
  async all() { return { results: this.drv.all(this.sql, this.args), success: true }; }
  async first() { return this.drv.all(this.sql, this.args)[0] ?? null; }
  async run() { this.drv.run(this.sql, this.args); return { success: true }; }
}

export function makeD1(drv) {
  return {
    prepare: (sql) => new Stmt(drv, sql),
    async batch(stmts) {
      drv.exec('BEGIN');
      try {
        for (const s of stmts) drv.run(s.sql, s.args);
        drv.exec('COMMIT');
      } catch (e) {
        drv.exec('ROLLBACK');
        throw e;
      }
      return stmts.map(() => ({ success: true }));
    },
    async exec(sql) { drv.exec(sql); },
  };
}

/** node:sqlite（Node 22+） */
export function nodeSqliteDriver(DatabaseSync, file = ':memory:') {
  const db = new DatabaseSync(file);
  return {
    all: (sql, args) => db.prepare(sql).all(...args).map((r) => ({ ...r })),
    run: (sql, args) => db.prepare(sql).run(...args),
    exec: (sql) => db.exec(sql),
  };
}

/** sql.js（瀏覽器） */
export function sqlJsDriver(SQL) {
  const db = new SQL.Database();
  return {
    all(sql, args) {
      const st = db.prepare(sql);
      try {
        st.bind(args);
        const rows = [];
        while (st.step()) rows.push(st.getAsObject());
        return rows;
      } finally { st.free(); }
    },
    run: (sql, args) => db.run(sql, args),
    exec: (sql) => db.exec(sql),
  };
}
