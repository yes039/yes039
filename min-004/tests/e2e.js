/* MIN-004 G1 端對端測試
 * 執行：node min-004/tests/e2e.js [截圖輸出資料夾]
 * 以手機尺寸（390×844）載入 Demo，頁面外層包上與發布環境相同的 HTML skeleton。 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DEMO = path.join(__dirname, '..', 'demo');
const SHOTS = process.argv[2] || null;
const ORIGIN = 'http://demo.local';
const results = [];
let failed = 0;

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: opts.dark ? 'dark' : 'light', isMobile: true, hasTouch: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => {
    errors.push('dialog:' + d.message());
    d.dismiss();
  });
  await page.route(ORIGIN + '/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\//, '') || 'index.html';
    const file = path.join(DEMO, rel);
    if (rel === 'index.html') {
      const body = '<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(file, 'utf8') + '</body></html>';
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    }
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
  });
  await page.goto(ORIGIN + '/index.html' + (opts.hash || ''));
  await page.waitForFunction(() => document.querySelectorAll('#grid .cell').length === 9);
  return { ctx, page, errors };
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const browser = await chromium.launch();
  const copies = {};

  // 1–3 三種店型 Demo
  for (const id of ['salon', 'nail', 'cafe']) {
    const { ctx, page, errors } = await open(browser, { hash: '#' + id });
    const d = await page.evaluate((id) => {
      const ind = MIN004.industries[id];
      return {
        shop: document.querySelector('.store-name').textContent,
        demoShop: ind.demo.shop,
        center: document.querySelectorAll('#grid .cell')[4].dataset.mod,
        steps: document.querySelectorAll('.wf-step').length,
        done: document.querySelectorAll('.wf-step[data-state="done"]').length,
        caseTitle: document.querySelector('#workflow .sec-title').textContent,
        packs: document.querySelectorAll('.packs li').length,
        copy: MIN004.state.out.copy.blocks.map((b) => b.text).join('\n'),
        pains: ind.pains.join(),
        goals: ind.goals.map((g) => g.label).join(),
      };
    }, id);
    copies[id] = d;
    check(`[${id}] 開啟即顯示示範店九宮格`, d.shop === d.demoShop, d.shop);
    check(`[${id}] 九宮格中央是 AI 行銷總監`, d.center === 'director');
    check(`[${id}] 完整示範案例工作流全部完成`, d.steps === 7 && d.done === 7, `${d.done}/${d.steps}・${d.caseTitle}`);
    check(`[${id}] 成果包 4 份可複製`, d.packs === 4);
    await page.waitForFunction(() => (document.querySelector('.card-img') || {}).src?.startsWith('data:image/png'), null, { timeout: 8000 });
    check(`[${id}] 成果卡圖片已產生`, true);

    // 每一格都能點開且有內容
    let allOk = true;
    for (let i = 0; i < 9; i++) {
      await page.locator('#grid .cell').nth(i).click();
      const n = await page.locator('#sheetBody > *').count();
      if (n < 1) allOk = false;
      if (SHOTS && id === 'salon' && i === 3) await page.screenshot({ path: path.join(SHOTS, `salon-sheet-line.png`) });
      await page.keyboard.press('Escape');
    }
    check(`[${id}] 九格都能點開並有示範成果`, allOk && (await page.locator('#sheet').isHidden()));
    check(`[${id}] 手機寬度沒有橫向捲動`, await noHScroll(page));
    if (SHOTS) {
      await page.screenshot({ path: path.join(SHOTS, `${id}-top.png`) });
      await page.screenshot({ path: path.join(SHOTS, `${id}-full.png`), fullPage: true });
    }
    check(`[${id}] 沒有 JS 錯誤`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // 4 產業差異：不只是換店名
  const kw = { salon: /染|髮/, nail: /甲|美甲/, cafe: /咖啡|戚風|下午茶/ };
  for (const id of Object.keys(kw)) {
    const others = Object.keys(kw).filter((x) => x !== id);
    check(`[差異] ${id} 文案有自己的產業語彙`, kw[id].test(copies[id].copy));
    check(`[差異] ${id} 痛點與目標和其他店型不同`, others.every((o) => copies[o].pains !== copies[id].pains && copies[o].goals !== copies[id].goals));
    check(`[差異] ${id} 示範案例不同`, others.every((o) => copies[o].caseTitle !== copies[id].caseTitle));
  }

  // 5 互動：LINE 轉真人、模擬發布、換成我的店完整工作流
  {
    const { ctx, page, errors } = await open(browser, { hash: '#salon' });
    await page.locator('#grid .cell[data-mod="line"]').click();
    await page.locator('#sheetBody .chip', { hasText: '客訴情境' }).click();
    check('[LINE] 客訴情境轉真人接手', await page.locator('#sheetBody .bub.ai[data-handoff="1"]').isVisible());
    await page.locator('#sheetBody .btn-mini', { hasText: '採用並送出' }).first().click();
    check('[LINE] 建議回覆需店員按下才送出（模擬）', (await page.locator('#sheetBody').textContent()).includes('模擬送出（未連 LINE）'));
    await page.keyboard.press('Escape');

    await page.locator('#grid .cell[data-mod="post"]').click();
    await page.locator('#sheetBody .btn-mini', { hasText: '核准・模擬發布' }).first().click();
    check('[PO 文] 模擬發布標示未連平台', (await page.locator('#sheetBody .cal').textContent()).includes('未連平台'));
    await page.keyboard.press('Escape');

    await page.locator('#tryBtn').click();
    await page.locator('#tryFormEl button[type=submit]').click();
    check('[表單] 未填欄位時提示缺什麼', (await page.locator('#formErr').textContent()).includes('店名'));

    await page.locator('#tryFormEl .chip', { hasText: '美甲工作室' }).click();
    await page.fill('#f-shop', '<img src=x>露露美甲');
    await page.locator('#tryFormEl .chips.small').nth(0).locator('.chip').nth(1).click();
    await page.locator('#tryFormEl .chips.small').nth(1).locator('.chip').nth(1).click();
    await page.locator('#tryFormEl input[name=goal][value=holiday]').check();
    if (SHOTS) await page.locator('#tryForm').screenshot({ path: path.join(SHOTS, 'form.png') });
    await page.locator('#tryFormEl button[type=submit]').click();
    await page.waitForFunction(() => document.querySelectorAll('.wf-step[data-state="done"]').length === 7, null, { timeout: 15000 });
    const mine = await page.evaluate(() => ({
      mode: MIN004.state.mode,
      ind: document.body.dataset.industry,
      name: document.querySelector('.store-name').textContent,
      imgs: document.querySelectorAll('#store img').length,
      copy: MIN004.state.out.copy.blocks[0].text,
      badge: document.querySelector('.badge').textContent,
    }));
    check('[我的店] 九宮格換成使用者的店', mine.mode === 'mine' && mine.ind === 'nail' && mine.badge === '你的店');
    check('[我的店] 使用者輸入以純文字顯示（無 HTML 注入）', mine.imgs === 0 && mine.name.includes('<img'));
    check('[我的店] 文案帶入店名、主打與節日目標', mine.copy.includes('露露美甲') && mine.copy.includes('新娘法式美甲') && mine.copy.includes('聖誕'));
    await page.waitForSelector('.packs li');
    await page.locator('.packs .btn-copy').first().click();
    await page.waitForSelector('#toast:not([hidden])');
    check('[成果] 複製文案成功', (await page.locator('#toast').textContent()).includes('已複製'));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'mine-results.png'), fullPage: true });

    await page.locator('#delegate .chip', { hasText: '文案員工' }).click();
    await page.locator('#delegate .chip', { hasText: 'PO 文員工' }).click();
    await page.locator('#delegate .btn-wide').click();
    check('[委派] 選 2 項建議方案 B', (await page.locator('.deleg-result').textContent()).includes('AI 內容製作與 PO 文代管'));
    await page.locator('.next-btn', { hasText: '我想導入整套' }).click();
    check('[轉換] 下一步對應方案 C 並標示', (await page.locator('.next-panel').textContent()).includes('AI 行銷員工整合服務') && (await page.locator('.plan[data-plan="C"]').getAttribute('data-hl')) === '1');
    check('[轉換] 不收集聯絡資料', (await page.locator('.next-panel').textContent()).includes('不收集'));

    const ev = await page.evaluate(() => MIN004.state.events.map((e) => e.event));
    for (const e of ['demo_view', 'grid_cell_open', 'try_start', 'try_submit', 'workflow_complete', 'output_copy', 'delegate_select', 'cta_click'])
      check(`[事件] 記錄 ${e}`, ev.includes(e));
    const leaks = await page.evaluate(() => JSON.stringify(MIN004.state.events).includes('露露'));
    check('[事件] 事件紀錄不含店名等輸入內容', !leaks);
    check('[我的店] 手機寬度沒有橫向捲動', await noHScroll(page));
    check('[我的店] 沒有 JS 錯誤或彈窗', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  // 6 深色模式
  {
    const { ctx, page, errors } = await open(browser, { hash: '#cafe', dark: true });
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('[深色] 背景跟著系統深色', bg === 'rgb(15, 17, 22)', bg);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'cafe-dark.png') });
    check('[深色] 沒有 JS 錯誤', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n${results.length - failed}/${results.length} passed`);
  fs.writeFileSync(path.join(__dirname, 'last-run.json'), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed, total: results.length, results }, null, 2));
  process.exit(failed ? 1 : 0);
})();
