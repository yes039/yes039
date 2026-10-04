/* V3 Engine Spike 驗收：node war-room/spike/v3/run-spike.js
   載入真正的 C001 與 SEAL TEAM Config，跑「委派 → 執行 → 交貨」，檢查六項驗收並輸出雙層時間線 timeline.md。 */
const fs = require("fs"), path = require("path");
const reg = {};
global.WarRoom = {register: c => (reg[c.id] = c)};
require("../../configs/campaign-enroll.js");
require("../../configs/seal-team.js");
const {createHQ} = require("./engine.js");

const hq = createHQ({campaign: reg["campaign-enroll"], units: {"seal-team": reg["seal-team"]}});
const C = hq.campaign, T = id => reg["campaign-enroll"].nodes.find(n => n.id === id).title;
const MT = id => reg["seal-team"].nodes.find(n => n.id === id).title;
const checks = [];
const check = (no, name, cond, detail) => checks.push({no, name, pass: !!cond, detail});
const notes = {};
const e = (ev, note) => { const r = hq.emit(ev); if (note) notes[r.seq] = note; return r; };
const camp = (type, node, note) => e({type, node}, note);
const mis = (type, node, note) => e({mission: "M003", type, node}, note);
const pair = ids => ids.forEach(id => { camp("STARTED", id); camp("DONE", id); });
const mpair = ids => ids.forEach(id => { mis("STARTED", id); mis("DONE", id); });

// ── 司令部開戰，推進到配兵
camp("TASK_CREATED", null, "司令部開戰");
pair(["goal", "aud", "strat", "plan", "route"]);
// 驗收 3：製片尚未 READY（素材未完成）不得出兵
const early = e({type: "MISSION_OPENED", node: "prod", mission: "M003"}, "素材未完成就想出兵");
check(3, "不允許提前出兵", !early.ok && C.state.prod === "IDLE", early.reason);
pair(["mat"]);
// 驗收 2：直接對製片送事件必須拒絕
const fakeDone = camp("DONE", "prod", "假交貨：直接報製片完成");
const fakeStart = camp("STARTED", "prod", "繞過海豹直接開工");
check(2, "不允許假交貨", !fakeDone.ok && !fakeStart.ok && C.state.prod === "READY", fakeDone.reason);
// ── 司令部下令，海豹出兵
const open = e({type: "MISSION_OPENED", node: "prod", mission: "M003"}, "司令部下令：製片委派海豹，建立 M003");
const scope = open.ok ? hq.missions.M003.scope : [];
mpair(["src", "worth"]);
mis("STARTED", "skip"); mis("WAITING", "skip", "範圍外節點（退回）卡住");
const outScopeWait = C.state.prod;
mis("RESUMED", "skip"); mis("DONE", "skip");
mis("STARTED", "plan");
// 驗收 1：兩個引擎各自保存狀態（兩邊都有 id 為 plan 的節點）
check(1, "兩個 Engine 同時存在、互不覆蓋",
  C.state.plan === "DONE" && hq.missions.M003.engine.state.plan === "ACTIVE" && C.state.prod === "ACTIVE",
  `C001.plan(企劃)=${C.state.plan}；M003.plan(企劃兵)=${hq.missions.M003.engine.state.plan}`);
mis("DONE", "plan");
// 海豹內部 H2：作戰令送隊長核可（H2 死路已修，必須核可才能配器）
mis("STARTED", "h2");
const toolBeforeH2 = hq.missions.M003.engine.state.tool;
mis("WAITING", "h2", "海豹 H2：作戰令等隊長核可");
const w1 = C.state.prod;
mis("APPROVED", "h2", "隊長核可作戰令（非交貨點）");
const a1 = C.state.prod;
mpair(["tool"]);
mis("STARTED", "make");
mis("WAITING", "make", "海豹受阻：素材不足，等補件");
const w2 = C.state.prod, w2s = C.status();
mis("RESUMED", "make", "補件完成，恢復");
const r2 = C.state.prod;
mis("DONE", "make", "製片兵完成（非交貨點）");
const afterMake = C.state.prod;
mis("STARTED", "rend");
mis("FAILED", "rend", "海豹受阻：成片輸出失敗");
const f3 = C.state.prod, f3s = C.status();
mis("STARTED", "rend", "原地重試");
const r3 = C.state.prod;
mis("DONE", "rend", "成片輸出完成（非交貨點）");
const afterRend = C.state.prod;
check(4, "子任務軍情往上反映",
  w1 === "WAITING" && a1 === "ACTIVE" && w2 === "WAITING" && w2s === "WAITING" && r2 === "ACTIVE" && f3 === "FAILED" && f3s === "FAILED" && r3 === "ACTIVE",
  `H2 等核可→${w1}，核可→${a1}；make WAITING→${w2}（C001 ${w2s}），RESUMED→${r2}；rend FAILED→${f3}（C001 ${f3s}），重試→${r3}`);
// 驗收 5：只有交貨點能完成委派
const dupOpen = e({type: "MISSION_OPENED", node: "prod", mission: "M004"}, "重複出兵");
const h4Skip = mis("DONE", "h4", "交貨點未開工就報完成");
mis("STARTED", "h4");
mis("WAITING", "h4", "成片送隊長 H4 核可");
const w4 = C.state.prod;
const revBefore = C.state.rev;
mis("APPROVED", "h4", "H4 核可＝交貨");
check(5, "只有交貨點能完成委派",
  afterMake === "ACTIVE" && afterRend === "ACTIVE" && a1 === "ACTIVE" && outScopeWait === "ACTIVE" && !h4Skip.ok && !dupOpen.ok && w4 === "WAITING" && revBefore === "IDLE" && C.state.prod === "DONE",
  `範圍外「退回」WAITING 時製片=${outScopeWait}；make DONE 後製片=${afterMake}、rend DONE 後=${afterRend}、h2 APPROVED 後=${a1}；h4 未開工 DONE 被拒；H4 APPROVED 後製片=${C.state.prod}`);
