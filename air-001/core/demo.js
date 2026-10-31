// 建立展示資料庫與執行測試套件（伺服器與瀏覽器共用）
import { createService } from './service.js';
import { seedBase, runScenarios, seedExtras, invariantChecks } from './scenarios.js';

export function buildDemo(svc, opts = {}) {
  const base = seedBase(svc);
  runScenarios(svc, base, opts);
  seedExtras(svc, base, opts);
  return base;
}

/** openDb: () => db（每次測試使用全新空白資料庫） */
export async function runTestSuite(openDb, env, opts = {}) {
  const db = await openDb();
  const svc = createService(db, env);
  svc.init();
  const started = Date.now();
  const base = seedBase(svc);
  const results = runScenarios(svc, base, opts);
  seedExtras(svc, base, opts);
  results.push(...invariantChecks(svc, base));
  const orders = svc.listOrders(base.users.owner, {});
  const passed = results.filter((r) => r.pass).length;
  return {
    ran_at: new Date(env.now()).toISOString(),
    duration_ms: Date.now() - started,
    order_count: orders.length,
    total: results.length, passed, failed: results.length - passed,
    cases: [...new Set(results.map((r) => r.case))].length,
    results,
  };
}
