// R-001 G2.1 自動測試（G2-006 既有測試沿用，動線相關選擇器已更新，另加 G2.1 動線測試）：node tests/run-tests.js [截圖輸出資料夾]
// 需要 Node.js 與 Playwright（Chromium）。對象是 ../index.html（模擬資料，不連網）。
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(__dirname, '../index.html');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const R = []; const rec = (group, name, pass, detail = '') => R.push({ group, name, pass: !!pass, detail: String(detail) });

(async () => {
  const b = await chromium.launch();
  const newPage = async (hash = '') => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOTS ? 1 : 1 });
    const p = await ctx.newPage(); p._errs = [];
    p.on('pageerror', e => p._errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') p._errs.push(m.text()) });
    await p.goto(FILE + hash); await p.waitForTimeout(300); return p;
  };
  const sw = p => p.evaluate(() => document.documentElement.scrollWidth);
  const tap = async (p, sel) => { await p.tap(sel); await p.waitForTimeout(80) };
  const shot = async (p, name, full = true) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: full }) };
  const hash = async (p, h) => { await p.evaluate(h => location.hash = h, h); await p.waitForTimeout(80) };

  /* T01 財務公式 */
  {
    const p = await newPage();
    const st = await p.evaluate(() => selfTest());
    rec('T01 財務公式', `自檢 ${st.filter(x => x.pass).length}/${st.length}`, st.every(x => x.pass), st.filter(x => !x.pass).map(x => x.name).join('；'));
    const m = await p.evaluate(() => METRICS.every(x => x[2] && x[3]) && METRICS.length);
    rec('T01 財務公式', `${m} 項指標皆有公式與來源`, m >= 15);
    const noNet = await p.evaluate(() => { location.hash = 'overview'; return new Promise(r => setTimeout(() => r(document.body.innerText), 100)) });
    rec('T01 財務公式', '每日畫面不顯示淨利；營收減食材稱「毛利」', !/預估淨利/.test(noNet) && /毛利/.test(noNet) && !/淨賺\s*\d/.test(noNet));
    await p.context().close();
  }

  /* T02 四店型差異 */
  {
    const p = await newPage();
    const X = await p.evaluate(() => Object.keys(PRESETS).map(id => { const D = build({ ...DEFAULT_PROFILE, preset: id }); return { id, cats: Object.values(D.P.cats).join('/'), rules: D.P.rules.join(','), cases: D.cases.map(c => c.id).sort().join(','), sugg: D.sugg.map(s => s.id).join(','), attach: D.P.attach.label, ing: D.ing.name, chan: D.orders.map(o => (o / D.O).toFixed(2)).join('/'), foodT: D.targets.food, shadow: D.shadow, waste: D.wasteFood, mem: D.mem.type, open: D.P.openDays } }));
    const uniq = k => new Set(X.map(x => x[k])).size;
    rec('T02 四店型', '產品分類各不相同', uniq('cats') === 4, X.map(x => x.cats).join(' | '));
    rec('T02 四店型', '加點指標各不相同', uniq('attach') === 4, X.map(x => x.attach).join('、'));
    rec('T02 四店型', '關鍵食材各不相同', uniq('ing') === 4, X.map(x => x.ing).join('、'));
    rec('T02 四店型', '啟用規則組合不同', uniq('rules') >= 3, X.map(x => x.id + ':' + x.rules).join(' | '));
    rec('T02 四店型', '觸發的異常組合各不相同', uniq('cases') === 4, X.map(x => x.id + ':' + x.cases).join(' | '));
    rec('T02 四店型', 'AI 前三項建議各不相同', uniq('sugg') === 4, X.map(x => x.id + ':' + x.sugg).join(' | '));
    rec('T02 四店型', '渠道結構與食材目標不同', uniq('chan') === 4 && uniq('foodT') === 4, X.map(x => x.chan + '@' + x.foodT).join(' | '));
    rec('T02 四店型', '店型專屬邏輯：麵店隱藏人事、鐵板無報廢、便當團訂', X.find(x => x.id === 'noodle').shadow > 0 && X.find(x => x.id === 'teppan').waste === 0 && X.find(x => x.id === 'bento').mem === 'group');
    await p.context().close();
  }

  /* T03 決策閉環：鐵板熱炒食材決策單走完六步 */
  {
    const p = await newPage();
    await tap(p, '[data-consent="full"]');
    await tap(p, '[data-go="case-food"]'); await shot(p, 'G21-x-Demo決策單-發現問題');
    await tap(p, '[data-cnext="1"]'); await tap(p, '[data-cnext="2"]'); await shot(p, 'G21-x-Demo決策單-規則建議');
    await tap(p, '[data-cnext="3"]'); await tap(p, '[data-cpick="AB"]'); await tap(p, '#cDecide');
    const todos = await p.evaluate(() => S.todos.length);
    await p.check('#ct0'); await p.waitForTimeout(60); await p.check('#ct1'); await p.waitForTimeout(60); await shot(p, 'G21-x-Demo決策單-模擬派工');
    await tap(p, '#cSim'); const v = await p.textContent('.verdict'); await shot(p, 'G21-x-Demo決策單-數據驗收');
    await tap(p, '#cClose');
    const st = await p.evaluate(() => ({ c: cstate('food'), ev: S.events.filter(e => e.type === 'task_complete').map(e => e.feature), done: S.todos.filter(t => t.sid === 'food').every(t => t.done) }));
    rec('T03 決策閉環', '六步可依序完成並結案', st.c.closed && st.c.stage === 5, `驗收：${v.replace(/\s+/g, ' ').trim()}`);
    rec('T03 決策閉環', '決策後執行事項寫入待辦、結案後標記完成', todos >= 3 && st.done, `待辦 ${todos} 項`);
    rec('T03 決策閉環', '結案送出 task_complete（V1.2 已體驗條件）', st.ev.includes('完成一張決策單到數據驗收'));
    const all = await p.evaluate(() => Object.keys(PRESETS).flatMap(id => { const X = build({ ...DEFAULT_PROFILE, preset: id }); return X.cases.filter(c => !c.merged).map(c => ({ id: id + ':' + c.id, ok: c.options.length > 0 && !!c.verify && c.analysis.length > 0 && c.options.every(o => o.tasks.length && o.assumptions.length && Number.isFinite(o.gain(1)) && Number.isFinite(o.after(1))) })) }));
    rec('T03 決策閉環', `四店型共 ${all.length} 張決策單皆有原因、方案、假設、任務與驗收指標`, all.every(x => x.ok), all.filter(x => !x.ok).map(x => x.id).join(','));
    const verd = await p.evaluate(() => { const X = build({ ...DEFAULT_PROFILE }); const c = X.cases.find(x => x.id === 'food'); return c.options.map(o => o.id + ':' + simulate(c, o).verdict).join(' ') });
    rec('T03 決策閉環', '驗收結果有通過／部分達成／未達成之分', /pass/.test(verd) && /(partial|fail)/.test(verd), verd);
    await p.context().close();
  }

  /* T04 AI 可信度 */
  {
    const p = await newPage(); await tap(p, '[data-consent="view"]'); await hash(p, 'ai'); 
    const t = await p.evaluate(() => document.querySelector('#app').innerText);
    rec('T04 AI 可信度', '區分規則／試算／AI 分析三種標示', /固定規則/.test(t) && /情境試算/.test(t) && /尚未串接 AI 模型/.test(t));
    const all = await p.evaluate(() => document.querySelector('#app').innerText + document.querySelector('#app').innerHTML);
    rec('T04 AI 可信度', '不宣稱已完成即時 AI 診斷', !/即時 AI 診斷完成|AI 已分析|AI 判斷/.test(all));
    await p.context().close();
  }

  /* T05 換成我的店（同頁四步，四店型都跑） */
  for (const preset of ['teppan', 'noodle', 'cafe', 'bento']) {
    const p = await newPage(); await tap(p, '[data-consent="full"]');
    const t0 = Date.now(); let taps = 0; const T = async s => { await tap(p, s); taps++ };
    await T('#mainCta'); await T(`[data-wpreset="${preset}"]`); await T('#wzNext');
    await p.fill('#wzName', '阿華的店'); await T('#wzNext');
    await p.$eval('#wzO', el => { el.value = Number(el.value) + 20; el.dispatchEvent(new Event('input', { bubbles: true })) });
    if (preset === 'cafe') await shot(p, 'G21-02c-設定-經營數字');
    await T('#wzNext'); if (preset === 'cafe') await shot(p, 'G21-02d-設定-確認');
    await T('#wzNext');
    const ms = Date.now() - t0;
    const st = await p.evaluate(() => ({ mine: S.mine, showing: S.showing, ev: S.events.filter(e => e.type === 'task_complete').map(e => e.feature), w: document.documentElement.scrollWidth, bar: (document.querySelector('.mine-bar') || {}).innerText || '', hash: location.hash, contactFields: document.querySelectorAll('#lf-report-contact,#lf-booking-contact').length, evName: JSON.stringify(S.events).includes('阿華') }));
    if (preset === 'cafe') await shot(p, 'G21-03-我的九宮格', false);
    rec('T05 換成我的店', `${preset}：同頁 4 步、${taps} 次點擊、回到九宮格顯示個人化結果`, st.mine && st.mine.preset === preset && st.showing === 'mine' && /這是你的餐廳經營模擬/.test(st.bar) && /修改條件/.test(st.bar) && /返回 Demo/.test(st.bar) && st.ev.includes('產生我的九宮格') && st.w <= 390 && st.hash === '', `自動操作 ${ms} ms；${JSON.stringify(st.mine)}`);
    rec('T05 換成我的店', `${preset}：不要求登入或聯絡方式；店名不寫入事件`, st.contactFields === 0 && !st.evName);
    await p.context().close();
  }

  /* G2.1 動線：首頁 → 換成我的店 → 第一個管理情境 → 成果卡（實際點擊次數） */
  for (const preset of ['teppan', 'noodle', 'cafe', 'bento']) {
    const p = await newPage(); const log = []; let taps = 0;
    const T = async (s, label) => { await tap(p, s); taps++; log.push(`${taps}. ${label}`) };
    const first = await p.evaluate(() => { const g = document.getElementById('grid').getBoundingClientRect(), c = document.getElementById('mainCta').getBoundingClientRect(), center = document.getElementById('tile-overview').innerText; return { gridTop: g.top, gridBottom: g.bottom, ctaTop: c.top, ctaBottom: c.bottom, center } });
    if (preset === 'teppan') await shot(p, 'G21-01-首頁Demo-首屏', false);
    await T('[data-consent="full"]', '隱私選擇：同意記錄操作');
    if (preset === 'teppan') await shot(p, 'G21-01b-首頁Demo-同意後', false);
    await T('#mainCta', '30 秒免費體驗｜換成我的店');
    if (preset === 'teppan') await shot(p, 'G21-02a-設定-店型', false);
    await T(`[data-wpreset="${preset}"]`, '選擇店型'); await T('#wzNext', '下一步（店名，選填略過）');
    if (preset === 'teppan') await shot(p, 'G21-02b-設定-店名', false);
    await T('#wzNext', '下一步（經營數字用預設）'); await T('#wzNext', '下一步（確認）'); await T('#wzNext', '開始體驗');
    const guideCase = await p.evaluate(() => S.guide && S.guide.caseId);
    if (preset === 'teppan') await shot(p, 'G21-03b-我的九宮格-導引卡', false);
    await T('#guideStart', '開始處理這個問題'); if (preset === 'teppan') await shot(p, 'G21-04a-導引-發現異常', false);
    await T('[data-cnext="1"]', '分析原因'); if (preset === 'teppan') await shot(p, 'G21-04b-導引-分析原因', false);
    await T('[data-cnext="2"]', '看規則建議'); if (preset === 'teppan') await shot(p, 'G21-04c-導引-規則建議');
    await T('[data-cnext="3"]', '由老闆決定（已預選建議方案）'); if (preset === 'teppan') await shot(p, 'G21-04d-導引-老闆決策');
    await T('#cDecide', '決定採用'); if (preset === 'teppan') await shot(p, 'G21-04e-導引-模擬派工');
    await T('#cSim', '派工並模擬執行 7 天'); if (preset === 'teppan') await shot(p, 'G21-04f-導引-數據驗收');
    await T('#cClose', '完成，看我的管理成果');
    const r = await p.evaluate(() => ({ hash: location.hash, txt: document.querySelector('#app').innerText, ev: S.events.filter(e => e.session_id === S.session).map(e => e.type + ':' + (e.feature || '')), w: document.documentElement.scrollWidth, verdict: (cstate(S.guide.caseId).sim || {}).verdict }));
    if (preset === 'teppan') await shot(p, 'G21-05-成果卡');
    rec('G2.1 動線', `${preset}：首頁到成果卡 ${taps} 次點擊`, r.hash === '#result' && /原來我的店，可以這樣管理！/.test(r.txt) && r.w <= 390, `情境：${guideCase}；驗收 ${r.verdict}；${log.join(' → ')}`);
    rec('G2.1 動線', `${preset}：首屏直接看到九宮格（營收、毛利、營業利益、異常）與主要 CTA`, first.gridTop < 200 && first.ctaBottom <= 844 && /營收/.test(first.center) && /毛利/.test(first.center) && /營業利益/.test(first.center) && /異常/.test(first.center), `九宮格 y=${Math.round(first.gridTop)}–${Math.round(first.gridBottom)}，CTA y=${Math.round(first.ctaTop)}–${Math.round(first.ctaBottom)}`);
    rec('G2.1 動線', `${preset}：成果卡有下一步選擇與可信度標示`, /領取完整經營體檢摘要/.test(r.txt) && /預約專人/.test(r.txt) && /處理下一個問題/.test(r.txt) && /返回 Demo/.test(r.txt) && /未啟用 AI 模型/.test(r.txt));
    rec('G2.1 動線', `${preset}：沿用 V1.2 事件（產生九宮格、決策單結案皆為 task_complete）`, r.ev.includes('task_complete:產生我的九宮格') && r.ev.includes('task_complete:完成一張決策單到數據驗收') && r.ev.every(e => /^(page_open|consent|feature_click|task_complete|consult_click|feedback_submit|booking_submit):/.test(e)));
    if (preset === 'teppan') {
      await tap(p, '#toDemo'); const demo = await p.evaluate(() => ({ s: S.showing, name: D.storeName, mine: !!S.mine }));
      if (preset === 'teppan') await shot(p, 'G21-06-返回Demo', false);
      await tap(p, '#toMine'); await tap(p, '.mine-bar [data-go="mystore"]');
      const mod = await p.evaluate(() => ({ preset: wz.preset, orders: wz.orders, v: document.querySelector('[data-wpreset="teppan"]').getAttribute('aria-pressed') }));
      rec('G2.1 動線', '「返回 Demo」保留我的店；「看我的店」「修改條件」帶回原設定', demo.s === 'demo' && demo.name === '示範小館' && demo.mine && mod.preset === 'teppan' && mod.v === 'true', JSON.stringify({ demo, mod }));
    }
    await p.context().close();
  }

  /* T06 改善價值試算 */
  {
    const p = await newPage(); await tap(p, '[data-consent="full"]'); await hash(p, 'value');
    await p.$eval('#vFood', el => { el.value = 2; el.dispatchEvent(new Event('input', { bubbles: true })) });
    const x = await p.evaluate(() => { const v = valueCalc(); return { ...v, mrev: D.month.rev, ok: v.a === Math.round(D.month.rev * 2 / 100) } });
    const t = await p.evaluate(() => document.querySelector('#app').innerText); 
    rec('T06 改善試算', '三種情境、公式可重算', x.ok && x.total === x.a + x.b + x.c, `食材降 2 點 = 月營收 ${x.mrev} × 2% = ${x.a}`);
    rec('T06 改善試算', '標明假設且不承諾獲利', /不是獲利承諾/.test(t) && /不代表保證獲利/.test(t) && (t.match(/假設/g) || []).length >= 3);
    await p.context().close();
  }

  /* T07 CTA 與推薦歸因 */
  {
    const p = await newPage('#t-HXEZ2JM5KR'); await tap(p, '[data-consent="full"]');
    const tok = await p.evaluate(() => [S.token, location.hash]);
    rec('T07 CTA 與歸因', '讀取夥伴連結碼 #t-…（Artifact）並從網址移除', tok[0] === 'HXEZ2JM5KR' && tok[1] === '', JSON.stringify(tok));
    for (const c of ['report', 'line', 'booking']) { await hash(p, ''); await tap(p, `button.item[data-cta="${c}"]`); }
    await hash(p, 'devlog'); 
    const before = await p.textContent('#attrBox');
    rec('T07 CTA 與歸因', '只開啟／試用不成立推薦', /尚未成立/.test(before));
    await hash(p, 'booking'); await tap(p, '[data-bk="way"][data-v="視訊"]'); await p.fill('#lf-booking-contact', 'line: demo123');
    await tap(p, 'form[data-lead="booking"] button[type=submit]');
    const err = await p.textContent('#lf-booking-err');
    rec('T07 CTA 與歸因', '未勾選同意不能送出聯絡方式', /同意/.test(err));
    await p.check('#lf-booking-ok'); await tap(p, 'form[data-lead="booking"] button[type=submit]'); 
    await hash(p, 'devlog'); 
    const r = await p.evaluate(() => { const mine = S.events.filter(e => e.session_id === S.session); return { attr: attribution(), types: mine.map(e => e.type + (e.feature ? ':' + e.feature : '')), lead: S.leads[S.leads.length - 1] } });
    rec('T07 CTA 與歸因', '三種 CTA 各送一次 consult_click', ['cta_report', 'cta_line', 'cta_booking'].every(f => r.types.includes('consult_click:' + f)), r.types.filter(x => x.startsWith('consult')).join(','));
    rec('T07 CTA 與歸因', '預約送出 booking_submit 並帶連結碼', r.types.includes('booking_submit:booking') && r.lead.token === 'HXEZ2JM5KR' && r.lead.contact.consent);
    rec('T07 CTA 與歸因', '夥伴連結＋聯絡方式＋同意 → 歸因成立 P001、階段「預約洽談」', /歸因成立：P001/.test(r.attr.attr) && r.attr.stage === '預約洽談', r.attr.stage);
    rec('T07 CTA 與歸因', '未完成任務時不標高意向（V1.2：完成任務＋諮詢）', !r.attr.hot);
    await hash(p, 'ai'); await tap(p, '[data-ev]');
    rec('T07 CTA 與歸因', '完成任務後標記高意向', await p.evaluate(() => attribution().hot));
    rec('T07 CTA 與歸因', '事件欄位符合 V1.2 events 表', await p.evaluate(() => S.events.every(e => ['session_id', 'token', 'template_id', 'type', 'feature', 'consent_level', 'internal', 'ts', 'dedup_key'].every(k => k in e) && e.template_id === 'food')));
    await p.context().close();
    // 只看不記錄：功能點擊不記錄，CTA 與表單照常
    const q = await newPage('#t-Q4N8VW2KTD'); await tap(q, '[data-consent="view"]');
    await tap(q, '#tile-food'); await hash(q, ''); await tap(q, 'button.item[data-cta="report"]');
    const ev = await q.evaluate(() => S.events.filter(e => e.session_id === S.session).map(e => e.type));
    rec('T07 CTA 與歸因', '「只看不記錄」：不送 feature_click，CTA 照常', !ev.includes('feature_click') && ev.includes('consult_click'), ev.join(','));
    await q.context().close();
    const z = await newPage('#t-ABCDEFGHJK'); await tap(z, '[data-consent="full"]'); await hash(z, 'devlog');
    rec('T07 CTA 與歸因', '無效連結碼照常顯示、記為匿名', /無效或停用/.test(await z.textContent('#attrBox')));
    await z.context().close();
  }

  /* T08 付費服務 */
  {
    const p = await newPage(); await tap(p, '[data-consent="view"]'); await hash(p, 'plans'); 
    const t = await p.evaluate(() => document.querySelector('#app').innerText);
    rec('T08 服務方案', '三層方案與功能比較、不定價', /免費體驗/.test(t) && /初階導入/.test(t) && /正式經營特助/.test(t) && /價格待總指揮定案/.test(t) && !/NT\$\s*\d|\d+\s*元\/月/.test(t));
    await p.context().close();
  }

  /* 回歸：四店型 × 全部畫面，無錯誤、無水平捲動；G1 功能仍在 */
  {
    const p = await newPage(); await tap(p, '[data-consent="view"]');
    const routes = await p.evaluate(() => [...Object.keys(VIEWS), ...build({ ...DEFAULT_PROFILE }).cases.map(c => 'case-' + c.id)]);
    let bad = [];
    for (const preset of ['teppan', 'noodle', 'cafe', 'bento']) {
      await p.evaluate(pr => { S.mine = { ...DEFAULT_PROFILE, preset: pr, custom: true }; S.showing = 'mine'; S.cases = {}; rebuild(); save() }, preset);
      const rs = await p.evaluate(() => [...Object.keys(VIEWS), ...D.cases.map(c => 'case-' + c.id)]);
      for (const r of rs) { await hash(p, r); const w = await sw(p); if (w > 390) bad.push(preset + '/' + r + ':' + w) }
                            }
    rec('回歸', `4 店型 × ${routes.length} 個畫面無水平捲動`, bad.length === 0, bad.join(' '));
    rec('回歸', '無 JavaScript 錯誤', p._errs.length === 0, p._errs.join(' | '));
    await p.evaluate(() => { S.showing = 'demo'; rebuild(); save() });
    await hash(p, 'amoeba'); await tap(p, '[data-seg="three"]'); await tap(p, '[data-period="month"]'); await p.check('#allocChk'); await p.waitForTimeout(60);
    await tap(p, '[data-period="day"]');
    rec('回歸', 'G1 阿米巴：時段切換、分攤參考、與總覽對帳', /一致/.test(await p.textContent('#app')));
    await hash(p, 'food'); await p.$eval('#ingRange', el => { el.value = 45; el.dispatchEvent(new Event('input', { bubbles: true })) });
    await hash(p, 'labor'); await tap(p, '[data-lsim="1"]');
    await hash(p, 'products'); await tap(p, '[data-sort="low"]');
    rec('回歸', 'G1 試算滑桿、排班試算、排序可用', p._errs.length === 0);
    await hash(p, ''); await tap(p, '#resetBtn'); await tap(p, '#resetYes');
    rec('回歸', '重設模擬資料回到示範店', await p.evaluate(() => S.profile.preset === 'teppan' && !S.profile.custom && D.rev === 53367));
    await hash(p, 'glossary'); rec('回歸', 'G1 舊網址 #glossary、#contact 仍可開啟', /公式與自檢/.test(await p.textContent('.top')));
    await p.context().close();
  }

  /* 網路：模板不得送出任何請求（字型除外） */
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); const req = [];
    p.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.includes('fonts.g')) req.push(u) });
    await p.goto(FILE + '#t-HXEZ2JM5KR'); await p.click('[data-consent="full"]'); await p.waitForTimeout(2300);
    await p.evaluate(() => location.hash = 'booking'); await p.waitForTimeout(100);
    rec('T07 CTA 與歸因', '整個流程沒有對外網路請求（Google 字型除外）', req.length === 0, req.join(' '));
    await ctx.close();
  }

  await b.close();
  const pass = R.filter(r => r.pass).length;
  console.log(JSON.stringify({ pass, total: R.length, results: R }, null, 1));
  process.exit(pass === R.length ? 0 : 1);
})();
