// REST 路由：伺服器與展示模式共用。回傳 { status, body }。
import { AppError } from './money.js';
import { hasPerm } from './service.js';

export function createRouter(svc, { runTests, resetDemo } = {}) {
  const routes = [];
  const on = (method, pattern, handler, { auth = true } = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, auth });
  };

  on('POST', '/api/login', (c) => svc.login(c.body), { auth: false });
  on('GET', '/api/health', () => ({ ok: true, mode: 'server' }), { auth: false });
  on('POST', '/api/logout', (c) => { svc.logout(c.token); return { ok: true }; });
  on('GET', '/api/me', (c) => c.user);
  on('GET', '/api/meta', () => ({ enums: svc.enums }));

  on('GET', '/api/dashboard', (c) => svc.dashboard(c.user, c.query));

  on('GET', '/api/customers', (c) => svc.listCustomers(c.user, c.query));
  on('POST', '/api/customers', (c) => svc.createCustomer(c.user, c.body));
  on('GET', '/api/customers/:id', (c) => svc.getCustomer(c.user, +c.params.id));
  on('PUT', '/api/customers/:id', (c) => svc.updateCustomer(c.user, +c.params.id, c.body));

  on('GET', '/api/drivers', (c) => svc.listDrivers(c.user, { includeInactive: c.query.all === '1' }));
  on('POST', '/api/drivers', (c) => ({ id: svc.createDriver(c.user, c.body) }));
  on('PUT', '/api/drivers/:id', (c) => { svc.updateDriver(c.user, +c.params.id, c.body); return { ok: true }; });
  on('POST', '/api/vehicles', (c) => ({ id: svc.createVehicle(c.user, c.body) }));

  on('GET', '/api/orders', (c) => svc.listOrders(c.user, c.query));
  on('POST', '/api/orders', (c) => svc.createOrder(c.user, c.body));
  on('GET', '/api/orders/:id', (c) => svc.getOrder(c.user, +c.params.id));
  on('PUT', '/api/orders/:id', (c) => svc.updateOrder(c.user, +c.params.id, c.body));
  on('POST', '/api/orders/:id/cancel', (c) => svc.cancelOrder(c.user, +c.params.id, c.body));
  on('POST', '/api/orders/:id/complete', (c) => svc.completeOrder(c.user, +c.params.id, c.body));
  on('POST', '/api/orders/:id/assign', (c) => ({ id: svc.assign(c.user, +c.params.id, c.body) }));
  on('POST', '/api/orders/:id/reassign', (c) => ({ id: svc.reassign(c.user, +c.params.id, c.body) }));
  on('POST', '/api/orders/:id/payments', (c) => ({ id: svc.recordCustomerPayment(c.user, +c.params.id, c.body) }));
  on('POST', '/api/orders/:id/refunds', (c) => ({ id: svc.refund(c.user, +c.params.id, c.body) }));
  on('POST', '/api/orders/:id/ledger', (c) => ({ id: svc.addLedgerEntry(c.user, +c.params.id, c.body) }));

  on('GET', '/api/dispatches', (c) => svc.dispatchHistory(c.user, c.query));
  on('POST', '/api/dispatches/:id/accept', (c) => { svc.acceptDispatch(c.user, +c.params.id); return { ok: true }; });
  on('POST', '/api/dispatches/:id/reject', (c) => { svc.rejectDispatch(c.user, +c.params.id, c.body); return { ok: true }; });
  on('POST', '/api/dispatches/:id/cancel', (c) => { svc.cancelDispatch(c.user, +c.params.id, c.body); return { ok: true }; });

  on('POST', '/api/payments/:id/confirm', (c) => { svc.confirmPayment(c.user, +c.params.id); return { ok: true }; });
  on('POST', '/api/payments/:id/void', (c) => { svc.voidPayment(c.user, +c.params.id, c.body); return { ok: true }; });
  on('GET', '/api/ledger', (c) => svc.listLedger(c.user, c.query));
  on('GET', '/api/ledger/summary', (c) => svc.ledgerSummary(c.user, c.query));
  on('GET', '/api/reconcile', (c) => { if (!hasPerm(c.user, 'ledger.read')) throw new AppError('權限不足', 'FORBIDDEN', 403); return svc.reconcile(); });

  on('GET', '/api/settlements/open-items', (c) => svc.openItems(c.user, c.query));
  on('GET', '/api/settlements', (c) => svc.listSettlements(c.user, c.query));
  on('POST', '/api/settlements', (c) => svc.createSettlement(c.user, c.body));
  on('GET', '/api/settlements/:id', (c) => svc.getSettlement(c.user, +c.params.id));
  on('POST', '/api/settlements/:id/payments', (c) => svc.settlementPayment(c.user, +c.params.id, c.body));
  on('POST', '/api/settlements/:id/void', (c) => { svc.voidSettlement(c.user, +c.params.id, c.body); return { ok: true }; });

  on('GET', '/api/audit', (c) => svc.auditLogs(c.user, c.query));
  on('GET', '/api/tests', async (c) => {
    if (!hasPerm(c.user, 'dashboard.view')) throw new AppError('權限不足', 'FORBIDDEN', 403);
    return runTests ? await runTests() : { error: 'not available' };
  });
  on('POST', '/api/admin/reset-demo', async (c) => {
    if (c.user.role_code !== 'OWNER') throw new AppError('只有老闆可重置模擬資料', 'FORBIDDEN', 403);
    if (c.body?.confirm !== 'RESET') throw new AppError('請輸入 RESET 確認', 'CONFIRM_REQUIRED');
    await resetDemo();
    return { ok: true };
  });

  return async function handle(method, path, { query = {}, body = {}, token = null } = {}) {
    try {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = r.re.exec(path);
        if (!m) continue;
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const user = r.auth ? svc.userByToken(token) : null;
        if (r.auth && !user) throw new AppError('請先登入', 'UNAUTHENTICATED', 401);
        const out = await r.handler({ params, query, body: body || {}, token, user });
        return { status: 200, body: out ?? { ok: true } };
      }
      return { status: 404, body: { error: '找不到 API：' + method + ' ' + path, code: 'NOT_FOUND' } };
    } catch (e) {
      if (e instanceof AppError) return { status: e.status, body: { error: e.message, code: e.code } };
      const msg = String(e?.message || e);
      if (/UNIQUE constraint failed: dispatches|ux_dispatch_one_active/.test(msg)) {
        return { status: 409, body: { error: '此訂單已有有效派車，不得重複指派', code: 'DUPLICATE_ACTIVE_DISPATCH' } };
      }
      if (/UNIQUE constraint failed: settlement_items|ux_settlement_item_open/.test(msg)) {
        return { status: 409, body: { error: '訂單已在其他未結清結算單中', code: 'DUPLICATE_SETTLEMENT_ITEM' } };
      }
      if (/constraint/i.test(msg)) return { status: 409, body: { error: '資料限制錯誤：' + msg, code: 'CONSTRAINT' } };
      console.error(e);
      return { status: 500, body: { error: '系統錯誤：' + msg, code: 'INTERNAL' } };
    }
  };
}
