/* B001 開戰前驗證（不寫入真實紀錄）：NODE_PATH=$(npm root -g) node war-room/spike/live/check-b001.js
 * 1. 真實紀錄（目前 0 筆）：尚未開戰、無演練資料、無亂數面板，重新整理不變
 * 2. 測試紀錄（只在測試瀏覽器內以攔截方式提供，不落地）：WAITING／退回／核可／COMPLETE 各時刻
 *    檢查手機摘要、完整兵陣、引擎重播三者一致，且重新整理後完全相同
 * 3. 不一致的紀錄會顯示錯誤，不會畫出半套
 * 4. append-event.js：合法事件寫入、違規事件拒絕且檔案不變（在暫存副本上測）
 */
const path = require("path"), fs = require("fs"), os = require("os"), {spawn, execFileSync} = require("child_process");
const {chromium} = require("playwright");
const W = path.resolve(__dirname, "../.."), PORT = 8765, URL = `http://127.0.0.1:${PORT}/b001.html`;
const IPHONE = {viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"};
const res = []; const ok = (n, c, d) => { res.push(!!c); console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? " — " + d : ""}`); };

let t = Date.parse("2026-10-04T09:00:00+08:00");
const ev = (type, node, by, note) => { const e = {seq: 0, at: new Date(t += 60000).toISOString(), type, by}; if (node) e.node = node; if (note) e.note = note; return e; };
const SAMPLE = [ev("TASK_CREATED", null, "Shen"),
  ...["order", "intel", "angle", "draft", "check"].flatMap(n => [ev("STARTED", n, "Claude"), ev("DONE", n, "Claude")]),
  ev("STARTED", "approve", "Claude"), ev("WAITING", "approve", "Claude", "定稿送 Shen 核可"),
  ev("RESUMED", "approve", "Shen", "退回：開頭太長"), ev("WAITING", "approve", "Claude", "修改後再送核可"),
  ev("APPROVED", "approve", "Shen"), ev("STARTED", "save", "Claude"), ev("DONE", "save", "Claude")].map((e, i) => ({...e, seq: i + 1}));
const upTo = n => SAMPLE.slice(0, n);

(async () => {
  const srv = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {cwd: W, stdio: "ignore"});
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  try {
    const ctx = await b.newContext(IPHONE), p = await ctx.newPage();
    p.on("pageerror", e => errs.push(e.message));
    let served = null;   // null＝讀真實檔案；陣列＝測試紀錄（攔截，不落地）
    await p.route("**/campaigns/B001/events.json", r => served ? r.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(served)}) : r.continue());
    const read = () => p.evaluate(async () => {
      await __live.ready;
      const C = __live.hq.campaign, want = s => "wr-n" + (s === "ACTIVE" ? " hot" : s === "IDLE" ? "" : " st-" + s);
      const gs = [...document.querySelectorAll("#campRoot svg g.wr-n")];
      return {
        engine: C.state, status: C.status(), errors: __live.errors, n: __live.events.length,
        graphMismatch: C.config.nodes.filter((n, i) => gs[i].getAttribute("class") !== want(C.state[n.id])).map(n => n.id),
        chip: (document.querySelector("#summary .chip") || {}).textContent,
        graphStatus: document.querySelector('#campRoot [data-k="status"]').textContent,
        summary: document.getElementById("summary").innerText.replace(/\s+/g, " "),
        graphLog: document.querySelector('#campRoot [data-k="log"]').innerText.replace(/\s+/g, " "),
        mockVisible: [...document.querySelectorAll("#campRoot .wr-p")].filter(x => x.querySelector(".wr-mock") && x.offsetParent).length,
        text: document.body.innerText,
      };
    });
    const open = async () => { await p.goto(URL); await p.evaluate(() => __live.ready); await p.waitForTimeout(200); };

    // 1｜真實紀錄
    await open(); const r0 = await read();
    ok("真實紀錄目前 0 筆、尚未開戰", r0.n === 0 && !r0.errors.length && r0.summary.includes("尚未開戰") && r0.status === "IDLE", r0.summary.slice(0, 80));
    ok("沒有演練資料（M003／演練腳本）", !/M003|DRILL|演練/.test(r0.text));
    ok("完整兵陣不顯示亂數面板", r0.mockVisible === 0);
    ok("完整兵陣 7 節點全部 IDLE，與引擎一致", !r0.graphMismatch.length && Object.values(r0.engine).every(s => s === "IDLE") && Object.keys(r0.engine).length === 7);
    await p.reload(); await p.evaluate(() => __live.ready); const r0b = await read();
    ok("重新整理後仍是 0 筆、尚未開戰", r0b.summary === r0.summary && r0b.n === 0);
    await p.screenshot({path: path.join(os.tmpdir(), "b001-0-empty.png")});

    // 2｜測試紀錄：各時刻
    const moments = [["開戰後", 1], ["撰寫進行中", 8], ["等待核可", 13], ["退回修改", 14], ["再送核可", 15], ["完成", SAMPLE.length]];
    for (const [label, n] of moments) {
      served = upTo(n); await open(); const a = await read();
      await p.reload(); await p.evaluate(() => __live.ready); const b2 = await read();
      const same = a.summary === b2.summary && a.graphLog === b2.graphLog && JSON.stringify(a.engine) === JSON.stringify(b2.engine);
      ok(`${label}：摘要、完整兵陣、引擎三者一致`, !a.errors.length && !a.graphMismatch.length && a.chip === a.status && a.graphStatus === a.status,
        `戰役 ${a.status}｜` + Object.entries(a.engine).map(([k, v]) => `${k}=${v}`).join(" "));
      ok(`${label}：重新整理後完全相同`, same);
      if (label === "等待核可") ok("等待核可：摘要顯示等待核可與原因", a.summary.includes("等待核可") && a.summary.includes("原因：定稿送 Shen 核可"));
      if (label === "退回修改") ok("退回修改：人工核可回到 ACTIVE，EVENT LOG 留下退回原因", a.engine.approve === "ACTIVE" && a.graphLog.includes("退回：開頭太長"));
      if (label === "完成") { ok("完成：戰役 COMPLETE、7/7 DONE", a.status === "COMPLETE" && Object.values(a.engine).every(s => s === "DONE")); await p.screenshot({path: path.join(os.tmpdir(), "b001-1-complete.png")}); }
    }

    // 3｜不一致的紀錄
    served = [SAMPLE[0], {...SAMPLE[2], seq: 2}]; await open(); const bad = await read();
    ok("不一致紀錄：顯示錯誤，不默默略過", bad.errors.length > 0 && bad.summary.includes("畫面不可採信"), bad.errors[0]);
    served = null;
  } finally { await b.close(); srv.kill(); }

  // 4｜append-event.js（暫存副本）
  const tmp = path.join(os.tmpdir(), "b001-events-test.json"); fs.writeFileSync(tmp, "[]\n");
  const run = (...a) => { try { return {ok: true, out: execFileSync("node", [path.join(__dirname, "append-event.js"), "--file", tmp, ...a], {encoding: "utf8"})}; } catch (e) { return {ok: false, out: String(e.stderr)}; } };
  const r1 = run("--type", "TASK_CREATED", "--by", "Shen"), r2 = run("--type", "STARTED", "--node", "order", "--by", "Claude");
  const before = fs.readFileSync(tmp, "utf8");
  const r3 = run("--type", "DONE", "--node", "intel", "--by", "Claude"), r4 = run("--type", "WAITING", "--node", "order", "--by", "Claude");
  ok("append：合法事件寫入", r1.ok && r2.ok && JSON.parse(fs.readFileSync(tmp, "utf8")).length === 2, r2.out.trim());
  ok("append：跳步事件拒絕且檔案不變", !r3.ok && fs.readFileSync(tmp, "utf8") === before, r3.out.trim().split("\n").pop());
  ok("append：WAITING 沒寫原因被拒", !r4.ok && fs.readFileSync(tmp, "utf8") === before, r4.out.trim().split("\n").pop());

  ok("真實紀錄 events.json 仍是空的（未開戰）", JSON.parse(fs.readFileSync(path.join(W, "campaigns/B001/events.json"), "utf8")).length === 0);
  ok("無頁面錯誤", !errs.length, errs.join(";"));
  console.log(`\n${res.filter(Boolean).length}/${res.length} PASS`);
  process.exitCode = res.every(Boolean) ? 0 : 1;
})();
