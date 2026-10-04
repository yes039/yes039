/* CAMPAIGN C001：AI 招生影片獲客戰役（第一場真實戰役演練）
   戰役主線：招生目標 → 受眾／策略 → 企劃 → 素材 → 製片 → 審核 → 發布／投放 → 名單／報名 → 戰果
   海豹小隊是其中一支作戰單位（負責製片），不等於整場戰役。
   本 Config 完全沿用母體現有 7 段與 10 種事件，未修改 core/。名額、報名數尚未有真實數字，一律寫「待定」。 */
WarRoom.register({
  id: "campaign-enroll",
  name: "C001 / 招生戰役",
  header: {
    title: "C001 / 招生戰役",
    tagline: "60+ 學 AI  /  招生影片獲客  /  海豹小隊參戰",
    flowLabel: "// CAMPAIGN FLOW : LIVE",
    stats: [
      {label: "戰役", value: "C001"},
      {label: "單位", value: "海豹"},
      {label: "名額", value: "待定"},
    ],
  },
  loopLabel: "ONE CAMPAIGN",
  stageLabels: {
    INPUT: "目標", DISCOVER: "受眾策略", JUDGE: "企劃", ROUTE: "配兵",
    RUN: "素材製片發布", VERIFY: "審核名單", SAVE: "戰果",
  },
  nodes: [
    {id: "goal", stage: "INPUT", title: "招生目標", tag: "GOAL", sub: "60+ 學 AI · 名額待定"},
    {id: "hist", stage: "INPUT", type: "resource", title: "戰果庫", tag: "MEMORY", sub: "目前 0 筆"},
    {id: "aud", stage: "DISCOVER", title: "受眾", tag: "WHO", sub: "60+ 長輩 / 子女"},
    {id: "strat", stage: "DISCOVER", title: "策略", tag: "HOW", sub: "我也做得到"},
    {id: "plan", stage: "JUDGE", title: "企劃", tag: "PLAN", sub: "作戰令 · 30s 片"},
    {id: "route", stage: "ROUTE", title: "配兵", tag: "UNIT", sub: "海豹小隊 ▸ 製片"},
    {id: "mat", stage: "RUN", title: "素材", tag: "H1", sub: "實拍 · 報名資訊"},
    {id: "prod", stage: "RUN", title: "製片", tag: "SEAL", sub: "30s · 9:16",
     execution: "delegated", unit: "seal-team", deliver: "h4"},   // V3：委派海豹小隊，交貨點＝海豹的成片核可
    {id: "pub", stage: "RUN", title: "發布／投放", tag: "H5", sub: "IG · FB · LINE"},
    {id: "rev", stage: "VERIFY", title: "審核", tag: "H4", sub: "成片 + 報名資訊"},
    {id: "lead", stage: "VERIFY", title: "名單／報名", tag: "LEADS", sub: "表單 · 私訊"},
    {id: "result", stage: "SAVE", title: "戰果", tag: "RESULT", sub: "報名數 / 名額"},
    {id: "lib", stage: "SAVE", title: "寫回戰果庫", tag: "OUT", sub: "下一場必讀"},
  ],
  edges: [
    ["goal", "aud"], ["hist", "aud"], ["aud", "strat"], ["strat", "plan"],
    ["plan", "route"], ["route", "mat"], ["mat", "prod"], ["prod", "rev"],
    ["rev", "pub"], ["pub", "lead"], ["lead", "result"], ["result", "lib"], ["lib", "hist"],
  ],
  eventMap: {
    TASK_CREATED: "goal", SIGNAL_FOUND: "aud", JUDGED: "plan", ROUTED: "route",
    RUNNING: "mat", WAITING_APPROVAL: "rev", VERIFIED: "lead", SAVED: "result",
  },
  panels: {
    log: {title: "EVENT LOG"},
    signals: {title: "SIGNALS", labels: ["目標", "受眾", "企劃", "素材", "製片", "投放", "名單"]},
    decisions: {title: "DECISIONS", caption: "名單已判讀", a: "leads", b: "enrolled"},
    heat: {title: "HEAT MAP"},
    reach: {title: "REACH", caption: "觸及", loops: "渠道", foot: "IG · FB · LINE"},
    roster: {title: "UNITS", items: [["海豹小隊", "製片單位"], ["隊長", "H1 素材 · H4 審核 · H5 投放"]]},
    status: {title: "STATUS"},
  },
  footer: ["C001 / CAMPAIGN / REHEARSAL", ""],
});
