/* 一致性驗證：同一組事件分別送進 V2 core（瀏覽器）與 Spike 引擎（node），逐步比對 ok 與全部節點狀態。
   NODE_PATH=$(npm root -g) node war-room/spike/v3/parity.js
   C001 比對時拿掉 execution/unit/deliver（V2 core 不認識委派，比的是 V2 規則本身）。 */
const path = require("path"), {chromium} = require("playwright");
const reg = {}; global.WarRoom = {register: c => (reg[c.id] = c)};
require("../../configs/campaign-enroll.js"); require("../../configs/seal-team.js");
const {createEngine} = require("./engine.js");
const P = ids => ids.flatMap(n => [["STARTED", n], ["DONE", n]]);
const SC = {
  "C001-A 異常恢復": ["campaign-enroll", [["TASK_CREATED"], ...P(["goal", "aud", "strat", "plan", "route"]), ["STARTED", "mat"], ["WAITING", "mat"], ["RESUMED", "mat"], ["DONE", "mat"],
    ["STARTED", "prod"], ["FAILED", "prod"], ["STARTED", "prod"], ["DONE", "prod"], ["STARTED", "rev"], ["WAITING", "rev"], ["APPROVED", "rev"], ...P(["pub"])]],
  "C001-B 禁止跳步": ["campaign-enroll", [["TASK_CREATED"], ...P(["goal", "aud", "strat", "plan", "route", "mat"]), ["DONE", "prod"], ["STARTED", "rev"], ["APPROVED", "rev"],
    ["STARTED", "pub"], ["DONE", "pub"], ["STARTED", "lead"], ["DONE", "result"], ["DONE", "lib"]]],
  "C001-C 完整主線": ["campaign-enroll", [["TASK_CREATED"], ...P(["goal", "aud", "strat", "plan", "route", "mat", "prod"]), ["STARTED", "rev"], ["WAITING", "rev"], ["APPROVED", "rev"],
    ...P(["pub", "lead", "result", "lib"]), ["STARTED", "hist"], ["DONE", "hist"]]],
  "SEAL 全流程": ["seal-team", [["TASK_CREATED"], ...P(["src", "mem", "data", "worth", "plan"]), ["STARTED", "tool"], ...P(["h2", "tool", "make", "rend"]),
    ["STARTED", "h4"], ["WAITING", "h4"], ["APPROVED", "h4"], ...P(["judge"]), ["STARTED", "card"], ["FAILED", "card"], ["STARTED", "card"], ["DONE", "card"],
    ["STARTED", "next"], ...P(["post", "h7", "save", "next", "skip"])]],
};
const strip = c => JSON.parse(JSON.stringify(c, (k, v) => ["execution", "unit", "deliver"].includes(k) ? undefined : v));
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  let allSame = true;
  for (const [name, [cfg, steps]] of Object.entries(SC)) {
    await p.goto("about:blank"); await p.goto("file://" + path.resolve(__dirname, "../../index.html") + "#" + cfg); await p.waitForTimeout(400);
    const E = createEngine(strip(reg[cfg]));
    let diffs = 0, rejects = 0;
    for (const [type, node] of steps) {
      const v2 = await p.evaluate(([type, node]) => { const r = WarRoom.emit({type, node}); return {ok: r.ok, nodes: WarRoom.getState().nodes}; }, [type, node]);
      const sp = E.apply(type, node);
      if (!sp.ok) rejects++;
      if (v2.ok !== sp.ok || JSON.stringify(v2.nodes) !== JSON.stringify(E.state)) { diffs++; console.log(`  DIFF ${name} ${type} ${node}`, v2, sp, E.state); }
    }
    allSame = allSame && !diffs;
    console.log(`${diffs ? "FAIL" : "SAME"}  ${name}：${steps.length} 步，逐步比對差異 ${diffs}（其中被拒絕事件 ${rejects} 個，兩邊一致）`);
  }
  await b.close(); process.exitCode = allSame ? 0 : 1;
})();
