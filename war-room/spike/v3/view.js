/* V3 DRILL-DOWN UI SPIKE — 只讀顯示轉接層（read-only view adapter）
 *
 * 版面由 V2 core 的 mount() 產生（陣型、節點、連線不變）；本檔只「讀」Spike HQ 的狀態，
 * 把它畫到既有 DOM 上：節點狀態、完成連線、右上 STATUS、底部計數、EVENT LOG，
 * 以及委派節點下方的摘要、交貨點標記。不送事件、不改任何引擎狀態。
 *
 * 已知技術債：這裡複製了 V2 core render() 的顯示格式。正式 V3 應讓 core 的畫面層接受外部狀態。
 */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg", NH = 44;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const pad2 = n => String(n).padStart(2, "0");
  const ORDER = {FAILED: 0, WAITING: 1, ACTIVE: 2, READY: 3};

  function overlay(rootEl) {
    const svg = rootEl.querySelector("svg");
    let g = svg.querySelector("g.v3-ov");
    if (!g) { g = document.createElementNS(NS, "g"); g.setAttribute("class", "v3-ov"); svg.appendChild(g); }
    g.innerHTML = "";
    return g;
  }
  function note(g, rootEl, idx, lines) {
    const n = rootEl.querySelectorAll("svg g.wr-n")[idx];
    const m = /translate\(([\d.]+),([\d.]+)\)/.exec(n.getAttribute("transform"));
    lines.forEach(([text, cls], k) => {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", +m[1] + 2); t.setAttribute("y", +m[2] + NH + 13 + k * 12);
      t.setAttribute("class", "v3-note " + (cls || "")); t.textContent = text;
      g.appendChild(t);
    });
  }

  // 依狀態畫一張圖（格式與 V2 core render 相同）
  function paint(rootEl, config, states, status, logs, totalLabel) {
    const gs = rootEl.querySelectorAll("svg g.wr-n");
    config.nodes.forEach((n, i) => {
      const s = states[n.id], g = gs[i];
      g.setAttribute("class", "wr-n" + (s === "ACTIVE" ? " hot" : s === "IDLE" ? "" : " st-" + s));
      g.querySelector(".tag").textContent = s === "IDLE" ? (n.tag || "") : s;
    });
    const isRes = id => config.nodes.find(n => n.id === id).type === "resource";
    const ok = id => isRes(id) || states[id] === "DONE";
    const wires = rootEl.querySelectorAll("path.wr-wire");
    (config.edges || []).forEach(([a, b], i) => wires[i].classList.toggle("done", ok(a) && ok(b) && !(isRes(a) && isRes(b))));
    const $ = k => rootEl.querySelector(`[data-k="${k}"]`);
    $("status").textContent = status;
    $("hstat").className = "wr-stat s-" + status;
    rootEl.querySelector(".wr-stage").classList.toggle("on", status === "RUNNING");
    const acts = config.nodes.filter(n => !isRes(n.id)), cnt = s => acts.filter(n => states[n.id] === s).length;
    $("prog").style.width = (cnt("DONE") / acts.length * 100) + "%";
    $("prog").classList.toggle("fail", status === "FAILED");
    $("counts").innerHTML = ["READY", "ACTIVE", "WAITING", "DONE", "FAILED"].map(s => `<div class="k-${s}">${s} <b>${pad2(cnt(s))}</b></div>`).join("") +
      `<div class="k-TOTAL">${totalLabel || "DONE / ALL"} <b>${pad2(cnt("DONE"))}/${pad2(acts.length)}</b></div>`;
    $("log").innerHTML = logs.length ? logs.slice(0, 8).map(e => `<div class="${e.ok ? "" : "rej"}"><span>${e.time}</span><b>${esc(e.text)}</b></div>`).join("")
      : `<div class="wr-empty"><span>--:--:--</span><b>no events</b></div>`;
  }

  // 下一棒：由 Campaign graph 推算——委派節點往下游連到的作戰節點（不含資源節點），附目前狀態
  function nextBaton(hq, nodeId) {
    const C = hq.campaign;
    return (C.config.edges || []).filter(([a, b]) => a === nodeId && !C.isRes(b)).map(([, b]) => ({id: b, title: C.byId[b].title || b, state: C.state[b]}));
  }

  // 委派摘要：主要節點＝交貨範圍內 FAILED > WAITING > ACTIVE > READY 的第一個（依 Config 順序）
  function missionSummary(hq, nodeId) {
    const C = hq.campaign, cn = C.byId[nodeId];
    const m = Object.values(hq.missions).find(x => x.node === nodeId);
    const unitCfg = hq.units[cn.unit], unitName = String(unitCfg.name || unitCfg.id).split(" / ").pop();   // 例：SEAL TEAM / 海豹小隊 → 海豹小隊
    if (!m) return {lines: [[`${unitName} · ${C.state[nodeId] === "READY" ? "待出兵（可出兵）" : "待上游完成"}`, "muted"]]};
    const E = m.engine, s = E.state, cfg = E.config;
    const inScope = cfg.nodes.filter(n => m.scope.includes(n.id) && n.type !== "resource");
    const done = inScope.filter(n => s[n.id] === "DONE").length;
    // 外層只回答「離交貨還多遠」：交貨範圍內作戰節點的完成數
    if (m.delivered) {
      const next = nextBaton(hq, nodeId);
      const lines = [[`✓ 已交貨 · ${unitName} ${m.id} · 交貨進度 ${done}/${inScope.length}`, "done"]];
      if (next.length) lines.push([`→ 下一棒：${next.map(n => `${n.title} ${n.state}`).join("、")}`, "next"]);
      return {mission: m, next, lines};
    }
    const main = inScope.filter(n => s[n.id] in ORDER).sort((a, b) => ORDER[s[a.id]] - ORDER[s[b.id]])[0] || E.byId[m.deliver];
    const ms = s[main.id];
    const lines = [[`${unitName} ${m.id} · ${main.title} ${ms} · 交貨進度 ${done}/${inScope.length}`, ms]];
    if (ms === "WAITING" || ms === "FAILED") {
      const last = hq.timeline.slice().reverse().find(x => x.ok && x.ev.mission === m.id && x.ev.node === main.id && x.ev.note);
      if (last) lines.push([`${ms === "WAITING" ? "⏸" : "✕"} ${last.ev.note}`, ms]);
    }
    return {mission: m, lines};
  }

  function paintCampaign(rootEl, hq, logs) {
    const C = hq.campaign, cfg = C.config;
    paint(rootEl, cfg, C.state, C.status(), logs);
    const g = overlay(rootEl);
    cfg.nodes.forEach((n, i) => { if (C.isDel(n.id)) note(g, rootEl, i, missionSummary(hq, n.id).lines.map(([t, c]) => ["▸ " + t, c])); });
  }
  function paintMission(rootEl, hq, missionId, logs) {
    const m = hq.missions[missionId], E = m.engine, cfg = E.config;
    paint(rootEl, cfg, E.state, E.status(), logs, "小隊全程");   // 內層回答「整支部隊跑到哪」
    // Mission 編號由執行期帶入（Unit Config 不寫任務編號），放在標題列的空欄
    let slot = rootEl.querySelector(".wr-hd [data-v3=mission]");
    if (!slot) { slot = [...rootEl.querySelectorAll(".wr-hd > div")].find(d => !d.className && !d.children.length); if (slot) { slot.className = "wr-stat"; slot.dataset.v3 = "mission"; } }
    if (slot) slot.innerHTML = `<span>MISSION</span><b>${esc(m.id)}</b>`;
    const g = overlay(rootEl);
    const i = cfg.nodes.findIndex(n => n.id === m.deliver);
    // 交貨後：貨已交（DELIVERED）與小隊仍在收尾（MISSION STATUS）分開講清楚；只是顯示語意，不是新狀態
    const stage = rootEl.querySelector(".wr-stage");
    rootEl.querySelector('[data-k="hstat"] span').textContent = "MISSION STATUS";
    let bar = stage.querySelector(".v3-deliv");
    if (!bar) { bar = document.createElement("div"); bar.className = "v3-deliv"; bar.hidden = true; stage.querySelector(".wr-crumb").after(bar); }
    const campName = String(hq.campaign.config.header.title).split(" / ")[0], nodeTitle = hq.campaign.byId[m.node].title;
    const wasHidden = bar.hidden;
    if (m.delivered) {
      const next = nextBaton(hq, m.node);
      bar.innerHTML = `<b>DELIVERED → ${esc(campName)} ${esc(nodeTitle)} ✓</b><span>小隊收尾中（不影響戰役）</span>` +
        (next.length ? `<em>${esc(campName)} 下一棒：${esc(next.map(n => `${n.title} ${n.state}`).join("、"))}</em>` : "");
      bar.hidden = false;
    } else bar.hidden = true;
    if (wasHidden !== bar.hidden) dispatchEvent(new Event("resize"));   // 列的有無會改變高度，請 V2 core 重算縮放
    note(g, rootEl, i, [[m.delivered ? `◆ 交貨點 · 已交貨 → ${hq.campaign.byId[m.node].title} DONE` : `◆ 交貨點 → ${hq.campaign.config.header.title.split(" ")[0]} ${hq.campaign.byId[m.node].title}`, m.delivered ? "done" : "deliver"]]);
  }

  // breadcrumb 用：戰役名稱、委派節點、部隊名稱、Mission 編號全部來自同一個執行期來源（HQ）
  function crumb(hq, missionId) {
    const m = hq.missions[missionId], C = hq.campaign, u = hq.units[m.unit];
    return {campaign: String(C.config.header.title).replace(" / ", " "), node: C.byId[m.node].title, unit: String(u.name || u.id).split(" / ").pop(), mission: m.id};
  }
  root.WarRoomV3View = {paintCampaign, paintMission, missionSummary, crumb, nextBaton};
})(typeof globalThis !== "undefined" ? globalThis : this);
