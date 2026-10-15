// 介面操作測試：新增專案 → 活動 → 素材 → 追蹤連結 → 領取碼 → 人工登錄 → CSV 匯入 → 切換專案
// 用法：node scripts/e2e.mjs [網址]（需先啟動 dev server）
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const base = process.argv[2] || 'http://localhost:8787/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const step = (s) => console.log('✓ ' + s);

await page.goto(base + '#/new');
await page.fill('#f-code', 'ETE');
await page.fill('#f-claim_prefix', 'E');
await page.fill('#f-name', '【測試】E2E 自有課程');
await page.selectOption('#f-kind', '自有課程');
await page.fill('#f-budget', '10000');
await page.check('#f-is_test');
await page.uncheck('#m_on_enroll');
await page.click('button:has-text("建立專案")');
await page.waitForURL(/#\/p\/.+\/settings/);
await page.waitForSelector('h1:has-text("E2E 自有課程")');
step('新增專案，並取消「報名」指標');

const pid = page.url().split('#/p/')[1].split('/')[0];
await page.goto(base + `#/p/${pid}/campaigns`);
await page.click('button:has-text("新增活動")');
await page.fill('#f-name', '第一波');
await page.fill('#f-start_date', '2026-10-01');
await page.fill('#f-end_date', '2026-10-31');
await page.fill('#f-budget', '8000');
await page.fill('#f-target_cpl', '200');
await page.click('.modal button:has-text("儲存")');
await page.waitForURL(/#\/c\//);
await page.waitForSelector('h1:has-text("第一波")');
const code = (await page.textContent('.sub .proj-code')).trim();
assert.match(code, /^ETE-\d{4}-01$/);
step('新增活動，自動帶入活動代碼 ' + code);

await page.click('button:has-text("新增素材／渠道")');
await page.selectOption('#f-format', 'IM');
await page.fill('#f-name', '圖片廣告');
await page.click('.modal button:has-text("儲存")');
await page.waitForSelector(`td:has-text("${code}-IM01-v1")`);
step('新增 FB 廣告素材 ' + code + '-IM01-v1');

await page.click('button:has-text("產生連結")');
await page.selectOption('#f-creative_id', { index: 1 });
await page.fill('#f-base_url', 'https://example.com/e2e');
await page.click('.modal button:has-text("產生")');
await page.waitForSelector('code:has-text("utm_content=' + code.toLowerCase() + '-im01-v1")');
step('產生追蹤連結（UTM 小寫）');

await page.click('button:has-text("新增領取碼")');
await page.click('.modal button:has-text("儲存")');
await page.waitForSelector('code.big:has-text("E101")');
step('新增領取碼 E101');

await page.goto(base + `#/p/${pid}/entry`);
await page.fill('#f-date >> nth=0', '2026-10-01');
await page.fill('#f-spend', '1200');
await page.fill('#f-impressions', '15000');
await page.fill('#f-link_clicks', '210');
await page.click('form >> nth=0 >> button:has-text("登錄")');
await page.waitForSelector('.ok-box:has-text("已登錄廣告數字")');
step('人工登錄廣告數字');

const csv = ['類型,日期,活動代碼,素材代碼,領取碼,數量,金額,外部編號,電話,Email,備註',
  `名單,2026-10-02,,,E101,1,,,0911000001,,`,
  `有效名單,2026-10-02,,,E101,1,,,0911000001,,`,
  `報名,2026-10-03,${code},,,1,,R1,0911000001,,`,
  `付款,2026-10-03,${code},,,1,5000,P1,0911000001,,`].join('\n');
await page.selectOption('#import-kind', 'outcomes');
await page.fill('#import-text', csv);
await page.click('button:has-text("預覽與檢查")');
await page.waitForSelector('.preview');
assert.ok(await page.isVisible('td:has-text("本專案未定義「報名」這個指標")'));
await page.check('#import-skip');
await page.click('button:has-text("確認匯入")');
await page.waitForSelector('.ok-box:has-text("新增 3")');
step('成果 CSV 匯入：未定義的「報名」被擋下，其餘 3 列匯入');

await page.selectOption('#period-select', 'm:2026-10');
await page.goto(base + `#/p/${pid}/campaigns`);
await page.waitForSelector('h1');
const kpi = await page.textContent('.kpis');
assert.ok(kpi.includes('NT$1,200'), '花費應為 1,200');
assert.ok(!kpi.includes('報名'), '報名指標已取消，不應出現');
step('曆月 2026-10：花費 NT$1,200，報名指標不顯示');

await page.selectOption('#project-switch', 'test-proj-yxz');
await page.waitForSelector('h1:has-text("玉欣珍會員活化")');
assert.ok((await page.textContent('.kpis')).includes('本專案尚未定義成果指標'));
step('切換到玉欣珍專案：成果顯示「本專案尚未定義」，不混入其他專案');

await page.selectOption('#project-switch', '');
await page.waitForSelector('h1:has-text("宣傳總覽")');
assert.equal(await page.locator('.proj-card').count(), 3);
step('回到總覽：3 個專案各自一張卡');

await browser.close();
if (errors.length) { console.error('瀏覽器錯誤：', errors); process.exit(1); }
console.log('介面操作測試全部通過');
