/* V3 下鑽 UI 驗收：NODE_PATH=$(npm root -g) node war-room/spike/v3/drill-check.js <截圖資料夾> */
const path = require("path"), {chromium} = require("playwright");
const out = process.argv[2] || ".";
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1012, height: 1260}});
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + path.resolve(__dirname, "../../drill-spike.html")); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelector(".dev").open = false; });
  const results = [];
  const ok = (name, cond, detail) => { results.push({name, pass: !!cond}); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`); };
  // DOM 與引擎是否一致
  const consistent = layer => p.evaluate(layer => {
    const hq = __drill.hq, isM = layer !== "campaign";
    const E = isM ? hq.missions[layer].engine : hq.campaign, root = document.getElementById(isM ? "misRoot" : "campRoot");
    const want = s => "wr-n" + (s === "ACTIVE" ? " hot" : s === "IDLE" ? "" : " st-" + s);
    const gs = root.querySelectorAll("svg g.wr-n");
    const bad = E.config.nodes.filter((n, i) => gs[i].getAttribute("class").replace(" v3-del", "") !== want(E.state[n.id])).map(n => n.id);
    return {bad, status: root.querySelector('[data-k="status"]').textContent, engineStatus: E.status()};
  }, layer);
  const read = () => p.evaluate(() => ({
    note: [...document.querySelectorAll("#campRoot .v3-note")].map(t => t.textContent),
    prod: __drill.hq.campaign.state.prod, rev: __drill.hq.campaign.state.rev, camp: __drill.hq.campaign.status(),
    m: __drill.hq.missions.M003 ? __drill.hq.missions.M003.engine.state : null,
    crumb: document.getElementById("crumb").textContent, view: __drill.view,
    deliverNote: [...document.querySelectorAll("#misRoot .v3-note")].map(t => t.textContent),
  }));
  // 尚未出兵時點製片
  await p.click("#campRoot svg g.wr-n.v3-del");
  ok("尚未出兵時不能下鑽", (await p.evaluate(() => __drill.view)) === "campaign", await p.textContent("#say"));

  for (const [mark, label] of [["A", "剛出兵"], ["B", "海豹受阻"], ["C", "恢復作戰"], ["D", "交貨"]]) {
    await p.evaluate(() => { document.querySelector(".dev").open = true; });
    await p.click(`[data-jump="${mark}"]`);
    await p.evaluate(() => { document.querySelector(".dev").open = false; }); await p.waitForTimeout(300);
    const c = await consistent("campaign"), before = await read();
    // 標記戰役畫面的 DOM，返回後檢查是不是同一個（沒有重新 mount）
    const snapBefore = await p.evaluate(() => { document.querySelector("#campRoot .wr-stage").__keep = 1; return document.querySelector("#campRoot svg").innerHTML + document.querySelector('#campRoot [data-k="counts"]').innerHTML; });
    await p.screenshot({path: `${out}/${mark}-campaign.png`});
    await p.click("#campRoot svg g.wr-n.v3-del"); await p.waitForTimeout(300);
    const m = await consistent("M003"), inside = await read();
    await p.screenshot({path: `${out}/${mark}-mission.png`});
    await p.click("#back"); await p.waitForTimeout(300);
    const after = await p.evaluate(() => ({kept: document.querySelector("#campRoot .wr-stage").__keep === 1, snap: document.querySelector("#campRoot svg").innerHTML + document.querySelector('#campRoot [data-k="counts"]').innerHTML}));
    console.log(`\n── ${mark} ${label}：C001 製片=${before.prod}、審核=${before.rev}、C001=${before.camp}｜摘要：${before.note.join(" / ")}`);
    console.log(`   下鑽：${inside.crumb}｜M003 ${Object.entries(inside.m).filter(([, v]) => v !== "IDLE").map(([k, v]) => k + "=" + v).join(" ")}｜${inside.deliverNote.join(" ")}`);
    ok(`${mark} 戰役層 DOM 與引擎一致`, !c.bad.length && c.status === c.engineStatus, c.bad.join(",") || `STATUS ${c.status}`);
    ok(`${mark} 部隊層 DOM 與引擎一致`, !m.bad.length && m.status === m.engineStatus, m.bad.join(",") || `STATUS ${m.status}`);
    ok(`${mark} 下鑽顯示 breadcrumb`, inside.view === "mission" && inside.crumb.includes("C001 招生戰役 › 製片 › 海豹小隊 M003"));
    ok(`${mark} 返回後戰役層未重新 mount 且狀態相同`, after.kept && after.snap === snapBefore);
    const expect = {
      A: before.prod === "ACTIVE" && inside.m.src === "READY" && /海豹小隊 M003 · .* READY · 0\/\d+/.test(before.note[0]),
      B: before.prod === "WAITING" && inside.m.make === "WAITING" && before.camp === "WAITING" && before.note.some(t => t.includes("素材不足")),
      C: before.prod === "ACTIVE" && inside.m.make === "ACTIVE" && before.note[0].includes("製片兵 ACTIVE"),
      D: before.prod === "DONE" && before.rev === "READY" && inside.m.h4 === "DONE" && before.note[0].includes("已交貨"),
    }[mark];
    ok(`${mark} 戰況符合預期`, expect);
  }
  ok("無頁面錯誤", !errs.length, errs.join(";"));
  await b.close();
  console.log(`\n${results.filter(r => r.pass).length}/${results.length} PASS`);
  process.exitCode = results.every(r => r.pass) ? 0 : 1;
})();
