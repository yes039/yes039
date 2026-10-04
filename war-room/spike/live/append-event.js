/* 追加一筆真實事件到戰役紀錄（先重播驗證，通過才寫入）
 * node war-room/spike/live/append-event.js --type STARTED --node order --by Claude \
 *      [--note "原因"] [--evidence "檔案／commit／Shen 回覆原文"] [--file 紀錄路徑] [--config b001]
 * 預設紀錄：war-room/campaigns/B001/events.json
 */
const fs = require("fs"), path = require("path");
const W = path.resolve(__dirname, "../..");
const arg = k => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : undefined; };
const file = path.resolve(arg("file") || path.join(W, "campaigns/B001/events.json"));
const cfgId = arg("config") || "b001";

const reg = {}; global.WarRoom = {register: c => (reg[c.id] = c)};
fs.readdirSync(path.join(W, "configs")).filter(f => f.endsWith(".js")).forEach(f => require(path.join(W, "configs", f)));
const V3 = require(path.join(W, "spike/v3/engine.js")), {replay} = require("./replay.js");
const campaign = reg[cfgId];
if (!campaign) { console.error(`找不到 Config：${cfgId}`); process.exit(1); }

const events = JSON.parse(fs.readFileSync(file, "utf8"));
const before = replay(V3, campaign, events);
if (before.errors.length) { console.error("現有紀錄本身不一致，拒絕追加：\n" + before.errors.join("\n")); process.exit(1); }

const e = {seq: events.length + 1, at: new Date().toISOString(), type: arg("type"), by: arg("by")};
if (arg("node")) e.node = arg("node");
if (arg("note")) e.note = arg("note");
if (arg("evidence")) e.evidence = arg("evidence");
const after = replay(V3, campaign, [...events, e]);
if (after.errors.length) { console.error("未寫入：\n" + after.errors.join("\n")); process.exit(1); }

const next = [...events, e];
fs.writeFileSync(file, "[\n" + next.map(x => "  " + JSON.stringify(x)).join(",\n") + "\n]\n");   // 一筆一行，git diff 好讀
const s = after.hq.campaign;
console.log(`已寫入第 ${e.seq} 筆：${e.type}${e.node ? " " + e.node : ""}｜戰役 ${s.status()}｜` + Object.entries(s.state).map(([k, v]) => `${k}=${v}`).join(" "));
