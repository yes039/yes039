/* 掌上戰情室最後驗收（iPhone 直式）：NODE_PATH=$(npm root -g) node war-room/spike/mobile/final-check.js <輸出資料夾> */
const path = require("path"), {chromium} = require("playwright");
const out = process.argv[2] || ".", URL = "file://" + path.resolve(__dirname, "../../mobile-spike.html");
const IPHONE = {viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"};
(async () => {
  const b = await chromium.launch(), errs = [], res = [];
  const ok = (n, c, d) => { res.push(c); console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };
  const p = await (await b.newContext(IPHONE)).newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(700);
  const chips = () => p.$$eval("#summary .chip", cs => cs.map(c => c.textContent.trim()));
  const hscroll = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok("DEV 預設隱藏", !(await p.isVisible(".dev")));
  for (const m of ["A", "B", "C", "D"]) {
    await p.evaluate(m => __mobile.jump(m), m);
    const c = await chips(), text = (await p.evaluate(() => document.getElementById("summary").innerText)).replace(/\s+/g, " ");   // 畫面實際顯示的文字
    const want = {A: ["RUNNING"], B: ["WAITING", "WAITING"], C: ["RUNNING"], D: ["RUNNING", "READY"]}[m];
    ok(`${m} badge 只剩必要的`, JSON.stringify(c) === JSON.stringify(want), c.join(" / "));
    if (m === "B") {
      ok("B 戰役總狀態與卡點各一個 WAITING", c.filter(x => x === "WAITING").length === 2 && text.includes("卡點 製片兵") && text.includes("原因：素材不足，等補件"));
      ok("B 前線、執行部隊改以文字呈現狀態", text.includes("海豹小隊 M003 執行 · WAITING") && text.includes("小隊 WAITING") && text.includes("目前主要兵：製片兵 WAITING"));
      await p.screenshot({path: `${out}/1-summary-blocked.png`});
      ok("B 頁面無左右捲動", !(await hscroll()));
      await p.tap("#toggle"); await p.waitForTimeout(400);
      const f = await p.evaluate(() => { const f = document.getElementById("full"); return {open: !f.hidden, scroll: f.scrollWidth > f.clientWidth, label: document.getElementById("toggle").textContent}; });
      ok("展開完整兵陣，可左右滑動", f.open && f.scroll && f.label.includes("收起"), f.label);
      ok("展開後頁面本身無左右捲動", !(await hscroll()));
      await p.evaluate(() => document.getElementById("full").scrollIntoView({block: "start"})); await p.waitForTimeout(200);
      await p.screenshot({path: `${out}/2-full-graph.png`});
      await p.evaluate(() => scrollTo(0, 0)); await p.tap("#toggle"); await p.waitForTimeout(300);
      ok("收起完整兵陣", await p.evaluate(() => document.getElementById("full").hidden));
    }
    if (m === "D") {
      ok("D 交貨後：已交貨＋小隊收尾以文字呈現＋下一棒", text.includes("✓ 已交貨 → 製片") && text.includes("小隊收尾中（RUNNING）") && text.includes("下一棒 → 審核 READY"));
      await p.screenshot({path: `${out}/3-summary-delivered.png`, fullPage: true});
    }
  }
  const d = await (await b.newContext(IPHONE)).newPage(); await d.goto(URL + "#dev"); await d.waitForTimeout(500);
  ok("#dev 才顯示 DEV", await d.isVisible(".dev"));
  ok("無頁面錯誤", !errs.length, errs.join(";"));
  console.log(`\n${res.filter(Boolean).length}/${res.length} PASS`);
  await b.close(); process.exitCode = res.every(Boolean) ? 0 : 1;
})();
