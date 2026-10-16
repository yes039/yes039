// 介面操作測試（v0.4）：首頁兩區 → 日曆進單篇 → 新增貼文（不掛專案、掛專案）→ 專案總覽 → 素材比較 → 新增素材與投放紀錄 → 切換期間
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
  assert.ok(await page.isVisible('.proj-card:has-text("玉欣珍") :text("規劃中／尚未啟用付費廣告")'));
  const jsnCard = page.locator('.proj-card:has-text("Jason 老師合作招生")');
  assert.ok((await jsnCard.textContent()).includes('暫不計算：廣告資料不完整'));
  assert.ok((await jsnCard.textContent()).includes('已知小計'));
  assert.ok((await jsnCard.textContent()).includes('累計報名'));
  step('專案卡：玉欣珍標示尚未啟用付費廣告；Jason 成本暫不計算、花費標已知小計、本期與累計報名分開');

  await page.goto(base + '#/p/test-proj-jsn/overview');
  await page.waitForSelector('#h-period');
  for (const t of ['付費廣告成果', '免費引流成果', '來源不明', '專案合計']) assert.ok(await page.isVisible(`table.groups td:has-text("${t}")`), t);
  assert.ok(await page.isVisible('.kpi:has-text("付費廣告每筆") :text("暫不計算：廣告資料不完整")'));
  assert.ok(await page.isVisible('#h-prog'));
  assert.ok(await page.isVisible('.kpi:has-text("預算使用率") :text("至少")'));
  assert.ok(await page.isVisible('#h-prog ~ .enroll-prog :text("資料不完整，達成率暫不計算")') || (await page.locator('section:has(#h-prog)').textContent()).includes('資料不完整，達成率暫不計算'));
  assert.equal(await page.locator('section:has(#h-prog) .budget-bar').count(), 0, '不完整時不畫進度條');
  assert.ok((await page.locator('section:has(#h-prog)').textContent()).includes('目前不扣除取消'));
  step('專案總覽：成果三組分開、成本暫不計算、預算使用率標「至少」、累計達成率暫不計算、說明不扣除取消');

  // 素材：比較表在素材卡前面；已結束收起；圖片放大；影片播放；落地頁
  await page.goto(base + '#/p/test-proj-jsn/creatives');
  await page.waitForSelector('#h-cmp');
  const cmpY = (await page.locator('#h-cmp').boundingBox()).y;
  const cardY = (await page.locator('.cr-card').first().boundingBox()).y;
  assert.ok(cmpY < cardY, '比較表在素材卡前面');
  assert.equal(await page.locator('table.cmp tr.ended').count(), 0, '已結束預設收起');
  const names = await page.locator('table.cmp tbody button.linklike b').allTextContents();
  await page.locator('table.cmp button:has-text("已結束")').click();
  assert.ok(await page.locator('table.cmp tr.ended').count() >= 2);
  const names2 = await page.locator('table.cmp tbody tr:not(.ended) button.linklike b').allTextContents();
  assert.deepEqual(names2, names, '展開後素材編號不變');
  for (const r of await page.locator('table.cmp tr.ended').all()) assert.ok(!(await r.textContent()).includes('持續'));
  step('素材比較表在素材卡前面；已結束素材預設收起，展開後顯示「已結束」且不給持續；編號不變');
  assert.ok(await page.isVisible('.media-flag:has-text("僅封面，尚未提供影片")'));
  assert.ok(await page.isVisible('.media.none:has-text("尚未提供素材")'));
  assert.ok(await page.locator('.mock-tag:has-text("測試示意")').count() >= 2);
  await page.locator('.cr-card .zoom').first().click();
  await page.waitForSelector('.lightbox img');
  await page.click('.modal .icon-btn');
  step('圖片點擊放大；只有封面標「僅封面，尚未提供影片」；沒有檔案標「尚未提供素材」；測試示意圖有標示');
  await page.locator('table.cmp tr.ended:has-text("VD01") button.linklike').first().click();
  await page.waitForSelector('.modal video');
  const played = await page.evaluate(async () => {
    const v = document.querySelector('.modal video');
    v.muted = true;
    await v.play();
    await new Promise((r) => setTimeout(r, 700));
    return v.currentTime;
  });
  assert.ok(played > 0.2, '影片有在播放');
  const modalText = await page.locator('.modal').textContent();
  for (const t of ['版本', '負責人', '製作與審核', '投放狀態', '標題', '文案', '行動按鈕', '實際落地頁', '各受眾投放紀錄', '歷史成效']) assert.ok(modalText.includes(t), t);
  const land = page.locator('.modal a.landing');
  assert.match(await land.getAttribute('href'), /^https:\/\//);
  assert.equal(await land.getAttribute('target'), '_blank');
  if (!base.startsWith('file:')) {
    // 開新分頁並送出請求（測試環境沒有對外網路，只確認新分頁要求的是落地頁網址）
    const reqs = [];
    page.context().on('request', (r) => reqs.push(r.url()));
    const [popup] = await Promise.all([page.waitForEvent('popup'), land.click()]);
    await popup.waitForLoadState().catch(() => {});
    assert.ok(reqs.some((u) => /example\.com\/test-ebook/.test(u)), '新分頁開啟落地頁');
    await popup.close();
  }
  await page.click('.modal .icon-btn');
  step(`影片可播放（${played.toFixed(1)} 秒）；完整素材含版本、負責人、審核與投放狀態、標題文案 CTA、落地頁（可開啟）`);
  await page.goto(base + '#/');
  await page.waitForSelector('#h-b');

  // 首頁主體列 → 該主體 → 日曆 → 單篇
  // 首頁首屏：兩個精簡摘要
  const sa = await page.locator('#h-sum-a').boundingBox();
  const sb = await page.locator('#h-sum-b').boundingBox();
  if (vname === '桌機') {
    const lastA = await page.locator('.sum-card').first().boundingBox();
    const lastB = await page.locator('.sum-card').nth(1).boundingBox();
    assert.ok(lastA.y + lastA.height <= viewport.height && lastB.y + lastB.height <= viewport.height, '桌機首屏同時看見兩個摘要');
    step('桌機首屏同時看見「日常發文摘要」與「廣告專案摘要」');
  } else {
    assert.ok(sa.y < sb.y, '手機依序排列');
    step('手機依序排列：日常發文摘要 → 廣告專案摘要');
  }
  for (const t of ['預計', '已發', '待發', '逾期', '按讚', '留言', '分享']) assert.ok(await page.locator(`.sum-card:has(#h-sum-a) .sum-label:text-is("${t}")`).count(), t);
  for (const t of ['本期花費', '付費有效名單', '新增報名', '付款']) assert.ok(await page.locator(`.sum-card:has(#h-sum-b) .sum-label:text-is("${t}")`).count(), t);
  assert.ok((await page.locator('.sum-card:has(#h-sum-b)').textContent()).includes('資料：廣告'));

  // 待辦預設 5 項＋範圍說明
  const todoZone = page.locator('section:has(#h-todo)');
  assert.equal(await todoZone.locator('table.todo tbody tr').count(), 5);
  assert.ok((await todoZone.textContent()).includes('全部未完成事項（含跨期'));
  await todoZone.locator('button:has-text("查看全部")').click();
  assert.ok(await todoZone.locator('table.todo tbody tr').count() > 5);
  step('首頁待辦預設 5 項，標示範圍「全部未完成事項（含跨期）」，可查看全部');

  // 招生達成率：資料不完整時不顯示確定數字
  const jcard = page.locator('.proj-card:has-text("Jason 老師合作招生")');
  assert.ok((await jcard.textContent()).includes('已知累計報名'));
  assert.ok((await jcard.textContent()).includes('資料不完整，達成率暫不計算'));
  assert.ok(!/達成 \d/.test(await jcard.textContent()));
  step('首頁：累計報名資料不完整，顯示「已知累計報名」與「達成率暫不計算」');

  // 發文數核對：點數字看明細，筆數一致
  const recon = page.locator('section:has(#h-a) .reconcile');
  for (const k of ['planned', 'published', 'extra']) {
    const link = recon.locator(`a[href$="bucket=${k}"]`).first();
    const n = num(await link.textContent());
    await link.click();
    await page.waitForSelector('.filter-note');
    assert.equal(await page.locator('h2:has-text("貼文清單") .count').textContent().then(num), n, k);
    if (k === 'extra') assert.ok(await page.isVisible('table.data td:has-text("臨時加發")'));
    await page.goto(base + '#/');
    await page.waitForSelector('#h-a');
  }
  step('發文數核對：預計、已發、臨時加發點進清單，筆數與首頁一致');

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
