/* 作戰室母體（War Room Core）— EVENT ENGINE V2
 *
 * 三者分離：
 *   CONFIG     = 裝誰：節點、連線、哪個節點接哪種事件（eventMap）
 *   EVENT      = 發生什麼：只有 emit(event) 能改變流程狀態
 *   WAR ROOM   = 讓人看見：把狀態畫出來，事件來了才跑一次光流
 *
 * 沒有 Event，流程不前進。V2：每個節點自己的狀態；路過 ≠ 完成；異常可原地恢復。
 *底部 SIGNALS / DECISIONS / HEAT MAP / REACH 是標示 MOCK 的展示數據，
 * 跟流程狀態完全隔離。Config 格式見 war-room/README.md。
 */
(function () {
  "use strict";

  const STAGES = ["INPUT", "DISCOVER", "JUDGE", "ROUTE", "RUN", "VERIFY", "SAVE"];
  // V2：每個節點有自己的狀態，只能由「指名這個節點」的事件改變
  //   IDLE    上游尚未完成，還不能開始
  //   READY   上游已完成，可以開始
  //   ACTIVE  進行中
  //   WAITING 卡住，等外部（補件、審核）；原地等待，不影響其他節點
  //   DONE    收到自己的完成事件（DONE 或 APPROVED）才會是 DONE
  //   FAILED  失敗；可以原地重新 STARTED
  const NODE_STATES = ["IDLE", "READY", "ACTIVE", "WAITING", "DONE", "FAILED"];

  // 節點事件：from = 允許的目前狀態，to = 之後狀態
  const EVENTS = {
    TASK_CREATED: {from: null, to: null},            // 開戰：全部重置，沒有上游的節點變 READY
    STARTED:  {from: ["READY", "FAILED"], to: "ACTIVE"},   // FAILED → STARTED = 原地重試
    WAITING:  {from: ["ACTIVE"], to: "WAITING"},           // 例：素材不足等補件、送審等核可
    RESUMED:  {from: ["WAITING"], to: "ACTIVE"},           // 例：補件完成，回到進行中
    APPROVED: {from: ["WAITING"], to: "DONE"},             // 人工核可＝這個節點的完成事件
    DONE:     {from: ["ACTIVE"], to: "DONE"},
    FAILED:   {from: ["ACTIVE", "WAITING"], to: "FAILED"},
  };
  const EVENT_TYPES = Object.keys(EVENTS);

  // 畫布幾何
  const CW = 980, NW = 136, NH = 44, ROW = 104, TOP = 20, LEFT = 120, RIGHT = 960;
  const CH = TOP + ROW * (STAGES.length - 1) + NH + 24;
  const PULSE_MS = 700, PULSE_GAP = 420;

  const NS = "http://www.w3.org/2000/svg";
  const registry = {};
  let current = null;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad2 = n => String(n).padStart(2, "0");
  const fmt = s => pad2(Math.floor(s / 60) % 60) + ":" + pad2(Math.floor(s) % 60);
  const clock = d => [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad2).join(":");
  const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
  function svg(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------- 驗證 ----------
  function validate(c) {
    const errs = [];
    if (!c || typeof c !== "object") return ["Config 不是物件"];
    if (!c.id) errs.push("缺少 id");
    if (!Array.isArray(c.nodes) || !c.nodes.length) errs.push("nodes 至少要有 1 個節點");
    const ids = new Set(), perStage = {};
    (c.nodes || []).forEach((n, i) => {
      if (!n.id) errs.push(`nodes[${i}] 缺少 id`);
      else if (ids.has(n.id)) errs.push(`節點 id 重複：${n.id}`);
      ids.add(n.id);
      if (!STAGES.includes(n.stage)) errs.push(`節點 ${n.id} 的 stage「${n.stage}」不在 ${STAGES.join(" / ")}`);
      if (n.type != null && n.type !== "action" && n.type !== "resource") errs.push(`節點 ${n.id} 的 type「${n.type}」只能是 action 或 resource`);
      if ("state" in n) errs.push(`節點 ${n.id} 寫了 state：狀態只能由 Event 決定，Config 不可寫`);
      perStage[n.stage] = (perStage[n.stage] || 0) + 1;
    });
    for (const s in perStage) if (perStage[s] > 6) errs.push(`${s} 有 ${perStage[s]} 個節點，每段最多 6 個`);
    (c.edges || []).forEach((e, i) => {
      if (!Array.isArray(e) || e.length < 2) errs.push(`edges[${i}] 格式應為 [from, to]`);
      else e.slice(0, 2).forEach(id => { if (!ids.has(id)) errs.push(`edges[${i}] 指向不存在的節點：${id}`); });
    });
    if ("route" in c || "events" in c) errs.push("route / events 已移除：流程只能由 Event 推進");
    // eventMap 是 V0.1 欄位，V2 事件一律指名節點，保留不報錯也不使用
    if (c.header && c.header.stats && c.header.stats.length > 3) errs.push("header.stats 最多 3 個");
    return errs;
  }

  // ---------- 排版 ----------
  function layout(nodes) {
    const pos = {};
    STAGES.forEach((stage, row) => {
      const list = nodes.filter(n => n.stage === stage);
      const span = (RIGHT - LEFT) / Math.max(list.length, 1);
      list.forEach((n, j) => { pos[n.id] = {x: Math.round(LEFT + span * (j + .5) - NW / 2), y: TOP + row * ROW, row}; });
    });
    return pos;
  }
  function edgePath(A, B) {
    const a = {cx: A.x + NW / 2, cy: A.y + NH / 2, top: A.y, bot: A.y + NH, l: A.x, r: A.x + NW};
    const b = {cx: B.x + NW / 2, cy: B.y + NH / 2, top: B.y, bot: B.y + NH, l: B.x, r: B.x + NW};
    if (A.row === B.row) {
      const toR = b.cx > a.cx, x1 = toR ? a.r : a.l, x2 = toR ? b.l : b.r, m = (x1 + x2) / 2;
      return `M${x1},${a.cy} C${m},${a.cy - 18} ${m},${b.cy + 18} ${x2},${b.cy}`;
    }
    if (B.row < A.row) {
      const gx = Math.min(CW - 8, Math.max(a.r, b.r) + 60);
      return `M${a.r},${a.cy} C${gx},${a.cy} ${gx},${b.cy} ${b.r},${b.cy}`;
    }
    const dy = (b.top - a.bot) * .55;
    return `M${a.cx},${a.bot} C${a.cx},${a.bot + dy} ${b.cx},${b.top - dy} ${b.cx},${b.top}`;
  }

  // ---------- 裝填 ----------
  function mount(root, config) {
    if (root.__wr) root.__wr.destroy();
    root.classList.add("wr");
    root.innerHTML = "";
    const errs = validate(config);
    if (errs.length) {
      root.innerHTML = `<div class="wr-stage" style="width:auto"><div class="wr-err"><b>裝填失敗：Config 有 ${errs.length} 個問題</b>${errs.map(esc).join("<br>")}</div></div>`;
      console.error("[WarRoom] 裝填失敗", errs);
      const api = {destroy() {}, emit: () => ({ok: false, reason: "Config 裝填失敗"}), getState: () => null};
      root.__wr = api;
      current = api;
      return api;
    }

    const c = config, h = c.header || {}, p = c.panels || {}, labels = c.stageLabels || {};
    const nodes = c.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const pos = layout(nodes);
    const stats = (h.stats || []).slice(0, 3);
    const sig = p.signals || {}, dec = p.decisions || {}, reach = p.reach || {}, ros = p.roster || {};
    const sigLabels = (sig.labels && sig.labels.length ? sig.labels : ["01", "02", "03", "04", "05", "06", "07"]).slice(0, 7);
    const MOCK = `<span class="wr-mock">MOCK</span>`;

    const stage = document.createElement("div");
    stage.className = "wr-stage";
    stage.innerHTML = `
      <header class="wr-hd">
        <div class="wr-brand"><b>${esc(h.title || c.id)}</b><small>${esc(h.tagline || "")}</small></div>
        <div class="wr-live">${esc(h.flowLabel || "// AGENT FLOW : LIVE")}</div>
        <div class="wr-stat"><span>TASK TIME</span><b data-k="time">00:00</b></div>
        ${[0, 1, 2].map(i => stats[i] ? `<div class="wr-stat"><span>${esc(stats[i].label)}</span><b>${esc(stats[i].value)}</b></div>` : "<div></div>").join("")}
        <div class="wr-stat" data-k="hstat"><span>STATUS</span><b data-k="status">IDLE</b></div>
        <div class="wr-dot" aria-hidden="true"></div>
      </header>
      <div class="wr-prog"><i data-k="prog"></i></div>
      <div class="wr-crumb"><span>${STAGES.map(s => esc(s) + (labels[s] ? ` <i>${esc(labels[s])}</i>` : "")).join(" &gt; ")}</span><em>${esc(c.loopLabel || "ONE LOOP")}</em></div>
      <svg viewBox="0 0 ${CW} ${CH}" height="${CH}" role="img" aria-label="${esc((h.title || c.id) + " 流程圖")}">
        <defs><filter id="wr-glow-${esc(c.id)}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g data-k="grid"></g><g data-k="wires"></g><g data-k="streaks"></g><g data-k="pts"></g><g data-k="nodes"></g>
      </svg>
      <section class="wr-pn">
        <div class="wr-p"><h4>// ${esc((p.log && p.log.title) || "EVENT LOG")}</h4><div class="wr-log" data-k="log"><div class="wr-empty"><span>--:--:--</span><b>no events</b></div></div></div>
        <div class="wr-p"><h4>// ${esc(sig.title || "SIGNALS")} ${MOCK}</h4><div class="wr-bars" data-k="bars"></div></div>
        <div class="wr-p"><h4>// ${esc(dec.title || "DECISIONS")} ${MOCK}</h4><div class="wr-big" data-k="pct">0%</div><div class="wr-cap">${esc(dec.caption || "checked")}</div><div class="wr-cap a" data-k="d1"></div><div class="wr-cap a" data-k="d2"></div></div>
        <div class="wr-p"><h4>// ${esc((p.heat && p.heat.title) || "HEAT MAP")} ${MOCK}</h4><div class="wr-heat" data-k="heat"></div></div>
        <div class="wr-p"><h4>// ${esc(reach.title || "REACH")} ${MOCK}</h4><div class="wr-big r" data-k="reach">00</div><div class="wr-cap">${esc(reach.caption || "signals found")}</div><div class="wr-cap a" data-k="loops"></div><div class="wr-cap">${esc(reach.foot || "")}</div></div>
        <div class="wr-p wr-ros"><h4>// ${esc(ros.title || "ROSTER")}</h4>${(ros.items || []).slice(0, 4).map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join("")}</div>
        <div class="wr-p wr-st"><h4>// ${esc((p.status && p.status.title) || "STATUS")}</h4><div class="wr-cnt" data-k="counts"></div></div>
      </section>
      <div class="wr-ft"><span>${esc((c.footer || [])[0] || "")}</span><span>MOCK = DEMO DATA · FLOW = EVENTS ONLY</span></div>`;
    root.appendChild(stage);
    const $ = k => stage.querySelector(`[data-k="${k}"]`);

    // 格線與 7 段泳道標籤
    const grid = $("grid");
    for (let y = 30; y < CH; y += 30) svg("line", {x1: 0, x2: CW, y1: y, y2: y, class: "wr-gl"}, grid);
    for (let x = 40; x < CW; x += 40) svg("line", {x1: x, x2: x, y1: 0, y2: CH, class: "wr-gl", opacity: .5}, grid);
    STAGES.forEach((s, i) => {
      const y = TOP + i * ROW + 20;
      svg("text", {x: 8, y, class: "wr-lane"}, grid, `${pad2(i + 1)} / ${s}`);
      if (labels[s]) svg("text", {x: 8, y: y + 14, class: "wr-lane2"}, grid, labels[s]);
    });

    // 連線：靜止時只有線和固定光點；光帶與流動光點只在事件發生時跑一次
    const glow = `url(#wr-glow-${c.id})`;
    const edges = (c.edges || []).map(([from, to], i) => {
      const d = edgePath(pos[from], pos[to]);
      const pth = svg("path", {d, class: "wr-wire"}, $("wires"));
      svg("path", {d, class: "wr-wire2", transform: `translate(${i % 2 ? 3 : -3},0)`}, $("wires"));
      const len = pth.getTotalLength(), seg = Math.min(46, len * .3);
      [.3, .7].forEach(f => { const q = pth.getPointAtLength(len * f); svg("circle", {r: 1.6, class: "wr-pt fixed", cx: q.x, cy: q.y}, $("pts")); });
      const st = svg("path", {d, class: "wr-streak", filter: glow, "stroke-dasharray": `${seg} ${len + seg}`, "stroke-dashoffset": seg}, $("streaks"));
      const mv = [0, 1].map(() => svg("circle", {r: 2, class: "wr-pt mv"}, $("pts")));
      return {from, to, p: pth, len, seg, st, mv};
    });
    const out = {}, inc = {};
    edges.forEach((e, i) => { (out[e.from] = out[e.from] || []).push(i); (inc[e.to] = inc[e.to] || []).push(i); });

    // 節點
    const nodeEls = {};
    nodes.forEach(n => {
      const q = pos[n.id];
      const g = svg("g", {class: "wr-n", transform: `translate(${q.x},${q.y})`}, $("nodes"));
      svg("rect", {class: "box", width: NW, height: NH, rx: 3}, g);
      svg("rect", {class: "ico", x: 8, y: 8, width: 11, height: 11, rx: 2}, g);
      svg("circle", {class: "hole", cx: 13.5, cy: 13.5, r: 2.3}, g);
      const t = svg("text", {class: "t", x: 25, y: 18}, g, n.title || n.id);
      const tg = svg("text", {class: "tag", x: NW - 8, y: 17, "text-anchor": "end"}, g, n.tag || "");
      // 標題太長時先縮字，再截斷，避免壓到右上角標籤（以最長的狀態字 WAITING 預留空間）
      const room = NW - 25 - 8 - Math.max(tg.getComputedTextLength(), 34) - 6;
      for (let fs = 11.5; fs >= 9 && t.getComputedTextLength() > room; fs -= .5) t.style.fontSize = fs + "px";
      while (t.getComputedTextLength() > room && t.textContent.length > 2) t.textContent = t.textContent.slice(0, -2) + "…";
      svg("text", {class: "s", x: 9, y: 35}, g, n.sub || "");
      svg("title", {}, g, `${n.stage} — ${n.title || n.id}`);
      nodeEls[n.id] = {g, tg};
    });

    // ===== EVENT ENGINE V2：每個節點自己的狀態機 =====
    // 規則：事件只作用在它指名的那一個節點；光流只代表訊號傳到下一個節點，路過 ≠ 完成。
    // 開始條件：任一條進來的連線，其來源節點已 DONE（沒有進來連線的節點，開戰即 READY）。
    // 戰役完成：SAVE 段的節點全部 DONE。
    // 節點類型：action（作戰節點，走狀態機）／resource（資源節點：外部資料或記憶，不需要完成）
    const isRes = id => byId[id].type === "resource";
    const actions = nodes.filter(n => !isRes(n.id));
    const actInc = id => (inc[id] || []).filter(i => !isRes(edges[i].from)); // 開始條件只看作戰節點
    const finish = actions.filter(n => n.stage === "SAVE").map(n => n.id);
    const state = {started: false, startedAt: null, endedAt: null, nodes: {}, log: []};
    nodes.forEach(n => { state.nodes[n.id] = isRes(n.id) ? "RESOURCE" : "IDLE"; });

    function setNode(id, s) {
      state.nodes[id] = s;
      const {g, tg} = nodeEls[id];
      g.setAttribute("class", "wr-n" + (s === "ACTIVE" ? " hot" : s === "IDLE" ? "" : " st-" + s));
      if (s === "RESOURCE") { tg.textContent = "RESOURCE"; return; }
      tg.textContent = s === "IDLE" ? (byId[id].tag || "") : s;
    }
    function refreshEdges() { // 兩端都完成的連線＝這段真的走完了（資源端視為已就緒）
      const ok = id => isRes(id) || state.nodes[id] === "DONE";
      edges.forEach(e => e.p.classList.toggle("done", ok(e.from) && ok(e.to) && !(isRes(e.from) && isRes(e.to))));
    }
    const upstreamDone = id => actInc(id).some(i => state.nodes[edges[i].from] === "DONE");
    function campaign() {
      if (!state.started) return "IDLE";
      const v = Object.values(state.nodes);
      if (v.includes("FAILED")) return "FAILED";
      if (v.includes("WAITING")) return "WAITING";
      if (finish.length && finish.every(id => state.nodes[id] === "DONE")) return "COMPLETE";
      return "RUNNING";
    }
    function render() {
      const label = campaign();
      $("status").textContent = label;
      $("hstat").className = "wr-stat s-" + label;
      stage.classList.toggle("on", label === "RUNNING");
      const cnt = s => Object.values(state.nodes).filter(v => v === s).length;
      $("prog").style.width = (cnt("DONE") / actions.length * 100) + "%";
      $("prog").classList.toggle("fail", label === "FAILED");
      $("counts").innerHTML = ["READY", "ACTIVE", "WAITING", "DONE", "FAILED"]
        .map(s => `<div class="k-${s}">${s} <b>${pad2(cnt(s))}</b></div>`).join("") +
        `<div class="k-TOTAL">DONE / ALL <b>${pad2(cnt("DONE"))}/${pad2(actions.length)}</b></div>`;
      $("log").innerHTML = state.log.length ? state.log.slice(0, 8).map(e =>
        `<div class="${e.ok ? "" : "rej"}"><span>${e.time}</span><b>${esc(e.ok ? `${e.type} · ${e.title}${e.note ? " · " + e.note : ""}` : `✕ ${e.type} · ${e.reason}`)}</b></div>`).join("")
        : `<div class="wr-empty"><span>--:--:--</span><b>no events</b></div>`;
      updateTime();
    }
    function updateTime() {
      const end = state.endedAt || Date.now();
      $("time").textContent = state.startedAt ? fmt((end - state.startedAt) / 1000) : "00:00";
    }

    function emit(ev) {
      ev = typeof ev === "string" ? {type: ev} : (ev || {});
      const type = ev.type, def = EVENTS[type], id = ev.node, now = new Date();
      const reject = reason => {
        state.log.unshift({ok: false, type: type || "?", node: id, reason, time: clock(now)});
        render();
        return {ok: false, reason, campaign: campaign(), node: id};
      };
      if (!def) return reject(`未知事件，可用：${EVENT_TYPES.join(", ")}`);

      let pulse = [];
      if (type === "TASK_CREATED") {
        nodes.forEach(n => setNode(n.id, isRes(n.id) ? "RESOURCE" : actInc(n.id).length ? "IDLE" : "READY"));
        state.started = true; state.startedAt = now.getTime(); state.endedAt = null;
      } else {
        if (!state.started) return reject("尚未開戰，請先送 TASK_CREATED");
        if (!id || !byId[id]) return reject(id ? `找不到節點 ${id}` : "節點事件必須指名 node");
        const cur = state.nodes[id], name = byId[id].title || id;
        if (isRes(id)) return reject(`${name} 是資源節點，不接受作戰事件`);
        if (!def.from.includes(cur)) {
          const why = cur === "IDLE" ? `上游尚未完成（需要 ${actInc(id).map(i => byId[edges[i].from].title).join(" 或 ")} DONE）` : `目前是 ${cur}`;
          return reject(`${name} ${why}，不接受 ${type}`);
        }
        setNode(id, def.to);
        if (type === "STARTED") pulse = (inc[id] || []).filter(i => state.nodes[edges[i].from] === "DONE"); // 訊號從已完成的上游傳進來
        if (def.to === "DONE") { // 自己完成了，下游符合條件的節點變 READY
          (out[id] || []).forEach(i => {
            const t = edges[i].to;
            if (isRes(t)) pulse.push(i); // 資料寫回資源節點：只有訊號，資源本身不變
            else if (state.nodes[t] === "IDLE" && upstreamDone(t)) { setNode(t, "READY"); pulse.push(i); }
          });
        }
      }
      refreshEdges();
      const c = campaign();
      state.endedAt = c === "COMPLETE" ? now.getTime() : null;
      state.log.unshift({ok: true, type, node: id || null, title: id ? byId[id].title || id : "開戰", time: clock(now), note: ev.note || ""});
      runPulse(pulse, true);
      render();
      return {ok: true, campaign: c, node: id || null, state: id ? state.nodes[id] : null, edges: pulse.map(i => [edges[i].from, edges[i].to])};
    }

    // 一次性光流：只在這次事件影響的單一段連線跑一次，跑完就停（只是訊號，不代表完成）
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pulses = [];
    let raf = 0;
    function runPulse(list, together) {
      if (reduce || !list.length) return;
      const t = performance.now();
      list.forEach((i, k) => pulses.push({e: edges[i], start: t + (together ? 0 : k * PULSE_GAP)}));
      if (!raf) raf = requestAnimationFrame(animate);
    }
    function animate(now) {
      for (let k = pulses.length - 1; k >= 0; k--) {
        const {e, start} = pulses[k], u = (now - start) / PULSE_MS;
        if (u < 0) continue;
        if (u > 1) { e.st.setAttribute("stroke-dashoffset", e.seg); e.mv.forEach(d => d.classList.remove("on")); pulses.splice(k, 1); continue; }
        e.st.setAttribute("stroke-dashoffset", e.seg - u * (e.len + e.seg));
        e.mv.forEach((d, j) => {
          const f = Math.min(1, Math.max(0, u - j * .12));
          const q = e.p.getPointAtLength(f * e.len);
          d.setAttribute("cx", q.x); d.setAttribute("cy", q.y); d.classList.add("on");
        });
      }
      raf = pulses.length ? requestAnimationFrame(animate) : 0;
    }

    // 任務計時：只在任務進行中更新顯示，不推進流程
    const timeTimer = setInterval(() => { if (state.startedAt && !state.endedAt) updateTime(); }, 1000);

    // ===== MOCK / DEMO DATA：跟流程狀態完全隔離，不讀也不寫 state =====
    const barEls = sigLabels.map((lab, i) => {
      const d = document.createElement("div");
      d.innerHTML = `<span>${esc(lab)}</span><i class="${i % 3 === 0 ? "w" : ""}"></i>`;
      $("bars").appendChild(d);
      return d.querySelector("i");
    });
    const cells = Array.from({length: 64}, () => $("heat").appendChild(document.createElement("i")));
    let mockStep = 0;
    function tickMock() {
      barEls.forEach(b => { b.style.width = rnd(10, 90) + "px"; });
      cells.forEach(cell => { const r = Math.random(); cell.className = r > .93 ? "c" : r > .8 ? "b" : r > .55 ? "a" : ""; });
      $("pct").textContent = rnd(23, 62) + "%";
      $("d1").textContent = pad2(rnd(0, 9)) + " " + (dec.a || "routed");
      $("d2").textContent = pad2(rnd(0, 4)) + " " + (dec.b || "saved");
      $("reach").textContent = pad2(5 + mockStep * 3 % 45);
      $("loops").textContent = pad2(1 + mockStep % 3) + " / " + (reach.loops || "new loops");
      mockStep++;
    }
    tickMock();
    const mockTimer = setInterval(tickMock, 2400);

    // 等比縮放
    function scale() {
      const s = Math.min(1, root.clientWidth / CW);
      stage.style.transform = `scale(${s})`;
      root.style.height = stage.offsetHeight * s + "px";
    }
    addEventListener("resize", scale);
    scale();
    if (document.fonts) document.fonts.ready.then(scale);
    render();

    const api = {
      emit,
      getState: () => JSON.parse(JSON.stringify(state)),
      destroy() {
        cancelAnimationFrame(raf); clearInterval(mockTimer); clearInterval(timeTimer);
        removeEventListener("resize", scale);
        root.innerHTML = ""; root.style.height = ""; root.__wr = null;
        if (current === api) current = null;
      },
    };
    root.__wr = api;
    current = api;
    return api;
  }

  window.WarRoom = {
    STAGES, NODE_STATES, EVENT_TYPES, validate, mount,
    emit: ev => current ? current.emit(ev) : {ok: false, reason: "尚未裝填 Config"},
    getState: () => current ? current.getState() : null,
    register(config) { registry[config.id] = config; return config; },
    get configs() { return Object.values(registry); },
    get(id) { return registry[id]; },
  };
})();