// 驗收 6：交貨後兩層脫鉤
const revAfter = C.state.rev;
camp("STARTED", "rev"); camp("WAITING", "rev", "司令部審核：成片＋報名資訊"); camp("APPROVED", "rev", "司令部核可，繼續推進");
mpair(["post"]);
mis("STARTED", "h7");
mis("FAILED", "h7", "交貨後：海豹讀數據失敗");
const prodAfterMissionFail = C.state.prod, campAfterMissionFail = C.status();
mis("STARTED", "h7"); mis("DONE", "h7");
mpair(["judge", "card"]);
pair(["pub", "lead", "result", "lib"]);
check(6, "交貨之後兩層脫鉤",
  revAfter === "READY" && prodAfterMissionFail === "DONE" && campAfterMissionFail !== "FAILED" && C.state.prod === "DONE",
  `交貨當下 審核=${revAfter}；交貨後 M003.h7 FAILED 時 製片=${prodAfterMissionFail}、C001=${campAfterMissionFail}`);
check("S", "交貨範圍不含下游", scope.length && !["post", "h7", "judge", "card", "save", "next", "skip"].some(id => scope.includes(id)), "範圍：" + scope.map(MT).join("、"));
check("H2", "SEAL H2 死路已修", toolBeforeH2 === "IDLE", `企劃兵 DONE 後、H2 核可前，選器=${toolBeforeH2}`);

// ── 輸出
const short = s => ({IDLE: "IDLE", READY: "READY", ACTIVE: "ACTIVE", WAITING: "WAITING", DONE: "DONE", FAILED: "FAILED", RESOURCE: "RES", "—": "—"}[s] || s);
const fmtCh = (ch, title) => ch.map(([k, a, b]) => `${title(k)} ${short(a)}→${short(b)}`).join("；") || "";
const clock = i => { const t = 9 * 60 + i; return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
const evText = x => x.ev.type === "MISSION_OPENED" ? `MISSION_OPENED 製片 → ${x.ev.mission}` : `${x.ev.type}${x.ev.node ? " " + (x.ev.mission ? MT(x.ev.node) : T(x.ev.node)) : ""}`;
let md = `# V3 Engine Spike：雙層時間線（C001 ⇄ SEAL TEAM M003）

- 時間為**模擬時鐘**（每個事件 +1 分），不是真實時間。
- 層：C001＝司令部（Campaign 引擎），M003＝海豹小隊任務（Mission 引擎），HQ＝出兵指令。
- 「C001.製片」欄是委派節點的狀態，只由 M003 交貨範圍推算：${scope.map(MT).join("、")}（交貨點：成片核可 h4）。

| # | 時間 | 層 | 事件 | 結果 | C001 狀態變化 | M003 狀態變化 | C001.製片 | C001 | M003 | 說明 |
|---|---|---|---|---|---|---|---|---|---|---|
`;
let prod = "IDLE";
hq.timeline.forEach((x, i) => {
  const c = x.campaignChanges.find(c => c[0] === "prod"); if (c) prod = c[2];   // 每一步之後 C001.製片 的實際狀態
  const mch = x.missionChanges.M003 || [];
  const mText = x.ev.type === "MISSION_OPENED" && x.ok
    ? "開戰：" + Object.entries(x.missionState.M003).filter(([, v]) => v === "READY").map(([k]) => MT(k)).join("、") + " READY"
    : fmtCh(mch, MT);
  md += `| ${x.seq} | ${clock(i)} | ${x.scope === "campaign-enroll" ? "C001" : x.scope} | ${evText(x)} | ${x.ok ? "✓" : "✕ " + x.reason} | ${fmtCh(x.campaignChanges, T)} | ${mText} | ${prod} | ${x.campaignStatus} | ${x.missionStatus.M003 || "—"} | ${notes[x.seq] || ""} |\n`;
});
md += `\n## 驗收結果\n\n| # | 項目 | 結果 | 依據 |\n|---|---|---|---|\n` + checks.map(c => `| ${c.no} | ${c.name} | ${c.pass ? "✅ PASS" : "❌ FAIL"} | ${c.detail || ""} |`).join("\n") + "\n";
md += `\n## 最終狀態\n\n- C001：${C.status()}｜` + Object.entries(C.state).map(([k, v]) => `${T(k)}=${v}`).join("、") +
      `\n- M003：${hq.missions.M003.engine.status()}｜` + Object.entries(hq.missions.M003.engine.state).map(([k, v]) => `${MT(k)}=${v}`).join("、") + "\n";
fs.writeFileSync(path.join(__dirname, "timeline.md"), md);
checks.forEach(c => console.log(`${c.pass ? "PASS" : "FAIL"}  [${c.no}] ${c.name} — ${c.detail}`));
console.log(`\nC001 ${C.status()} / M003 ${hq.missions.M003.engine.status()}；時間線 ${hq.timeline.length} 筆 → war-room/spike/v3/timeline.md`);
process.exitCode = checks.every(c => c.pass) ? 0 : 1;
