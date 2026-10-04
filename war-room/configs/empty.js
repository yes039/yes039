/* EMPTY：母體展示 Config。
   不屬於任何部隊，用來展示母體的 7 段骨架與事件流程，也當新部隊的起手模板。 */
WarRoom.register({
  id: "empty",
  name: "EMPTY / 母體展示",
  header: {
    title: "EMPTY / WAR ROOM",
    tagline: "00 UNITS  /  NO CONFIG LOADED  /  CORE ONLY",
    flowLabel: "// AGENT FLOW : IDLE",
    stats: [
      {label: "UNITS", value: "00"},
      {label: "MISSION", value: "----"},
      {label: "CONFIG", value: "EMPTY"},
    ],
  },
  loopLabel: "ONE LOOP / --",
  stageLabels: {},
  nodes: [
    {id: "in1", stage: "INPUT", title: "SOURCE A", tag: "SOURCE", sub: "slot 01"},
    {id: "in2", stage: "INPUT", title: "SOURCE B", tag: "SOURCE", sub: "slot 02"},
    {id: "in3", stage: "INPUT", title: "MEMORY", tag: "MEMORY", sub: "slot 03"},
    {id: "dis", stage: "DISCOVER", title: "WORTH A LOOK?", sub: "-- signals"},
    {id: "jdg", stage: "JUDGE", title: "JUDGE", tag: "RULE", sub: "-- / --"},
    {id: "rte", stage: "ROUTE", title: "WHICH UNIT?", sub: "CHOOSE -- / --"},
    {id: "u1", stage: "RUN", title: "UNIT 01", tag: "RUN", sub: "idle"},
    {id: "u2", stage: "RUN", title: "UNIT 02", tag: "RUN", sub: "idle"},
    {id: "u3", stage: "RUN", title: "UNIT 03", tag: "RUN", sub: "idle"},
    {id: "gate", stage: "VERIFY", title: "APPROVAL", tag: "GATE", sub: "human gate"},
    {id: "ver", stage: "VERIFY", title: "VERIFY OUTPUT", tag: "CHECK", sub: "PASS -- / --"},
    {id: "sav", stage: "SAVE", title: "SAVE LIST", tag: "DISK", sub: "-- entries"},
    {id: "nxt", stage: "SAVE", title: "NEXT LOOP", tag: "NEXT", sub: "READY"},
  ],
  edges: [
    ["in1", "dis"], ["in2", "dis"], ["in3", "dis"],
    ["dis", "jdg"], ["jdg", "rte"],
    ["rte", "u1"], ["rte", "u2"], ["rte", "u3"],
    ["u1", "gate"], ["u2", "gate"], ["u3", "gate"],
    ["gate", "ver"], ["ver", "sav"], ["sav", "nxt"], ["nxt", "dis"],
  ],
  eventMap: {
    TASK_CREATED: "in1", SIGNAL_FOUND: "dis", JUDGED: "jdg", ROUTED: "rte",
    RUNNING: "u1", WAITING_APPROVAL: "gate", VERIFIED: "ver", SAVED: "sav",
  },
  panels: {
    log: {title: "EVENT LOG"},
    signals: {title: "SIGNALS", labels: ["01", "02", "03", "04", "05", "06", "07"]},
    decisions: {title: "DECISIONS", caption: "tasks checked", a: "routed", b: "saved"},
    heat: {title: "HEAT MAP"},
    reach: {title: "REACH", caption: "signals found", loops: "new loops", foot: "-- sources"},
    roster: {title: "ROSTER", items: [["SLOT 01", "empty"], ["SLOT 02", "empty"], ["SLOT 03", "empty"]]},
    status: {title: "STATUS"},
  },
  footer: ["CORE / NO CONFIG / DEMO", "FLOW / CONTINUOUS"],
});
