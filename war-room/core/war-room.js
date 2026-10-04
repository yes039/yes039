/* 作戰室母體（War Room Core）
 * 只負責：7 段流程骨架、4 種節點狀態、自動排版、連線、動畫、事件流、底部 7 格面板。
 * 不含任何業務名稱。部隊內容一律來自 Config：WarRoom.register(config) 登記，WarRoom.mount(el, config) 裝填。
 * Config 格式見 war-room/README.md。
 */
(function () {
  "use strict";

  const STAGES = ["INPUT", "DISCOVER", "JUDGE", "ROUTE", "RUN", "VERIFY", "SAVE"];
  const STATES = ["SKIPPED", "WAITING", "ALERT", "FAILED"];

  // 畫布幾何
  const CW = 980, NW = 136, NH = 44, ROW = 104, TOP = 20, LEFT = 120, RIGHT = 960;
  const CH = TOP + ROW * (STAGES.length - 1) + NH + 24;

  const NS = "http://www.w3.org/2000/svg";
  const registry = {};

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const pad2 = n => String(n).padStart(2, "0");
  const fmt = s => pad2(Math.floor(s / 60) % 60) + ":" + pad2(Math.floor(s) % 60);
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
      if (n.state && !STATES.includes(n.state)) errs.push(`節點 ${n.id} 的 state「${n.state}」不在 ${STATES.join(" / ")}`);
      perStage[n.stage] = (perStage[n.stage] || 0) + 1;
    });
    for (const s in perStage) if (perStage[s] > 6) errs.push(`${s} 有 ${perStage[s]} 個節點，每段最多 6 個`);
    (c.edges || []).forEach((e, i) => {
      if (!Array.isArray(e) || e.length < 2) errs.push(`edges[${i}] 格式應為 [from, to]`);
      else e.slice(0, 2).forEach(id => { if (!ids.has(id)) errs.push(`edges[${i}] 指向不存在的節點：${id}`); });
    });
    (c.route || []).forEach(id => { if (!ids.has(id)) errs.push(`route 指向不存在的節點：${id}`); });
    if (c.header && c.header.stats && c.header.stats.length > 3) errs.push("header.stats 最多 3 個");
    return errs;
  }

  // ---------- 排版：每個 stage 一列，同列平均分配 ----------
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
    if (B.row < A.row) { // 回流：從右側繞回上游
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
      const api = {destroy() {}};
      root.__wr = api;
      return api;
    }

    const c = config, h = c.header || {}, p = c.panels || {}, labels = c.stageLabels || {};
    const nodes = c.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const pos = layout(nodes);
    const alive = n => n.state !== "SKIPPED" && n.state !== "FAILED";
    const route = (c.route && c.route.length ? c.route : nodes.slice().sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)).map(n => n.id)).filter(id => alive(byId[id]));
    const events = c.events && c.events.length ? c.events : route.map(id => `${byId[id].stage.toLowerCase()} ${byId[id].title || id}`);
    const stats = (h.stats || []).slice(0, 3);
    const counts = Object.fromEntries(STATES.map(s => [s, nodes.filter(n => n.state === s).length]));
    const sig = p.signals || {}, dec = p.decisions || {}, reach = p.reach || {}, ros = p.roster || {};
    const sigLabels = (sig.labels && sig.labels.length ? sig.labels : ["01", "02", "03", "04", "05", "06", "07"]).slice(0, 7);

    const stage = document.createElement("div");
    stage.className = "wr-stage";
    stage.innerHTML = `
      <header class="wr-hd">
        <div class="wr-brand"><b>${esc(h.title || c.id)}</b><small>${esc(h.tagline || "")}</small></div>
        <div class="wr-live">${esc(h.flowLabel || "// AGENT FLOW : LIVE")}</div>
        <div class="wr-stat"><span>TIME</span><b data-k="time">00:00</b></div>
        ${[0, 1, 2].map(i => stats[i] ? `<div class="wr-stat"><span>${esc(stats[i].label)}</span><b>${esc(stats[i].value)}</b></div>` : "<div></div>").join("")}
        <div class="wr-stat hot"><span>STATUS</span><b>${counts.FAILED ? "FAILED" : counts.ALERT ? "ALERT" : "LIVE"}</b></div>
        <div class="wr-dot" aria-hidden="true"></div>
      </header>
      <div class="wr-prog"><i data-k="prog"></i></div>
      <div class="wr-crumb"><span>${STAGES.map(s => esc(s) + (labels[s] ? ` <i>${esc(labels[s])}</i>` : "")).join(" &gt; ")}</span><em>${esc(c.loopLabel || "ONE LOOP")}</em></div>
      <svg viewBox="0 0 ${CW} ${CH}" height="${CH}" role="img" aria-label="${esc((h.title || c.id) + " 流程圖")}">
        <defs><filter id="wr-glow-${esc(c.id)}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g data-k="grid"></g><g data-k="wires"></g><g data-k="streaks"></g><g data-k="pts"></g><g data-k="nodes"></g>
      </svg>
      <section class="wr-pn">
        <div class="wr-p"><h4>// ${esc((p.log && p.log.title) || "EVENT LOG")}</h4><div class="wr-log" data-k="log"></div></div>
        <div class="wr-p"><h4>// ${esc(sig.title || "SIGNALS")}</h4><div class="wr-bars" data-k="bars"></div></div>
        <div class="wr-p"><h4>// ${esc(dec.title || "DECISIONS")}</h4><div class="wr-big" data-k="pct">0%</div><div class="wr-cap">${esc(dec.caption || "checked")}</div><div class="wr-cap a" data-k="d1"></div><div class="wr-cap a" data-k="d2"></div></div>
        <div class="wr-p"><h4>// ${esc((p.heat && p.heat.title) || "HEAT MAP")}</h4><div class="wr-heat" data-k="heat"></div></div>
        <div class="wr-p"><h4>// ${esc(reach.title || "REACH")}</h4><div class="wr-big r" data-k="reach">00</div><div class="wr-cap">${esc(reach.caption || "signals found")}</div><div class="wr-cap a" data-k="loops"></div><div class="wr-cap">${esc(reach.foot || "")}</div></div>
        <div class="wr-p wr-ros"><h4>// ${esc(ros.title || "ROSTER")}</h4>${(ros.items || []).slice(0, 4).map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join("")}</div>
        <div class="wr-p wr-st"><h4>// ${esc((p.status && p.status.title) || "STATUS")}</h4>
          <div class="k-LIVE">LIVE <b>${pad2(nodes.filter(alive).length)}</b></div>
          ${STATES.map(s => `<div class="k-${s}">${s} <b>${pad2(counts[s])}</b></div>`).join("")}
        </div>
      </section>
      <div class="wr-ft"><span>${esc((c.footer || [])[0] || "")}</span><span>${esc((c.footer || [])[1] || "FLOW / CONTINUOUS")}</span></div>`;
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

    // 連線
    const glow = `url(#wr-glow-${c.id})`, paths = [];
    (c.edges || []).forEach(([from, to], i) => {
      const d = edgePath(pos[from], pos[to]);
      const dead = !alive(byId[from]) || !alive(byId[to]);
      const pth = svg("path", {d, class: "wr-wire" + (dead ? " dead" : "")}, $("wires"));
      if (!dead) svg("path", {d, class: "wr-wire2", transform: `translate(${i % 2 ? 3 : -3},0)`}, $("wires"));
      if (dead) return;
      const len = pth.getTotalLength();
      const st = svg("path", {d, class: "wr-streak", filter: glow, "stroke-dasharray": `${Math.min(46, len * .3)} ${len}`, "stroke-dashoffset": len}, $("streaks"));
      const slow = byId[to].state === "WAITING" ? .4 : 1;
      const dots = Array.from({length: len > 160 ? 3 : 2}, (_, j) => ({el: svg("circle", {r: 1.9, class: "wr-pt"}, $("pts")), off: j / 3 + Math.random() * .2}));
      paths.push({p: pth, len, st, dots, speed: (0.05 + Math.random() * .05) * slow, phase: Math.random()});
    });

    // 節點
    const nodeEls = {};
    nodes.forEach(n => {
      const q = pos[n.id];
      const g = svg("g", {class: "wr-n" + (n.state ? " st-" + n.state : ""), transform: `translate(${q.x},${q.y})`}, $("nodes"));
      svg("rect", {class: "box", width: NW, height: NH, rx: 3}, g);
      svg("rect", {class: "ico", x: 8, y: 8, width: 11, height: 11, rx: 2}, g);
      svg("circle", {class: "hole", cx: 13.5, cy: 13.5, r: 2.3}, g);
      const t = svg("text", {class: "t", x: 25, y: 18}, g, n.title || n.id);
      const tag = n.state || n.tag;
      const tg = tag ? svg("text", {class: "tag", x: NW - 8, y: 17, "text-anchor": "end"}, g, tag) : null;
      // 標題太長時先縮字，再截斷，避免壓到右上角標籤
      const room = NW - 25 - 8 - (tg ? tg.getComputedTextLength() + 6 : 0);
      for (let fs = 11.5; fs >= 9 && t.getComputedTextLength() > room; fs -= .5) t.style.fontSize = fs + "px";
      while (t.getComputedTextLength() > room && t.textContent.length > 2) t.textContent = t.textContent.slice(0, -2) + "…";
      svg("text", {class: "s", x: 9, y: 35}, g, n.sub || "");
      svg("title", {}, g, `${n.stage}${n.state ? " · " + n.state : ""} — ${n.title || n.id}`);
      nodeEls[n.id] = g;
    });

    // 面板
    const barEls = sigLabels.map((lab, i) => {
      const d = document.createElement("div");
      d.innerHTML = `<span>${esc(lab)}</span><i class="${i % 3 === 0 ? "w" : ""}"></i>`;
      $("bars").appendChild(d);
      return d.querySelector("i");
    });
    const cells = Array.from({length: 64}, () => $("heat").appendChild(document.createElement("i")));
    const logLines = [];
    function pushLog(sec, txt) {
      logLines.unshift(`<div><span>${fmt(sec)}</span><b>${esc(txt)}</b></div>`);
      logLines.length = Math.min(logLines.length, 8);
      $("log").innerHTML = logLines.join("");
    }
    function tickPanels(sec, step) {
      barEls.forEach(b => { b.style.width = rnd(10, 90) + "px"; });
      cells.forEach(cell => { const r = Math.random(); cell.className = r > .93 ? "c" : r > .8 ? "b" : r > .55 ? "a" : ""; });
      $("pct").textContent = rnd(23, 62) + "%";
      $("d1").textContent = pad2(rnd(0, 9)) + " " + (dec.a || "routed");
      $("d2").textContent = pad2(rnd(0, 4)) + " " + (dec.b || "saved");
      $("reach").textContent = pad2(5 + step * 3 % 45);
      $("loops").textContent = pad2(1 + step % 3) + " / " + (reach.loops || "new loops");
      $("prog").style.width = (step * 7 % 100) + "%";
      pushLog(sec, events[step % events.length]);
    }

    // 動畫
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0, lastStep = -1;
    function frame(now) {
      const t = (now - t0) / 1000;
      $("time").textContent = fmt(t);
      paths.forEach(o => {
        const u = (t * o.speed + o.phase) % 1;
        o.dots.forEach(d => { const q = o.p.getPointAtLength(((u + d.off) % 1) * o.len); d.el.setAttribute("cx", q.x); d.el.setAttribute("cy", q.y); });
        o.st.setAttribute("stroke-dashoffset", o.len - ((t * o.speed * 1.6 + o.phase) % 1) * (o.len * 1.4));
      });
      const step = Math.floor(t / 1.2);
      if (step !== lastStep) {
        lastStep = step;
        Object.values(nodeEls).forEach(g => g.classList.remove("hot"));
        if (route.length) {
          nodeEls[route[step % route.length]].classList.add("hot");
          if (route.length > 4) nodeEls[route[(step + Math.ceil(route.length / 2)) % route.length]].classList.add("hot");
        }
        if (step % 2 === 0) tickPanels(t, step / 2);
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // 等比縮放：整格縮小，像影片一樣，不出現橫向捲動
    function scale() {
      const s = Math.min(1, root.clientWidth / CW);
      stage.style.transform = `scale(${s})`;
      root.style.height = stage.offsetHeight * s + "px";
    }
    addEventListener("resize", scale);
    scale();
    if (document.fonts) document.fonts.ready.then(scale);

    const api = {
      destroy() { cancelAnimationFrame(raf); removeEventListener("resize", scale); root.innerHTML = ""; root.style.height = ""; root.__wr = null; },
    };
    root.__wr = api;
    return api;
  }

  window.WarRoom = {
    STAGES, STATES, validate, mount,
    register(config) { registry[config.id] = config; return config; },
    get configs() { return Object.values(registry); },
    get(id) { return registry[id]; },
  };
})();
