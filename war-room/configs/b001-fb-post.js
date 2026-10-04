/* B001：FB 真實 PO 文戰役（第一場真實戰役）
   軍令：以 Shen 個人第一人稱，產出一篇經人工核可、可發布到 Facebook 的 PO 文。
   主題：一個人，如何帶一支 AI 軍隊經營（開創新局）一家公司。
   陣型：接令 → 情報 → 定向 → 撰寫 → 驗收 → 人工核可 → 保存（7 個作戰節點、一條直線）。
   本 Config 不含任何戰況；所有狀態只來自 campaigns/B001/events.json 的真實事件。 */
WarRoom.register({
  id: "b001",
  name: "B001 / FB 真實 PO 文戰役",
  header: {
    title: "B001 / FB PO 文戰役",
    tagline: "第一場真實戰役  /  一人中軍 × AI 軍隊",
    flowLabel: "// CAMPAIGN FLOW : LIVE",
    stats: [
      {label: "戰役", value: "B001"},
      {label: "執行", value: "Claude"},
      {label: "核可", value: "Shen"},
    ],
  },
  loopLabel: "ONE CAMPAIGN",
  stageLabels: {
    INPUT: "接令", DISCOVER: "情報", JUDGE: "定向",
    RUN: "撰寫", VERIFY: "驗收核可", SAVE: "保存",
  },
  nodes: [
    {id: "order", stage: "INPUT", title: "接令", tag: "ORDER", sub: "軍令單 · 驗收 V1–V8"},
    {id: "intel", stage: "DISCOVER", title: "情報", tag: "INTEL", sub: "可引用的真實素材"},
    {id: "angle", stage: "JUDGE", title: "定向", tag: "ANGLE", sub: "方向 · 大綱 · 開頭"},
    {id: "draft", stage: "RUN", title: "撰寫", tag: "DRAFT", sub: "PO 文全文"},
    {id: "check", stage: "VERIFY", title: "驗收", tag: "V1–V8", sub: "逐條 PASS / FAIL"},
    {id: "approve", stage: "VERIFY", title: "人工核可", tag: "SHEN", sub: "只有 Shen 能核可"},
    {id: "save", stage: "SAVE", title: "保存", tag: "SAVE", sub: "定稿 · 驗收表 · 戰役紀錄"},
  ],
  edges: [
    ["order", "intel"], ["intel", "angle"], ["angle", "draft"],
    ["draft", "check"], ["check", "approve"], ["approve", "save"],
  ],
  panels: {
    log: {title: "EVENT LOG"},
    signals: {title: "SIGNALS"}, decisions: {title: "DECISIONS"}, heat: {title: "HEAT MAP"}, reach: {title: "REACH"},
    roster: {title: "ROSTER", items: [["中軍", "Shen · 下令 · 核可"], ["執行", "Claude · 情報 · 撰寫 · 驗收"]]},
    status: {title: "STATUS"},
  },
  footer: ["B001 / LIVE / REAL EVENTS ONLY", ""],
});
