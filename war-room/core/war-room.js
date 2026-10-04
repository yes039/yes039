/* 作戰室母體（War Room Core）— EVENT ENGINE V0.1
 *
 * 三者分離：
 *   CONFIG     = 裝誰：節點、連線、哪個節點接哪種事件（eventMap）
 *   EVENT      = 發生什麼：只有 emit(event) 能改變流程狀態
 *   WAR ROOM   = 讓人看見：把狀態畫出來，事件來了才跑一次光流
 *
 * 沒有 Event，流程不前進。底部 SIGNALS / DECISIONS / HEAT MAP / REACH 是標示 MOCK 的展示數據，
 * 跟流程狀態完全隔離。Config 格式見 war-room/README.md。
 */
(function () {
  "use strict";

  const STAGES = ["INPUT", "DISCOVER", "JUDGE", "ROUTE", "RUN", "VERIFY", "SAVE"];
  // 節點的執行期狀態，只能由事件改變
  const NODE_STATES = ["IDLE", "ACTIVE", "DONE", "WAITING", "FAILED"];

  // 事件 → 允許的前一個流程階段、事件後的階段、目標節點所在的 stage
  const EVENTS = {
    TASK_CREATED:     {from: ["IDLE", "COMPLETE", "FAILED"], to: "CREATED", stage: "INPUT"},
    SIGNAL_FOUND:     {from: ["CREATED"], to: "SIGNAL", stage: "DISCOVER"},
    JUDGED:           {from: ["SIGNAL"], to: "JUDGED", stage: "JUDGE"},
    ROUTED:           {from: ["JUDGED"], to: "ROUTED", stage: "ROUTE"},
    RUNNING:          {from: ["ROUTED", "RUNNING"], to: "RUNNING", stage: "RUN"},
    WAITING_APPROVAL: {from: ["RUNNING"], to: "WAITING", stage: "VERIFY"},
    APPROVED:         {from: ["WAITING"], to: "APPROVED", stage: null},
    VERIFIED:         {from: ["APPROVED"], to: "VERIFIED", stage: "VERIFY"},
    SAVED:            {from: ["VERIFIED"], to: "COMPLETE", stage: "SAVE"},
    FAILED:           {from: ["CREATED", "SIGNAL", "JUDGED", "ROUTED", "RUNNING", "WAITING", "APPROVED", "VERIFIED"], to: "FAILED", stage: null},
  };
  const EVENT_TYPES = Object.keys(EVENTS);
  const PHASE_ORDER = ["IDLE", "CREATED", "SIGNAL", "JUDGED", "ROUTED", "RUNNING", "WAITING", "APPROVED", "VERIFIED", "COMPLETE"];

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
      if ("state" in n) errs.push(`節點 ${n.id} 寫了 state：狀態只能由 Event 決定，Config 不可寫`);
      perStage[n.stage] = (perStage[n.stage] || 0) + 1;
    });
    for (const s in perStage) if (perStage[s] > 6) errs.push(`${s} 有 ${perStage[s]} 個節點，每段最多 6 個`);
    (c.edges || []).forEach((e, i) => {
      if (!Array.isArray(e) || e.length < 2) errs.push(`edges[${i}] 格式應為 [from, to]`);
      else e.slice(0, 2).forEach(id => { if (!ids.has(id)) errs.push(`edges[${i}] 指向不存在的節點：${id}`); });
    });
    if ("route" in c || "events" in c) errs.push("route / events 已移除：流程只能由 Event 推進");
    const byId = Object.fromEntries((c.nodes || []).map(n => [n.id, n]));
    for (const [type, id] of Object.entries(c.eventMap || {})) {
      if (!EVENTS[type] || type === "APPROVED" || type === "FAILED") errs.push(`eventMap 不支援「${type}」`);
      else if (!byId[id]) errs.push(`eventMap.${type} 指向不存在的節點：${id}`);
      else if (EVENTS[type].stage && type !== "WAITING_APPROVAL" && byId[id].stage !== EVENTS[type].stage) errs.push(`eventMap.${type} 的節點 ${id} 應在 ${EVENTS[type].stage}`);
    }
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

    const c = config, h = c.header || {}, p = c.panels || {}, labels = c.stageLabels || {}, emap = c.eventMap || {};
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
    const out = {};
    edges.forEach((e, i) => { (out[e.from] = out[e.from] || []).push(i); });
    function findPath(a, b) { // 依 Config 連線找最短路徑（BFS），回傳連線索引
      if (!a || a === b) return [];
      const prev = {[a]: null}, q = [a];
      while (q.length) {
        const n = q.shift();
        for (const i of out[n] || []) {
          const t = edges[i].to;
          if (t in prev) continue;
          prev[t] = i;
          if (t === b) { const path = []; for (let k = b; prev[k] != null; k = edges[prev[k]].from) path.unshift(prev[k]); return path; }
          q.push(t);
        }
      }
      return null;
    }

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

    // ===== EVENT ENGINE：流程狀態只在這裡改變 =====
    const state = {phase: "IDLE", cursor: null, startedAt: null, endedAt: null, nodes: {}, log: []};
    nodes.forEach(n => { state.nodes[n.id] = "IDLE"; });

    function setNode(id, s) {
      state.nodes[id] = s;
      const {g, tg} = nodeEls[id];
      g.setAttribute("class", "wr-n" + (s === "ACTIVE" ? " hot" : s === "IDLE" ? "" : " st-" + s));
      tg.textContent = s === "WAITING" || s === "FAILED" ? s : (byId[id].tag || "");
    }
    function targetFor(type, ev) {
      if (type === "APPROVED") return state.cursor;
      if (type === "FAILED") return ev.node || state.cursor;
      if (ev.node) return ev.node;
      if (emap[type]) return emap[type];
      const first = nodes.find(n => n.stage === EVENTS[type].stage);
      return first && first.id;
    }
    function render() {
      const ph = state.phase;
      const label = ph === "IDLE" ? "IDLE" : ph === "COMPLETE" ? "COMPLETE" : ph === "FAILED" ? "FAILED" : ph === "WAITING" ? "WAITING" : "RUNNING";
      $("status").textContent = label;
      $("hstat").className = "wr-stat s-" + label;
      stage.classList.toggle("on", label === "RUNNING");
      const idx = PHASE_ORDER.indexOf(ph);
      $("prog").style.width = (ph === "FAILED" ? 100 : Math.max(0, idx) / (PHASE_ORDER.length - 1) * 100) + "%";
      $("prog").classList.toggle("fail", ph === "FAILED");
      const cnt = s => Object.values(state.nodes).filter(v => v === s).length;
      $("counts").innerHTML = `<div class="k-PHASE">PHASE <b>${esc(ph)}</b></div>` +
        ["ACTIVE", "DONE", "WAITING", "FAILED"].map(s => `<div class="k-${s}">${s} <b>${pad2(cnt(s))}</b></div>`).join("");
      $("log").innerHTML = state.log.length ? state.log.slice(0, 8).map(e =>
        `<div class="${e.ok ? "" : "rej"}"><span>${e.time}</span><b>${esc(e.ok ? `${e.type} · ${e.title}` : `✕ ${e.type} · ${e.reason}`)}</b></div>`).join("")
        : `<div class="wr-empty"><span>--:--:--</span><b>no events</b></div>`;
      updateTime();
    }
    function updateTime() {
      const end = state.endedAt || Date.now();
      $("time").textContent = state.startedAt ? fmt((end - state.startedAt) / 1000) : "00:00";
    }

    function emit(ev) {
      ev = typeof ev === "string" ? {type: ev} : (ev || {});
      const type = ev.type, def = EVENTS[type], now = new Date();
      const reject = reason => {
        state.log.unshift({ok: false, type: type || "?", reason, time: clock(now)});
        render();
        return {ok: false, reason, phase: state.phase};
      };
      if (!def) return reject(`未知事件，可用：${EVENT_TYPES.join(", ")}`);
      if (!def.from.includes(state.phase)) return reject(`目前階段 ${state.phase} 不接受 ${type}`);
      const target = targetFor(type, ev);
      if (!target || !byId[target]) return reject(`找不到目標節點 ${target || ""}`.trim());
      if (ev.node && def.stage && type !== "WAITING_APPROVAL" && byId[target].stage !== def.stage) return reject(`${target} 不在 ${def.stage}`);

      let path = [];
      if (type === "TASK_CREATED") {
        nodes.forEach(n => setNode(n.id, "IDLE"));
        state.startedAt = now.getTime(); state.endedAt = null; state.cursor = null;
      } else if (type !== "APPROVED" && type !== "FAILED") {
        path = findPath(state.cursor, target);
        if (path === null) return reject(`Config 沒有從 ${state.cursor} 到 ${target} 的連線`);
      }

      // 套用狀態
      if (type === "FAILED") {
        setNode(target, "FAILED");
      } else if (type === "APPROVED") {
        setNode(target, "ACTIVE");
      } else {
        if (state.cursor && state.nodes[state.cursor] !== "FAILED") setNode(state.cursor, "DONE");
        path.slice(0, -1).forEach(i => setNode(edges[i].to, "DONE")); // 途經節點
        setNode(target, type === "WAITING_APPROVAL" ? "WAITING" : type === "SAVED" ? "DONE" : "ACTIVE");
        state.cursor = target;
      }
      state.phase = def.to;
      if (state.phase === "COMPLETE" || state.phase === "FAILED") state.endedAt = now.getTime();
      state.log.unshift({ok: true, type, node: target, title: byId[target].title || target, time: clock(now), note: ev.note || ""});
      runPulse(path);
      render();
      return {ok: true, phase: state.phase, node: target, edges: path.map(i => [edges[i].from, edges[i].to])};
    }

    // 一次性光流：只沿這次事件的路徑跑一次，跑完就停
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pulses = [];
    let raf = 0;
    function runPulse(path) {
      if (reduce || !path.length) return;
      const t = performance.now();
      path.forEach((i, k) => pulses.push({e: edges[i], start: t + k * PULSE_GAP}));
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
