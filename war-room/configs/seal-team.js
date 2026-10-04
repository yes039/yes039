/* SEAL TEAM：第一個裝填案例（短影音海豹任務小隊，見 seal-team/）。
   所有海豹小隊專屬的名稱、人工節點 H2/H4/H5/H7、任務編號都只出現在這份 Config。 */
WarRoom.register({
  id: "seal-team",
  name: "SEAL TEAM / 海豹小隊",
  header: {
    title: "SEAL / 作戰室",
    tagline: "03 兵位  /  交接契約  /  ALWAYS ITERATING",
    flowLabel: "// AGENT FLOW : LIVE",
    stats: [
      {label: "兵位", value: "03"},
      {label: "任務", value: "M002"},
      {label: "平台", value: "03"},
    ],
  },
  loopLabel: "ONE LOOP / 7D",
  stageLabels: {
    INPUT: "素材", DISCOVER: "選題", JUDGE: "企劃", ROUTE: "配器",
    RUN: "製作發布", VERIFY: "核可驗果", SAVE: "回煉",
  },
  nodes: [
    {id: "src", stage: "INPUT", title: "店家素材", tag: "SOURCE", sub: "M002 · 09 件"},
    {id: "mem", stage: "INPUT", title: "戰果庫", tag: "MEMORY", sub: "小隊記憶"},
    {id: "data", stage: "INPUT", title: "平台洞察", tag: "SOURCE", sub: "48H / 7D"},
    {id: "skip", stage: "DISCOVER", title: "退回", tag: "LOG", sub: "缺資料退回"},
    {id: "worth", stage: "DISCOVER", title: "值得拍嗎？", tag: "TEST", sub: "03 測試點"},
    {id: "plan", stage: "JUDGE", title: "企劃兵", tag: "PLAN", sub: "作戰令"},
    {id: "h2", stage: "JUDGE", title: "隊長核可", tag: "H2", sub: "作戰令核可"},
    {id: "tool", stage: "ROUTE", title: "選哪個器？", tag: "WEAPON", sub: "CHOOSE 01 / 03"},
    {id: "make", stage: "RUN", title: "製片兵", tag: "MAKE", sub: "剪輯單 + SRT"},
    {id: "rend", stage: "RUN", title: "成片輸出", tag: "RENDER", sub: "30S · 9:16"},
    {id: "post", stage: "RUN", title: "發布", tag: "H5", sub: "IG · TT · YT"},
    {id: "h4", stage: "VERIFY", title: "成片核可", tag: "H4", sub: "PASS / 03"},
    {id: "h7", stage: "VERIFY", title: "讀數據", tag: "H7", sub: "48H / 7D 截圖"},
    {id: "judge", stage: "VERIFY", title: "戰果兵", tag: "JUDGE", sub: "判讀規則"},
    {id: "card", stage: "SAVE", title: "戰果單", tag: "DISK", sub: "03 測試點"},
    {id: "save", stage: "SAVE", title: "戰果庫", tag: "OUT", sub: "已追加"},
    {id: "next", stage: "SAVE", title: "下一場", tag: "M003", sub: "READY"},
  ],
  edges: [
    ["src", "worth"], ["mem", "worth"], ["data", "worth"], ["worth", "skip"],
    ["worth", "plan"], ["plan", "h2"], ["plan", "tool"],
    ["tool", "make"], ["tool", "judge"],
    ["make", "rend"], ["rend", "h4"], ["h4", "post"], ["post", "h7"],
    ["h7", "judge"], ["judge", "card"], ["card", "save"], ["save", "next"], ["next", "worth"],
  ],
  // 哪個節點接哪種事件（APPROVED 作用在等待中的節點，FAILED 作用在目前節點或事件指定的節點）
  eventMap: {
    TASK_CREATED: "src", SIGNAL_FOUND: "worth", JUDGED: "plan", ROUTED: "tool",
    RUNNING: "make", WAITING_APPROVAL: "h4", VERIFIED: "judge", SAVED: "card",
  },
  panels: {
    log: {title: "EVENT LOG"},
    signals: {title: "SIGNALS 兵位負載", labels: ["企劃", "製片", "戰果", "H2", "H4", "H5", "H7"]},
    decisions: {title: "DECISIONS", caption: "測試點已判讀", a: "routed", b: "saved"},
    heat: {title: "HEAT MAP 7D"},
    reach: {title: "REACH", caption: "signals found", loops: "new loops", foot: "03 平台"},
    roster: {title: "MISSIONS", items: [["M001", "首場實戰"], ["M002", "60+ 學 AI"], ["M003", "待開作戰令"]]},
    status: {title: "STATUS"},
  },
  footer: ["SEAL / MISSIONS / REAL WORK", "FLOW / CONTINUOUS"],
});
