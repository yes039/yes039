/* V3 ENGINE SPIKE — 無畫面引擎＋指揮層（不是正式版，不接 UI）
 *
 * createEngine(config)  一份 Config 一個引擎實例，規則與 V2 core 完全相同：
 *   節點狀態 IDLE / READY / ACTIVE / WAITING / DONE / FAILED（resource 固定 RESOURCE）
 *   事件 TASK_CREATED / STARTED / WAITING / RESUMED / APPROVED / DONE / FAILED
 *   路過 ≠ 完成；異常原地恢復；上游未完成不得開始
 *   V3 新增：action 節點的 execution = direct（預設）| delegated。
 *   delegated 節點拒收直接事件，狀態只能由指揮層依 Mission 推算（derive）。
 *
 * createHQ({campaign, units})  指揮層：一個 Campaign 引擎＋多個 Mission 引擎
 *   emit({type, node})                         → Campaign
 *   emit({type: "MISSION_OPENED", node, mission}) → 委派節點 READY 才能出兵，建立 Mission 引擎
 *   emit({mission, type, node})                → 該 Mission
 *   Mission 交貨範圍＝deliver 節點與它的所有上游；交貨後兩層脫鉤。
 */
(function (root) {
  "use strict";

  const STATES = ["IDLE", "READY", "ACTIVE", "WAITING", "DONE", "FAILED"];
  const EVENTS = {
    TASK_CREATED: {from: null, to: null},
    STARTED:  {from: ["READY", "FAILED"], to: "ACTIVE"},
    WAITING:  {from: ["ACTIVE"], to: "WAITING"},
    RESUMED:  {from: ["WAITING"], to: "ACTIVE"},
    APPROVED: {from: ["WAITING"], to: "DONE"},
    DONE:     {from: ["ACTIVE"], to: "DONE"},
    FAILED:   {from: ["ACTIVE", "WAITING"], to: "FAILED"},
  };

  function createEngine(config, name) {
    const nodes = config.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const edges = (config.edges || []).map(([from, to]) => ({from, to}));
    const inc = {}, out = {};
    edges.forEach((e, i) => { (out[e.from] = out[e.from] || []).push(i); (inc[e.to] = inc[e.to] || []).push(i); });
    const isRes = id => byId[id].type === "resource";
    const isDel = id => !isRes(id) && byId[id].execution === "delegated";
    const actions = nodes.filter(n => !isRes(n.id));
    const actInc = id => (inc[id] || []).filter(i => !isRes(edges[i].from));
    const finish = actions.filter(n => n.stage === "SAVE").map(n => n.id);
    const st = {started: false, nodes: {}};
    nodes.forEach(n => { st.nodes[n.id] = isRes(n.id) ? "RESOURCE" : "IDLE"; });
    const upstreamDone = id => actInc(id).some(i => st.nodes[edges[i].from] === "DONE");

    function status() {
      if (!st.started) return "IDLE";
      const v = Object.values(st.nodes);
      if (v.includes("FAILED")) return "FAILED";
      if (v.includes("WAITING")) return "WAITING";
      if (finish.length && finish.every(id => st.nodes[id] === "DONE")) return "COMPLETE";
      return "RUNNING";
    }
    // 套用狀態；DONE 時讓下游符合條件的節點 READY（V2 同規則）
    function set(id, s) {
      st.nodes[id] = s;
      const pulse = [];
      if (s === "DONE") (out[id] || []).forEach(i => {
        const t = edges[i].to;
        if (isRes(t)) pulse.push(i);
        else if (st.nodes[t] === "IDLE" && upstreamDone(t)) { st.nodes[t] = "READY"; pulse.push(i); }
      });
      return pulse;
    }
    const ok = (id, pulse) => ({ok: true, status: status(), node: id || null, state: id ? st.nodes[id] : null, edges: (pulse || []).map(i => [edges[i].from, edges[i].to])});
    const no = (id, reason) => ({ok: false, reason, status: status(), node: id || null});

    function apply(type, id) {
      const def = EVENTS[type];
      if (!def) return no(id, `未知事件 ${type}`);
      if (type === "TASK_CREATED") {
        nodes.forEach(n => { st.nodes[n.id] = isRes(n.id) ? "RESOURCE" : actInc(n.id).length ? "IDLE" : "READY"; });
        st.started = true;
        return ok(null);
      }
      if (!st.started) return no(id, "尚未開戰，請先送 TASK_CREATED");
      if (!id || !byId[id]) return no(id, id ? `找不到節點 ${id}` : "節點事件必須指名 node");
      const cur = st.nodes[id], title = byId[id].title || id;
      if (isRes(id)) return no(id, `${title} 是資源節點，不接受作戰事件`);
      if (isDel(id)) return no(id, `${title} 是委派節點（${byId[id].unit}），只能由 Mission 交貨推動`);
      if (!def.from.includes(cur)) {
        const why = cur === "IDLE" ? `上游尚未完成（需要 ${actInc(id).map(i => byId[edges[i].from].title).join(" 或 ")} DONE）` : `目前是 ${cur}`;
        return no(id, `${title} ${why}，不接受 ${type}`);
      }
      return ok(id, set(id, def.to));
    }
    // 只給指揮層用：依 Mission 推算委派節點的狀態
    function derive(id, s) {
      if (!isDel(id)) throw new Error(`derive 只能用在委派節點：${id}`);
      if (!STATES.includes(s)) throw new Error(`未知狀態 ${s}`);
      return ok(id, set(id, s));
    }
    // 回流線（例：下一場 → 值得拍嗎）：從起點做深度優先搜尋，指回目前路徑上節點的連線
    const back = new Set();
    (function () {
      const color = {};
      const visit = n => { color[n] = 1; (out[n] || []).forEach(i => { const t = edges[i].to; if (color[t] === 1) back.add(i); else if (!color[t]) visit(t); }); color[n] = 2; };
      nodes.filter(n => !isRes(n.id) && !actInc(n.id).length).forEach(n => { if (!color[n.id]) visit(n.id); });
      nodes.forEach(n => { if (!color[n.id]) visit(n.id); });
    })();
    // deliver 節點與它所有的上游作戰節點＝交貨範圍（不走回流線，否則下游會被誤算成上游）
    function ancestors(id) {
      const seen = new Set([id]), q = [id];
      while (q.length) for (const i of actInc(q.shift())) { if (back.has(i)) continue; const f = edges[i].from; if (!seen.has(f)) { seen.add(f); q.push(f); } }
      return [...seen];
    }
    return {name, config, byId, apply, derive, ancestors, status, isDel, isRes,
      get state() { return {...st.nodes}; }, get started() { return st.started; }};
  }

  function validateDelegation(campaign, units) {
    const errs = [];
    campaign.nodes.forEach(n => {
      if (n.execution == null || n.execution === "direct") return;
      if (n.execution !== "delegated") return errs.push(`${n.id}：execution 只能是 direct 或 delegated`);
      if (n.type === "resource") errs.push(`${n.id}：resource 節點不能委派`);
      const u = units[n.unit];
      if (!u) return errs.push(`${n.id}：找不到 unit ${n.unit}`);
      const d = u.nodes.find(x => x.id === n.deliver);
      if (!d) errs.push(`${n.id}：unit ${n.unit} 沒有交貨節點 ${n.deliver}`);
      else if (d.type === "resource") errs.push(`${n.id}：交貨節點 ${n.deliver} 不能是 resource`);
    });
    return errs;
  }

  function createHQ({campaign, units}) {
    const errs = validateDelegation(campaign, units);
    if (errs.length) throw new Error("委派設定錯誤：" + errs.join("；"));
    const C = createEngine(campaign, campaign.id);
    const missions = {};   // missionId → {id, node, unit, deliver, engine, scope, delivered}
    const byNode = {};     // campaign node → missionId
    const timeline = [];

    // 依 Mission 交貨範圍推算委派節點：交貨點 DONE → DONE；範圍內 FAILED → FAILED；WAITING → WAITING；其他 → ACTIVE
    function sync(m) {
      if (m.delivered) return null;                       // 交貨後脫鉤
      const s = m.engine.state;
      const want = s[m.deliver] === "DONE" ? "DONE"
        : m.scope.some(id => s[id] === "FAILED") ? "FAILED"
        : m.scope.some(id => s[id] === "WAITING") ? "WAITING" : "ACTIVE";
      if (want === "DONE") m.delivered = true;
      if (C.state[m.node] === want) return null;
      return C.derive(m.node, want);
    }

    function emit(ev) {
      const beforeC = C.state, beforeM = Object.fromEntries(Object.values(missions).map(m => [m.id, m.engine.state]));
      let r, scope = ev.mission ? ev.mission : campaign.id, derived = null;
      if (ev.type === "MISSION_OPENED") {
        const n = C.byId[ev.node];
        if (!n) r = {ok: false, reason: `找不到節點 ${ev.node}`};
        else if (!C.isDel(ev.node)) r = {ok: false, reason: `${n.title} 不是委派節點`};
        else if (!ev.mission) r = {ok: false, reason: "MISSION_OPENED 需要 mission 編號"};
        else if (missions[ev.mission]) r = {ok: false, reason: `Mission ${ev.mission} 已存在`};
        else if (byNode[ev.node]) r = {ok: false, reason: `${n.title} 已委派給 ${byNode[ev.node]}（本版不做多 Mission）`};
        else if (C.state[ev.node] !== "READY") r = {ok: false, reason: `${n.title} 目前是 ${C.state[ev.node]}，必須 READY 才能出兵`};
        else {
          const E = createEngine(units[n.unit], ev.mission);
          E.apply("TASK_CREATED");
          const m = {id: ev.mission, node: ev.node, unit: n.unit, deliver: n.deliver, engine: E, scope: E.ancestors(n.deliver), delivered: false};
          missions[m.id] = m; byNode[ev.node] = m.id;
          derived = C.derive(ev.node, "ACTIVE");
          r = {ok: true, mission: m.id, scope: m.scope};
        }
        scope = "HQ";
      } else if (ev.mission) {
        const m = missions[ev.mission];
        if (!m) r = {ok: false, reason: `Mission ${ev.mission} 不存在`};
        else if (ev.type === "TASK_CREATED") r = {ok: false, reason: "Mission 由 MISSION_OPENED 開戰，不接受 TASK_CREATED"};
        else { r = m.engine.apply(ev.type, ev.node); if (r.ok) derived = sync(m); }
      } else {
        r = C.apply(ev.type, ev.node);
        if (r.ok && ev.type === "TASK_CREATED") { for (const k in missions) delete missions[k]; for (const k in byNode) delete byNode[k]; }
      }
      const diff = (a, b) => Object.keys(b).filter(k => a && a[k] !== b[k]).map(k => [k, a ? a[k] : undefined, b[k]]);
      const entry = {
        seq: timeline.length + 1, scope, ev, ok: r.ok, reason: r.reason || null,
        campaignChanges: diff(beforeC, C.state),
        missionChanges: Object.fromEntries(Object.values(missions).map(m => [m.id, diff(beforeM[m.id] || Object.fromEntries(Object.keys(m.engine.state).map(k => [k, "—"])), m.engine.state)])),
        derived: derived ? derived.state : null,
        campaignStatus: C.status(),
        missionState: Object.fromEntries(Object.values(missions).map(m => [m.id, m.engine.state])),
        missionStatus: Object.fromEntries(Object.values(missions).map(m => [m.id, m.engine.status()])),
        delivered: Object.fromEntries(Object.values(missions).map(m => [m.id, m.delivered])),
      };
      timeline.push(entry);
      return entry;
    }
    return {emit, campaign: C, missions, timeline, units};
  }

  const api = {STATES, EVENT_TYPES: Object.keys(EVENTS), createEngine, createHQ, validateDelegation};
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WarRoomV3 = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
