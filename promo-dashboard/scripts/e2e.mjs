// 介面操作測試（v0.2）：首頁兩區 → 日曆進單篇 → 新增貼文（不掛專案、掛專案）→ 專案總覽 → 素材比較 → 新增素材與投放紀錄 → 切換期間
// 用法：node scripts/e2e.mjs [網址]（需先啟動 dev server 或開啟預覽檔）
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const base = process.argv[2] || 'http://localhost:8787/';
const browser = await chromium.launch();
const errors = [];
const step = (s) => console.log('✓ ' + s);
const num = (t) => Number(String(t).replace(/[^\d]/g, ''));

for (const [vname, viewport] of [['桌機', { width: 1280, height: 900 }], ['手機', { width: 390, height: 844 }]]) {
  console.log(`— ${vname} —`);
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(`${vname}：${e.message}`));
  await page.goto(base + '#/');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload();
  await page.waitForSelector('#h-a');
  await page.waitForSelector('#h-b');
  const rows = await page.locator('table.organic tbody tr').count();
  assert.equal(rows, 5); // 四個主體＋合計
  assert.ok(await page.isVisible('.proj-card:has-text("Jason 老師合作招生")'));
  step('首頁同時有 A 日常發文（四主體）與 B 付費廣告專案');

  // 首頁主體列 → 該主體 → 日曆 → 單篇
  const homePlanned = num(await page.locator('table.organic tbody tr:has-text("粉專") td').nth(1).textContent());
  await page.click('table.organic a:has-text("粉專")');
  await page.waitForSelector('h1:has-text("日常 FB 發文：粉專")');
  const orgPlanned = num(await page.locator('.kpis .kpi').first().locator('.kpi-value').textContent());
  assert.equal(orgPlanned, homePlanned);
  step(`點「粉專」進入主體頁，預計發文 ${orgPlanned} 與首頁一致`);
  await page.click('.seg button:has-text("發文日曆")');
  await page.waitForSelector('.cal');
  await page.locator('.cal-post').first().click();
  await page.waitForSelector('.facts');
  assert.ok(await page.isVisible('h2:has-text("成效")'));
  step('從日曆點進單篇貼文');
  await page.goto(base + '#/organic?view=list');
  await page.waitForSelector('h2:has-text("貼文清單")');
  await page.locator('table.data a[href^="#/post/"]').first().click();
  await page.waitForSelector('h2:has-text("成效")');
  step('從貼文清單點進單篇貼文');

  if (vname === '桌機') {
    // 新增不掛專案的貼文，再新增掛專案的貼文
    await page.goto(base + '#/organic');
    await page.waitForSelector('h1');
    const before = num(await page.locator('.kpis .kpi').first().locator('.kpi-value').textContent());
    await page.click('button:has-text("新增發文")');
    await page.fill('#f-title', '【測試】E2E 獨立貼文');
    await page.selectOption('#f-outlet_id', { label: '粉專・【測試】AI 小店幫手粉專' });
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    await page.fill('#f-planned_date', today);
    await page.click('.modal button:has-text("儲存")');
    await page.waitForSelector('.facts');
    assert.ok(await page.isVisible('.facts b:has-text("無（日常發文）")'));
    await page.goto(base + '#/organic');
    await page.waitForSelector('h1');
    assert.equal(num(await page.locator('.kpis .kpi').first().locator('.kpi-value').textContent()), before + 1);
    step('新增不掛專案的貼文，預計發文 +1');
    await page.click('button:has-text("新增發文")');
    await page.fill('#f-title', '【測試】E2E 支援招生貼文');
    await page.selectOption('#f-project_id', 'test-proj-jsn');
    await page.fill('#f-planned_date', today);
    await page.click('.modal button:has-text("儲存")');
    await page.waitForSelector('.facts a:has-text("TJSN")');
    step('新增支援 Jason 專案的貼文');
    await page.goto(base + '#/p/test-proj-jsn/overview');
    await page.waitForSelector('h2:has-text("相關自然貼文")');
    assert.ok(await page.isVisible('.mini-list a:has-text("E2E 支援招生貼文")'));
    assert.ok(await page.isVisible('text=不與廣告成果相加'));
    step('專案總覽分區顯示：專用付費廣告／相關自然貼文（不相加）');

    // 素材比較
    await page.click('.tabs a:has-text("廣告素材比較")');
    await page.waitForSelector('.cr-card');
    const cards = await page.locator('.cr-card').count();
    assert.ok(cards >= 2);
    assert.ok(await page.isVisible('table.data td:has-text("來源不明")'));
    step(`廣告素材比較：${cards} 份素材卡，比較表含來源不明列`);
    await page.click('button:has-text("新增素材")');
    await page.selectOption('#f-format', 'IM');
    await page.fill('#f-name', 'E2E 新素材');
    await page.fill('#f-headline', '測試標題');
    await page.selectOption('#f-prod_status', '已核可');
    await page.selectOption('#f-status', '進行中');
    await page.click('.modal button:has-text("儲存")');
    await page.waitForSelector('.cr-card:has-text("E2E 新素材")');
    const card = page.locator('.cr-card:has-text("E2E 新素材")');
    await card.locator('summary').click();
    await card.locator('button:has-text("新增投放紀錄")').click();
    await page.fill('#f-audience', '測試受眾 B');
    await page.click('.modal button:has-text("儲存")');
    await page.waitForSelector('.cr-card:has-text("E2E 新素材") summary:has-text("1 組")');
    step('新增素材（已核可、投放中）並新增一筆投放紀錄');

    // 切換期間：本週 → 本月 → 自訂，首頁與日常發文頁一致
    for (const [label, sel] of [['本月', 'month'], ['近 30 天', 'r30']]) {
      await page.goto(base + '#/');
      await page.selectOption('#period-select', sel);
      await page.waitForSelector(`.sub:has-text("${label === '本月' ? '本月' : '近 30 天'}")`);
      const homeTotal = await page.locator('table.organic tr.total td').nth(1).textContent();
      await page.goto(base + '#/organic');
      await page.waitForSelector('h1');
      const orgTotal = await page.locator('.kpis .kpi').first().locator('.kpi-value').textContent();
      assert.equal(num(orgTotal), num(homeTotal), label);
      step(`切換到「${label}」：首頁與日常發文頁預計發文都是 ${num(homeTotal)}`);
    }
    await page.goto(base + '#/');
    await page.selectOption('#period-select', 'custom');
    await page.fill('#custom-from', '2026-10-01');
    await page.fill('#custom-to', '2026-10-20');
    await page.waitForSelector('.sub:has-text("自訂")');
    step('自訂期間可用');

    // 專案切換
    await page.selectOption('#project-switch', 'test-proj-yxz');
    await page.waitForSelector('h1:has-text("玉欣珍會員活化")');
    assert.ok(await page.isVisible('text=本專案尚未定義成果指標'));
    step('切換到玉欣珍專案：成果顯示「本專案尚未定義」');
  }
  await page.close();
}
await browser.close();
if (errors.length) { console.error('瀏覽器錯誤：', errors); process.exit(1); }
console.log('介面操作測試全部通過');
