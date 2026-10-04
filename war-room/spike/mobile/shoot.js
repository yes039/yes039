/* iPhone 直式截圖：NODE_PATH=$(npm root -g) node war-room/spike/mobile/shoot.js <輸出資料夾> */
const path = require("path"), fs = require("fs"), {chromium} = require("playwright");
const out = process.argv[2] || ".", W = path.resolve(__dirname, "../..");
const IPHONE = {viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"};
(async () => {
  const b = await chromium.launch(), errs = [];
  const page = async () => { const c = await b.newContext(IPHONE), p = await c.newPage(); p.on("pageerror", e => errs.push(e.message)); return p; };
  const hscroll = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  // A／B：現有下鑽頁（同一時刻 B 受阻），深色 vs 調亮
  for (const [name, bright] of [["A-dark-current", false], ["B-bright-current", true]]) {
    const p = await page();
    await p.goto("file://" + W + "/drill-spike.html"); await p.waitForTimeout(700);
    await p.evaluate(() => { __drill.jump("B"); document.querySelector(".dev").open = false; });
    if (bright) { await p.addStyleTag({content: fs.readFileSync(W + "/spike/mobile/tone-bright.css", "utf8")}); await p.evaluate(() => { document.body.dataset.tone = "bright"; }); }
    await p.waitForTimeout(400);
    await p.screenshot({path: `${out}/${name}.png`});
    console.log(name, "橫向捲動:", await hscroll(p));
  }
  // C／D：掌上戰情室
  const p = await page();
  await p.goto("file://" + W + "/mobile-spike.html"); await p.waitForTimeout(700);
  await p.screenshot({path: `${out}/C-summary-B-blocked.png`});
  await p.screenshot({path: `${out}/C-summary-B-blocked-full.png`, fullPage: true});
  console.log("C 摘要文字:", (await p.textContent("#summary")).replace(/\s+/g, " "));
  console.log("C 橫向捲動:", await hscroll(p));
  await p.tap("#toggle"); await p.waitForTimeout(500);
  await p.evaluate(() => document.getElementById("full").scrollIntoView({block: "start"}));
  await p.waitForTimeout(300);
  await p.screenshot({path: `${out}/D-full-graph.png`});
  console.log("D 展開後頁面橫向捲動:", await hscroll(p), "｜兵陣條可左右滑:", await p.evaluate(() => { const f = document.getElementById("full"); return f.scrollWidth > f.clientWidth; }));
  // 交貨後的摘要（下一棒）
  await p.tap("#toggle"); await p.evaluate(() => { __mobile.jump("D"); scrollTo(0, 0); }); await p.waitForTimeout(300);
  await p.screenshot({path: `${out}/C-summary-D-delivered.png`, fullPage: true});
  console.log("交貨後摘要:", (await p.textContent("#summary")).replace(/\s+/g, " "));
  console.log("頁面錯誤:", errs.length ? errs : "無");
  await b.close();
})();
