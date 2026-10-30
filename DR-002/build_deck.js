const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const gi = require("react-icons/gi");
const { applyTheme } = require("/root/.claude/skills/synced/ef8924de-1551-4665-8ade-2fdefef85a06_1110b9a5-1893-46f0-a2c0-4d10319a7a97/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "deck.pptx";

const THEME = {
  name: "Wheat Gold Executive",
  headFontFace: "Microsoft YaHei",
  bodyFontFace: "Microsoft YaHei",
  colors: {
    dk1: "3B2A1E", lt1: "FFFFFF", dk2: "6B5340", lt2: "F7F2E8",
    accent1: "B8893B", accent2: "D9B56A", accent3: "7A5C43",
    accent4: "EADFC8", accent5: "A0453A", accent6: "4F6B4A",
    hlink: "B8893B", folHlink: "7A5C43",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "中粮海嘉 × 宽瑜膳元 五行特色食品预拌粉产业合作计划";
pres.subject = "DR-002 商业合作简报 V1.0";
pres.author = "宽瑜膳元";
const C = pres.SchemeColor;

// ---------- icons ----------
async function icon(Comp, color, size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ---------- layouts ----------
const W = 13.333, H = 7.5;
pres.defineSlideMaster({
  title: "COVER_DARK",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.9, y: 2.05, w: 11.5, h: 1.85, fontSize: 40, bold: true, color: C.background1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.9, y: 4.0, w: 11.5, h: 0.7, fontSize: 22, color: C.accent2, margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background2 },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.35, w: 8, h: 0.35, fontSize: 12, bold: true, color: C.accent1, charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.7, w: 12.1, h: 0.75, fontSize: 30, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { text: { text: "DR-002 · 中粮海嘉 × 宽瑜膳元 · 五行特色食品预拌粉产业合作计划 · 讨论稿 V1.0", options: { x: 0.6, y: 7.05, w: 9, h: 0.3, fontSize: 9, color: C.text2, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.05, w: 0.5, h: 0.3, fontSize: 9, color: C.text2, align: "right" },
});
pres.defineSlideMaster({
  title: "CLOSING_DARK",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: 0.6, y: 0.35, w: 8, h: 0.35, fontSize: 12, bold: true, color: C.accent2, charSpacing: 2, margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.7, w: 12.1, h: 0.75, fontSize: 30, bold: true, color: C.background1, align: "left", valign: "middle", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 7.05, w: 0.5, h: 0.3, fontSize: 9, color: C.accent2, align: "right" },
});

// ---------- helpers ----------
let sec = "";
function slide(master, section, kicker, title) {
  if (section !== sec) { pres.addSection({ title: section }); sec = section; }
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  if (kicker) s.addText(kicker, { placeholder: "kicker" });
  if (title) s.addText(title, { placeholder: "title" });
  return s;
}
const shadow = () => ({ type: "outer", color: "7A5C43", opacity: 0.12, blur: 8, offset: 2, angle: 90 });
function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || C.background1 },
    line: opts.line ? { color: opts.line, width: 1 } : { type: "none" },
    shadow: opts.noShadow ? undefined : shadow(),
    objectName: opts.name,
  });
}
function txt(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top" }, o)); }
function badge(s, x, y, d, label, fill, color, fs) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" } });
  txt(s, label, { x, y, w: d, h: d, align: "center", valign: "middle", bold: true, fontSize: fs || 16, color });
}
function iconCircle(s, img, x, y, d, fill) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill || C.accent4 }, line: { type: "none" } });
  const p = d * 0.26;
  s.addImage({ data: img, x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
}
function arrowR(s, x, y, w, color) {
  s.addShape(pres.shapes.RIGHT_ARROW, { x, y, w, h: 0.32, fill: { color: color || C.accent2 }, line: { type: "none" } });
}
function note(s, text, y = 6.62) {
  txt(s, text, { x: 0.6, y, w: 12.1, h: 0.3, fontSize: 10, color: C.text2, italic: true });
}
function pill(s, x, y, w, text, fill, color) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.36, rectRadius: 0.18, fill: { color: fill }, line: { type: "none" } });
  txt(s, text, { x, y, w, h: 0.36, align: "center", valign: "middle", fontSize: 11, bold: true, color });
}

(async () => {
  const I = {
    wheatGold: await icon(gi.GiWheat, HEX.accent2),
    wheat: await icon(gi.GiWheat, HEX.accent1),
    hand: await icon(fa.FaHandshake, HEX.accent1),
    flask: await icon(fa.FaFlask, HEX.accent1),
    truck: await icon(fa.FaTruck, HEX.accent1),
    store: await icon(fa.FaStore, HEX.accent1),
    users: await icon(fa.FaUsers, HEX.accent1),
    check: await icon(fa.FaClipboardCheck, HEX.accent1),
    box: await icon(fa.FaBoxOpen, HEX.accent1),
    factory: await icon(fa.FaIndustry, HEX.accent1),
    shield: await icon(fa.FaShieldAlt, HEX.accent1),
    pin: await icon(fa.FaMapMarkerAlt, HEX.accent1),
    cogs: await icon(fa.FaCogs, HEX.accent1),
    warehouse: await icon(fa.FaWarehouse, HEX.accent1),
    seed: await icon(fa.FaSeedling, HEX.accent1),
    chart: await icon(fa.FaChartLine, HEX.accent1),
    tie: await icon(fa.FaUserTie, HEX.accent1),
  };

  // ===== P01 封面 =====
  {
    const s = slide("COVER_DARK", "开篇", null, null);
    s.addImage({ data: I.wheatGold, x: 0.9, y: 1.1, w: 0.9, h: 0.9 });
    txt(s, "DR-002 · 商业合作提案 V1.0", { x: 2.0, y: 1.35, w: 6, h: 0.4, fontSize: 14, bold: true, color: C.accent2, charSpacing: 2 });
    s.addText("中粮海嘉 × 宽瑜膳元\n五行特色食品预拌粉产业合作计划", { placeholder: "title" });
    s.addText("从优质面粉到特色主食产业链", { placeholder: "body" });
    s.addShape(pres.shapes.LINE, { x: 0.9, y: 5.25, w: 11.5, h: 0, line: { color: HEX.accent3, width: 0.75 } });
    txt(s, [
      { text: "呈送：中粮海嘉集团管理层", options: { breakLine: true } },
      { text: "提案方：宽瑜膳元　　2026年10月" },
    ], { x: 0.9, y: 5.45, w: 8, h: 0.75, fontSize: 14, color: C.accent4, paraSpaceAfter: 4 });
    txt(s, "合作讨论稿 · 不构成任何一方承诺", { x: 8.9, y: 5.45, w: 3.5, h: 0.35, fontSize: 11, color: C.accent2, align: "right" });
    s.addNotes("封面。本简报为合作提案讨论稿，合作方式为委托代工，具体条款与价格均待双方议定，不代表任何一方已作出承诺。");
  }

  // ===== P02 合作机会 =====
  {
    const s = slide("CONTENT", "合作基础", "01 · 合作机会", "从通用面粉，走向差异化、高附加值的特色预拌粉");
    const steps = [
      { t: "通用面粉", d: "标准化大宗供应\n竞争焦点在规模与价格", y: 4.35, h: 1.55, fill: C.accent4, tc: C.text1 },
      { t: "馒头专用预拌粉", d: "配方前置、即开即用\n帮助客户稳定品质、简化工序", y: 3.35, h: 2.55, fill: C.accent2, tc: C.text1 },
      { t: "五行特色主食", d: "以五行功能配方形成差异\n带动终端产品识别度", y: 2.35, h: 3.55, fill: C.accent1, tc: C.background1 },
    ];
    steps.forEach((st, i) => {
      const x = 0.6 + i * 2.75;
      s.addShape(pres.shapes.RECTANGLE, { x, y: st.y, w: 2.55, h: st.h, fill: { color: st.fill }, line: { type: "none" } });
      txt(s, st.t, { x: x + 0.2, y: st.y + 0.2, w: 2.2, h: 0.45, fontSize: 18, bold: true, color: st.tc });
      txt(s, st.d, { x: x + 0.2, y: st.y + 0.72, w: 2.2, h: 0.8, fontSize: 12, color: st.tc });
    });
    txt(s, "附加值提升 →", { x: 0.6, y: 1.75, w: 8, h: 0.4, fontSize: 14, bold: true, color: C.accent3 });
    // right: why now
    card(s, 9.1, 1.75, 3.6, 4.15);
    txt(s, "合作切入点", { x: 9.4, y: 1.95, w: 3.0, h: 0.4, fontSize: 18, bold: true, color: C.accent1 });
    const pts = [
      ["延伸", "在既有面粉供应基础上，向下游延伸一层产品"],
      ["差异", "以五款特色配方避开同质化价格竞争"],
      ["复制", "统一25公斤规格，便于馒头生产厂标准化复购"],
    ];
    pts.forEach((p, i) => {
      const y = 2.5 + i * 1.1;
      badge(s, 9.4, y, 0.5, p[0], C.accent4, C.text1, 11);
      txt(s, p[1], { x: 10.05, y: y - 0.02, w: 2.45, h: 0.95, fontSize: 13, color: C.text1 });
    });
    note(s, "注：本页为商业逻辑示意，未引用市场规模数据；如需量化，须以权威统计或第三方调研为准。");
    s.addNotes("核心信息：传统面粉供应可以向“专用预拌粉→特色主食”延伸，获得差异化与附加值。本页不引用任何未经核实的市场规模数据。");
  }

  // ===== P03 双方资源互补 =====
  {
    const s = slide("CONTENT", "合作基础", "02 · 双方资源互补", "陈博士配方 × 中粮海嘉面粉，委托代工生产五行预拌粉");
    const cols = [
      { x: 0.6, head: "中粮海嘉", sub: "面粉及相关产业资源", ic: I.warehouse,
        items: ["优质面粉原料供应", "生产与品控体系衔接", "仓储物流与供应链网络", "相关产业资源（范围待确认）"] },
      { x: 7.73, head: "宽瑜膳元 · 陈博士", sub: "五行特色粉体配方", ic: I.flask,
        items: ["五行特色粉体配方", "预拌粉配方与工艺指导", "五款产品研发与定型", "特色产品定位"] },
    ];
    cols.forEach((c) => {
      card(s, c.x, 1.75, 5.0, 4.6);
      iconCircle(s, c.ic, c.x + 0.35, 2.0, 0.8);
      txt(s, c.head, { x: c.x + 1.35, y: 2.0, w: 3.4, h: 0.45, fontSize: 22, bold: true });
      txt(s, c.sub, { x: c.x + 1.35, y: 2.45, w: 3.5, h: 0.35, fontSize: 13, color: C.accent1, bold: true });
      c.items.forEach((it, i) => {
        const y = 3.2 + i * 0.72;
        s.addShape(pres.shapes.OVAL, { x: c.x + 0.45, y: y + 0.1, w: 0.16, h: 0.16, fill: { color: C.accent2 }, line: { type: "none" } });
        txt(s, it, { x: c.x + 0.8, y, w: 3.9, h: 0.4, fontSize: 15 });
      });
    });
    // center
    iconCircle(s, I.hand, 6.06, 2.95, 1.2, C.background1);
    txt(s, "合作开发\n五行预拌粉", { x: 5.73, y: 4.15, w: 1.87, h: 0.6, fontSize: 13, bold: true, align: "center", color: C.accent3 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.73, y: 4.75, w: 1.87, h: 0.75, rectRadius: 0.08, fill: { color: C.accent1 }, line: { type: "none" } });
    txt(s, "合作关系\n委托代工", { x: 5.73, y: 4.75, w: 1.87, h: 0.75, fontSize: 12, bold: true, align: "center", valign: "middle", color: C.background1 });
    note(s, "注：委托代工协议尚未签署；中粮海嘉相关资源的具体范围以集团正式确认为准；五行特色粉体由谁生产尚待议定。");
    s.addNotes("双方资源互补：中粮海嘉提供面粉及相关产业资源，陈博士提供五行特色粉体配方，合作关系为陈博士委托中粮海嘉代工生产五行预拌粉。委托代工协议尚未签署；五行特色粉体由谁生产尚待议定。");
  }

  // ===== P04 五大产品矩阵 =====
  {
    const s = slide("CONTENT", "产品与模式", "03 · 五大产品矩阵", "宽瑜膳元五行系列：5个SKU，均为馒头专用预拌粉");
    const prods = [
      { n: "五黑馒头", k: "黑", fill: "2F2A27", kc: C.background1, c: "黑色", f: "补肾", t: "五黑食材配伍" },
      { n: "五红馒头", k: "红", fill: "A0453A", kc: C.background1, c: "红色", f: "补血", t: "五红食材配伍" },
      { n: "茯苓馒头", k: "苓", fill: "FFFFFF", kc: C.text1, c: "白色", f: "祛湿", t: "茯苓入面制作" },
      { n: "姜黄馒头", k: "姜", fill: "D39B2E", kc: C.background1, c: "黄色", f: "固肝", t: "姜黄入面制作" },
      { n: "海藻馒头", k: "藻", fill: "4F6B4A", kc: C.background1, c: "绿色", f: "减重 · 减脂", t: "海藻入面制作" },
    ];
    const cw = 2.26, gap = 0.2;
    prods.forEach((p, i) => {
      const x = 0.6 + i * (cw + gap);
      card(s, x, 1.75, cw, 4.55, { name: "product-" + p.n });
      badge(s, x + 0.25, 1.95, 0.42, "0" + (i + 1), C.accent4, C.text1, 11);
      s.addShape(pres.shapes.OVAL, { x: x + 0.58, y: 2.05, w: 1.1, h: 1.1, fill: { color: p.fill }, line: { color: HEX.accent2, width: 1.5 } });
      txt(s, p.k, { x: x + 0.58, y: 2.05, w: 1.1, h: 1.1, align: "center", valign: "middle", fontSize: 32, bold: true, color: p.kc });
      txt(s, p.n, { x: x + 0.1, y: 3.35, w: cw - 0.2, h: 0.5, fontSize: 20, bold: true, align: "center" });
      txt(s, p.c, { x: x + 0.1, y: 3.85, w: cw - 0.2, h: 0.35, fontSize: 12, bold: true, align: "center", color: C.accent1 });
      txt(s, [{ text: "功能方向", options: { fontSize: 11, color: C.text2, breakLine: true } }, { text: p.f, options: { fontSize: 16, bold: true, color: C.accent5, breakLine: true } }, { text: p.t, options: { fontSize: 11, color: C.text2 } }],
        { x: x + 0.15, y: 4.25, w: cw - 0.3, h: 1.0, align: "center" });
      s.addShape(pres.shapes.LINE, { x: x + 0.3, y: 5.35, w: cw - 0.6, h: 0, line: { color: HEX.accent4, width: 0.75 } });
      txt(s, "馒头专用 · 25kg/包", { x: x + 0.1, y: 5.5, w: cw - 0.2, h: 0.4, fontSize: 12, align: "center", color: C.text1 });
    });
    note(s, "注：功能方向为提案方研发定位；对外宣传、标签及广告用语须经食品合规审核后方可使用（普通食品不得声称疾病预防、治疗或保健功能）；配方以陈博士确认为准。", 6.5);
    s.addNotes("宽瑜膳元五行系列5个SKU及功能方向：五黑馒头（黑色，补肾）、五红馒头（红色，补血）、茯苓馒头（白色，祛湿）、姜黄馒头（黄色，固肝）、海藻馒头（绿色，减重减脂），均为馒头专用预拌粉，25公斤/包。功能方向为提案方研发定位，对外宣传、标签与广告用语须经食品合规审核。茯苓、姜黄是否在适用的药食同源目录及使用范围内，须合规确认。");
  }

  // ===== P05 产品生产流程 =====
  {
    const s = slide("CONTENT", "产品与模式", "04 · 产品生产流程", "四步标准化，确保每一包品质一致");
    const ins = ["五行特色粉体", "优质面粉", "必要食品原料"];
    ins.forEach((t, i) => {
      const y = 2.0 + i * 1.3;
      card(s, 0.6, y, 2.8, 0.95, { fill: i === 0 ? C.accent1 : C.background1 });
      txt(s, t, { x: 0.6, y: i === 0 ? y + 0.08 : y, w: 2.8, h: i === 0 ? 0.5 : 0.95, align: "center", valign: "middle", fontSize: 17, bold: true, color: i === 0 ? C.background1 : C.text1 });
      if (i === 0) pill(s, 1.3, y + 0.52, 1.4, "生产方待议定", C.background1, C.accent5);
      if (i < 2) txt(s, "+", { x: 1.75, y: y + 0.95, w: 0.5, h: 0.35, align: "center", valign: "middle", fontSize: 18, bold: true, color: C.accent1 });
    });
    // bracket
    s.addShape(pres.shapes.RIGHT_BRACE, { x: 3.55, y: 2.0, w: 0.35, h: 3.55, line: { color: HEX.accent3, width: 1.25 } });
    const steps = [
      { t: "标准化混粉", d: "按定型配方比例\n均匀混配", ic: I.cogs },
      { t: "品质检验", d: "按适用食品安全\n国家标准检验", ic: I.check },
      { t: "25公斤包装", d: "统一规格\n标识、批次可追溯", ic: I.box },
    ];
    steps.forEach((st, i) => {
      const x = 4.3 + i * 2.85;
      card(s, x, 2.25, 2.3, 3.05);
      iconCircle(s, st.ic, x + 0.75, 2.5, 0.8);
      badge(s, x + 0.15, 2.4, 0.42, String(i + 1), C.accent1, C.background1, 13);
      txt(s, st.t, { x: x + 0.1, y: 3.5, w: 2.1, h: 0.45, fontSize: 18, bold: true, align: "center" });
      txt(s, st.d, { x: x + 0.1, y: 4.05, w: 2.1, h: 0.8, fontSize: 13, align: "center", color: C.text2 });
      if (i < 2) arrowR(s, x + 2.36, 3.6, 0.42);
    });
    arrowR(s, 3.92, 3.6, 0.32);
    card(s, 4.3, 5.6, 8.0, 0.75, { fill: C.accent4, noShadow: true });
    s.addImage({ data: I.shield, x: 4.5, y: 5.75, w: 0.42, h: 0.42 });
    txt(s, "合规前提：生产主体须具备相应食品生产许可（SC），原料与产品须符合食品安全国家标准——资质待逐项核实", { x: 5.1, y: 5.6, w: 7.1, h: 0.75, valign: "middle", fontSize: 13 });
    s.addNotes("生产流程：五行特色粉体＋面粉＋必要食品原料，经标准化混粉、品质检验、25公斤包装。生产主体资质（SC许可）、检验标准须在试产前核实。");
  }

  // ===== P06 产业商业模式 =====
  {
    const s = slide("CONTENT", "产品与模式", "05 · 产业商业模式", "一条链路，打通从预拌粉到消费者");
    const nodes = [
      { t: "预拌粉供应", d: "面粉 + 特色粉体\n标准化成品", ic: I.wheat, hi: true },
      { t: "原料经销商", d: "区域分销\n覆盖与配送", ic: I.truck },
      { t: "馒头生产厂", d: "使用预拌粉\n生产特色馒头", ic: I.factory },
      { t: "终端渠道", d: "潜在终端资源\n详见附件", ic: I.store },
      { t: "消费者", d: "购买与\n复购", ic: I.users },
    ];
    const nw = 2.05, ng = 0.46;
    nodes.forEach((n, i) => {
      const x = 0.6 + i * (nw + ng);
      card(s, x, 2.75, nw, 2.65, { fill: n.hi ? C.text1 : C.background1 });
      iconCircle(s, n.ic, x + 0.6, 2.95, 0.85, n.hi ? C.accent3 : C.accent4);
      txt(s, n.t, { x: x + 0.05, y: 3.95, w: nw - 0.1, h: 0.45, fontSize: 17, bold: true, align: "center", color: n.hi ? C.background1 : C.text1 });
      txt(s, n.d, { x: x + 0.1, y: 4.45, w: nw - 0.2, h: 0.75, fontSize: 12, align: "center", color: n.hi ? C.accent4 : C.text2 });
      if (i < 4) arrowR(s, x + nw + 0.07, 3.92, 0.32);
    });
    // supply sources on top
    card(s, 0.6, 1.55, 4.55, 0.55, { fill: C.accent4, noShadow: true });
    txt(s, [
      { text: "上游：", options: { bold: true, color: C.accent1 } },
      { text: "陈博士配方，委托中粮海嘉代工" },
    ], { x: 0.8, y: 1.55, w: 4.3, h: 0.55, valign: "middle", fontSize: 14 });
    // B2B bracket over nodes 2-3, downstream over 4-5
    pill(s, 0.6 + (nw + ng), 2.2, 2 * nw + ng, "B2B 直接销售对象", C.accent1, C.background1);
    pill(s, 0.6 + 3 * (nw + ng), 2.2, 2 * nw + ng, "下游终端（间接拉动，非直接客户）", C.accent4, C.text1);
    s.addShape(pres.shapes.LINE, { x: 1.62, y: 2.1, w: 0, h: 0.65, line: { color: HEX.accent3, width: 1.25, endArrowType: "triangle" } });
    // value flow
    s.addShape(pres.shapes.LEFT_ARROW, { x: 0.6, y: 5.7, w: 12.1, h: 0.5, fill: { color: C.accent4 }, line: { type: "none" } });
    txt(s, "订单与回款逐级回流 · 终端复购拉动预拌粉持续采购", { x: 1.2, y: 5.7, w: 11, h: 0.5, align: "center", valign: "middle", fontSize: 13, bold: true, color: C.accent3 });
    s.addNotes("产业链：预拌粉供应→原料经销商→馒头生产厂→终端渠道→消费者。B2B直接销售对象为原料经销商及馒头生产厂；附件所列3,592家门店属于潜在终端渠道资源，尚未去重及确认进场，不是直接客户。");
  }

  // ===== P08 四家候选代工厂试点 =====
  {
    const s = slide("CONTENT", "市场落地", "06 · 候选代工厂试点", "四家候选代工厂，六步验证走向重复采购");
    ["A", "B", "C", "D"].forEach((k, i) => {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.75, 2.85, 1.25);
      iconCircle(s, I.factory, x + 0.25, 2.0, 0.75);
      txt(s, "候选代工厂 " + k, { x: x + 1.15, y: 2.0, w: 1.65, h: 0.4, fontSize: 15, bold: true });
      txt(s, "名称与资质待确认", { x: x + 1.15, y: 2.42, w: 1.65, h: 0.35, fontSize: 11, color: C.text2 });
    });
    const steps = [
      ["打样", "按五款配方\n制作样品"], ["试产", "代工厂产线\n小批量试制"], ["试吃", "收集口感与\n外观反馈"],
      ["成本确认", "核算原料与\n加工成本"], ["首批订单", "确认首批\n采购意向"], ["重复采购", "稳定复购\n形成样板"],
    ];
    const sw = 1.95, sg = 0.08;
    steps.forEach((st, i) => {
      const x = 0.6 + i * (sw + sg);
      s.addShape(i === 0 ? pres.shapes.PENTAGON : pres.shapes.CHEVRON, {
        x, y: 3.45, w: sw + 0.12, h: 0.95,
        fill: { color: i < 4 ? C.accent2 : C.accent1 }, line: { type: "none" },
      });
      txt(s, st[0], { x: x + 0.25, y: 3.45, w: sw - 0.35, h: 0.95, align: "center", valign: "middle", fontSize: 16, bold: true, color: i < 4 ? C.text1 : C.background1 });
      txt(s, st[1], { x: x + 0.1, y: 4.6, w: sw - 0.1, h: 0.75, align: "center", fontSize: 12, color: C.text2 });
    });
    txt(s, "产品验证", { x: 0.6, y: 5.45, w: 8.0, h: 0.35, align: "center", fontSize: 12, bold: true, color: C.accent3 });
    txt(s, "商业验证", { x: 8.72, y: 5.45, w: 4.0, h: 0.35, align: "center", fontSize: 12, bold: true, color: C.accent1 });
    card(s, 0.6, 5.9, 12.1, 0.6, { fill: C.accent4, noShadow: true });
    txt(s, [{ text: "当前状态：", options: { bold: true, color: C.accent5 } }, { text: "四家均为候选试点对象，尚无正式采购合约；进入每一步须以上一步结果为准。" }],
      { x: 0.85, y: 5.9, w: 11.7, h: 0.6, valign: "middle", fontSize: 13 });
    s.addNotes("四家候选代工厂试点：打样→试产→试吃→成本确认→首批订单→重复采购。不得宣称已有正式采购合约。");
  }

  // ===== P10 第一年30吨销售计划 =====
  {
    const s = slide("CONTENT", "收益与财务", "07 · 第一年销售计划", "第一年目标：30吨五行预拌粉成品，合1,200包");
    s.addChart(pres.charts.BAR, [{ name: "季度销量（吨）", labels: ["Q1", "Q2", "Q3", "Q4（暂定）"], values: [5, 5, 10, 10] }], {
      x: 0.6, y: 1.7, w: 7.6, h: 4.7, barDir: "col", barGapWidthPct: 70,
      chartColors: [HEX.accent1],
      showTitle: true, title: "季度销量（吨）", titleFontSize: 13, titleColor: HEX.dk2, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 14, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0\"吨\"",
      catAxisLabelColor: HEX.dk2, catAxisLabelFontSize: 13, catAxisLabelFontFace: "+mn-lt",
      valAxisLabelColor: HEX.dk2, valAxisLabelFontSize: 11, valAxisLabelFontFace: "+mn-lt", valAxisMaxVal: 12, valAxisMajorUnit: 2,
      valGridLine: { color: HEX.accent4, size: 0.75 }, catGridLine: { style: "none" },
      showLegend: false, plotArea: { fill: { color: HEX.lt1 } }, fill: HEX.lt1,
    });
    // right KPIs
    const kp = [
      ["30吨", "全年五行预拌粉成品（非特色粉体）"],
      ["1,200包", "按25公斤 / 包换算"],
    ];
    kp.forEach((k, i) => {
      const y = 1.7 + i * 1.5;
      card(s, 8.6, y, 4.1, 1.3, { fill: i === 0 ? C.text1 : C.background1 });
      txt(s, k[0], { x: 8.85, y: y + 0.12, w: 3.7, h: 0.7, fontSize: 36, bold: true, color: i === 0 ? C.accent2 : C.accent1 });
      txt(s, k[1], { x: 8.85, y: y + 0.82, w: 3.7, h: 0.35, fontSize: 13, color: i === 0 ? C.accent4 : C.text2 });
    });
    const rows = [
      ["季度", "吨", "包", "累计"],
      ["Q1", "5", "200", "5吨"],
      ["Q2", "5", "200", "10吨"],
      ["Q3", "10", "400", "20吨"],
      ["Q4 暂定", "10", "400", "30吨"],
    ].map((r, ri) => r.map((t, ci) => ({ text: t, options: {
      fontSize: 12, bold: ri === 0, color: ri === 0 ? C.background1 : C.text1, fill: { color: ri === 0 ? C.accent3 : C.background1 },
      align: ci === 0 ? "left" : "right", valign: "middle" } })));
    s.addTable(rows, { x: 8.6, y: 4.75, w: 4.1, colW: [1.25, 0.85, 0.95, 1.05], rowH: 0.33, border: { type: "solid", pt: 0.75, color: HEX.accent4 }, margin: [0, 0.1, 0, 0.1] });
    note(s, "注：30吨指五行预拌粉成品，不是五行特色粉体；Q4 10吨为暂定；为提案方目标，非已确认订单。1吨 = 40包（25公斤 / 包）。", 6.55);
    s.addNotes("第一年30吨五行预拌粉成品（不是五行特色粉体）：Q1 5吨、Q2 5吨、Q3 10吨、Q4暂定10吨，合计1,200包（25公斤/包，每吨40包）。均为目标，非已确认订单。");
  }

  // ===== P11 财务与获利逻辑 =====
  {
    const s = slide("CONTENT", "收益与财务", "08 · 财务与获利逻辑", "获利结构已明确，价格与利润待正式报价后测算");
    const eq = [
      { k: "营收", f: "销量（吨）× 出厂单价（元 / 吨）", v: "30吨五行预拌粉成品 ×［待报价］" },
      { k: "成本", f: "面粉 + 特色粉体 + 辅料 + 混配加工 + 包装 + 检验 + 物流", v: "各项单价［待报价］" },
      { k: "毛利", f: "营收 − 成本", v: "［待测算］" },
    ];
    eq.forEach((e, i) => {
      const y = 1.75 + i * 1.18;
      card(s, 0.6, y, 7.4, 1.0);
      badge(s, 0.8, y + 0.17, 0.66, e.k, i === 2 ? C.accent1 : C.accent4, i === 2 ? C.background1 : C.text1, 14);
      txt(s, e.f, { x: 1.65, y: y + 0.12, w: 6.2, h: 0.45, fontSize: 15, bold: true });
      txt(s, e.v, { x: 1.65, y: y + 0.57, w: 6.2, h: 0.35, fontSize: 12, color: C.accent5 });
    });
    card(s, 8.4, 1.75, 4.3, 3.36, { fill: C.text1 });
    txt(s, "委托代工下的双方收益", { x: 8.65, y: 1.95, w: 3.9, h: 0.4, fontSize: 16, bold: true, color: C.accent2 });
    const md = [
      ["中粮海嘉", "代工量（吨）× 代工加工费"],
      ["宽瑜膳元", "预拌粉营收 − 成本（含代工费）"],
    ];
    md.forEach((m, i) => {
      const y = 2.55 + i * 0.95;
      txt(s, m[0], { x: 8.65, y, w: 3.9, h: 0.35, fontSize: 13, bold: true, color: C.accent2 });
      txt(s, m[1], { x: 8.65, y: y + 0.35, w: 3.9, h: 0.4, fontSize: 14, color: C.background1 });
    });
    txt(s, "面粉计价方式与代工费标准待议定", { x: 8.65, y: 4.5, w: 3.9, h: 0.35, fontSize: 11, color: C.accent4 });
    card(s, 0.6, 5.4, 12.1, 1.0, { fill: C.accent4, noShadow: true });
    s.addImage({ data: I.chart, x: 0.85, y: 5.65, w: 0.5, h: 0.5 });
    txt(s, [
      { text: "测算前置条件：", options: { bold: true, color: C.accent5 } },
      { text: "取得面粉、特色粉体、代工加工及物流的正式报价后，方可计算单价、毛利率与投资回报；本简报不预估任何价格或利润。" },
    ], { x: 1.55, y: 5.4, w: 11.0, h: 1.0, valign: "middle", fontSize: 13 });
    s.addNotes("财务结构：营收=销量×单价；成本=面粉+特色粉体+辅料+加工+包装+检验+物流；毛利=营收−成本。委托代工下，中粮海嘉收益为代工加工费，宽瑜膳元收益为预拌粉毛利。未取得正式报价前，不编造价格、ROI或利润。");
  }

  // ===== P12 90天合作验证计划 =====
  {
    const s = slide("CONTENT", "行动计划", "09 · 90天合作验证计划", "90天，用五项验证回答“能不能做、值不值得做”");
    const gx = 3.4, gw = 9.3, day = gw / 90;
    // phase header
    [["第1–30天", "研发与合规"], ["第31–60天", "试产与试吃"], ["第61–90天", "渠道与订单"]].forEach((p, i) => {
      const x = gx + i * 30 * day;
      s.addShape(pres.shapes.RECTANGLE, { x: x + 0.03, y: 1.7, w: 30 * day - 0.06, h: 0.6, fill: { color: i === 1 ? C.accent2 : C.accent4 }, line: { type: "none" } });
      txt(s, [{ text: p[0] + "  ", options: { bold: true } }, { text: p[1] }], { x, y: 1.7, w: 30 * day, h: 0.6, align: "center", valign: "middle", fontSize: 13 });
    });
    const ws = [
      ["产品研发", 1, 30, "五款配方定型"],
      ["食品合规", 1, 45, "原料、标签与资质核查"],
      ["试产", 31, 60, "候选代工厂小批量试产"],
      ["渠道测试", 46, 80, "福建渠道试吃与反馈"],
      ["首批订单验证", 61, 90, "首批订单与复购意向"],
    ];
    ws.forEach((w, i) => {
      const y = 2.55 + i * 0.68;
      txt(s, w[0], { x: 0.6, y, w: 2.6, h: 0.5, valign: "middle", fontSize: 15, bold: true });
      s.addShape(pres.shapes.LINE, { x: gx, y: y + 0.6, w: gw, h: 0, line: { color: HEX.accent4, width: 0.5 } });
      const bx = gx + (w[1] - 1) * day;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: bx, y: y + 0.06, w: (w[2] - w[1] + 1) * day, h: 0.4, rectRadius: 0.08, fill: { color: i === 4 ? C.accent1 : C.accent3 }, line: { type: "none" } });
      txt(s, w[3], { x: bx + 0.12, y: y + 0.06, w: (w[2] - w[1] + 1) * day - 0.2, h: 0.4, valign: "middle", fontSize: 12, color: C.background1 });
    });
    // milestones
    [[30, "配方定型"], [60, "试产合格"], [90, "首批订单"]].forEach((m) => {
      const x = gx + m[0] * day;
      s.addShape(pres.shapes.DIAMOND, { x: x - 0.17, y: 6.0, w: 0.34, h: 0.34, fill: { color: C.accent1 }, line: { type: "none" } });
      txt(s, "D" + m[0] + " " + m[1], { x: x - 1.6, y: 6.0, w: 1.38, h: 0.34, align: "right", valign: "middle", fontSize: 12, bold: true, color: C.accent3 });
    });
    note(s, "注：各工作项起止时间为建议排期，须待双方确认启动日期及资源后定稿。", 6.55);
    s.addNotes("90天验证：产品研发、食品合规、试产、渠道测试、首批订单验证。里程碑：D30配方定型、D60试产合格、D90首批订单。排期为建议，待双方确认。");
  }

  // ===== P13 未来产业扩张 =====
  {
    const s = slide("CONTENT", "行动计划", "10 · 未来产业扩张", "福建验证成功后，区域复制与品类延伸双线推进");
    txt(s, "区域复制", { x: 0.6, y: 1.7, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.accent1 });
    // hub
    s.addShape(pres.shapes.OVAL, { x: 0.7, y: 2.9, w: 2.2, h: 2.2, fill: { color: C.text1 }, line: { type: "none" } });
    txt(s, [{ text: "福建", options: { fontSize: 22, bold: true, color: C.accent2, breakLine: true } }, { text: "示范市场", options: { fontSize: 12, color: C.background1 } }],
      { x: 0.7, y: 2.9, w: 2.2, h: 2.2, align: "center", valign: "middle" });
    const regs = ["山东", "上海", "北京", "广东"];
    regs.forEach((r, i) => {
      const y = 2.35 + i * 1.05, ty = y + 0.33, hy = 4.0;
      const up = ty < hy;
      s.addShape(pres.shapes.LINE, { x: 2.9, y: up ? ty : hy, w: 1.2, h: Math.max(Math.abs(ty - hy), 0.01), flipV: up, line: { color: HEX.accent2, width: 1.25, endArrowType: "triangle" } });
      card(s, 4.15, y, 1.9, 0.66);
      s.addImage({ data: I.pin, x: 4.3, y: y + 0.17, w: 0.32, h: 0.32 });
      txt(s, r, { x: 4.7, y, w: 1.3, h: 0.66, valign: "middle", fontSize: 16, bold: true });
    });
    txt(s, "等更多区域", { x: 4.15, y: 6.4, w: 1.9, h: 0.3, fontSize: 11, color: C.text2, align: "center" });
    // product extension
    txt(s, "品类延伸", { x: 6.9, y: 1.7, w: 6, h: 0.4, fontSize: 18, bold: true, color: C.accent1 });
    card(s, 6.9, 2.25, 5.8, 0.9, { fill: C.accent1 });
    txt(s, [{ text: "现阶段：", options: { bold: true } }, { text: "五行馒头专用预拌粉" }], { x: 7.15, y: 2.25, w: 5.4, h: 0.9, valign: "middle", fontSize: 16, color: C.background1 });
    s.addShape(pres.shapes.DOWN_ARROW, { x: 9.6, y: 3.25, w: 0.4, h: 0.4, fill: { color: C.accent2 }, line: { type: "none" } });
    const ext = ["五行包子", "五行面包", "五行面条", "五行饺子皮", "五行早餐模式"];
    ext.forEach((e, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 6.9 + col * 1.98, y = 3.85 + row * 1.35;
      card(s, x, y, 1.84, 1.1);
      txt(s, e, { x, y, w: 1.84, h: 1.1, align: "center", valign: "middle", fontSize: 15, bold: true });
    });
    txt(s, "后续延伸方向，均需另行研发与验证", { x: 10.86, y: 5.2, w: 1.84, h: 1.1, valign: "middle", fontSize: 12, color: C.text2 });
    s.addNotes("扩张路径：福建示范→山东、上海、北京、广东等区域；品类由馒头延伸至包子、面包、面条、饺子皮及早餐模式。均为后续方向，需另行验证，不设时间与规模承诺。");
  }

  // ===== P14 合作邀请与决策 =====
  {
    const s = slide("CLOSING_DARK", "行动计划", "11 · 合作邀请与决策", "恳请集团作出五项决策，启动90天验证");
    const ds = [
      ["评估合作意愿", "确认是否推进合作洽谈"],
      ["指定对接窗口", "明确集团对接部门与负责人"],
      ["确认试产资源", "面粉供应与试产支持范围"],
      ["确认委托代工", "确认代工条件与报价"],
      ["启动90天验证", "确认启动日期与里程碑"],
    ];
    const dw = 2.3, dg = 0.15;
    ds.forEach((d, i) => {
      const x = 0.6 + i * (dw + dg);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.8, w: dw, h: 2.6, rectRadius: 0.08, fill: { color: "4A3628" }, line: { color: HEX.accent3, width: 0.75 } });
      badge(s, x + 0.25, 2.05, 0.62, String(i + 1), C.accent2, C.text1, 20);
      txt(s, d[0], { x: x + 0.25, y: 2.9, w: dw - 0.4, h: 0.5, fontSize: 18, bold: true, color: C.background1 });
      txt(s, d[1], { x: x + 0.25, y: 3.45, w: dw - 0.4, h: 0.8, fontSize: 13, color: C.accent4 });
    });
    txt(s, [{ text: "待议定事项：", options: { bold: true, color: C.accent2 } }, { text: "委托代工协议条款　·　五行特色粉体生产方　·　代工报价" }],
      { x: 0.6, y: 4.6, w: 12.1, h: 0.4, fontSize: 14, color: C.background1 });
    s.addImage({ data: I.wheatGold, x: 0.6, y: 5.35, w: 0.7, h: 0.7 });
    txt(s, "以五行配方赋能优质面粉，\n共建特色主食产业新生态。", { x: 1.55, y: 5.15, w: 11, h: 1.15, fontSize: 30, bold: true, color: C.accent2, valign: "middle" });
    txt(s, "本简报为合作提案讨论稿，所有合作条件以双方正式签署之协议为准。", { x: 0.6, y: 6.6, w: 10, h: 0.3, fontSize: 10, color: C.accent4, italic: true });
    s.addNotes("决策请求：评估合作意愿、指定对接窗口、确认试产资源、确认委托代工条件、启动90天验证。结尾主张：以五行配方赋能优质面粉，共建特色主食产业新生态。");
  }

  // ===== 附件 终端渠道资源明细 =====
  {
    const s = slide("CONTENT", "附件", "附件 · 终端渠道资源", "附件：潜在终端渠道资源明细（合作伙伴提供）");
    card(s, 0.6, 1.75, 3.3, 4.5, { fill: C.text1 });
    iconCircle(s, I.pin, 0.9, 2.0, 0.65, C.accent3);
    txt(s, "3,592", { x: 0.9, y: 2.75, w: 2.9, h: 0.95, fontSize: 60, bold: true, color: C.accent2 });
    txt(s, "家潜在终端门店\n七类渠道合计", { x: 0.9, y: 3.7, w: 2.9, h: 0.65, fontSize: 14, color: C.background1 });
    ["合作伙伴提供", "尚未去重", "尚未确认进场"].forEach((t, i) => pill(s, 0.9, 4.5 + i * 0.45, 2.0, t, C.accent5, C.background1));
    txt(s, "数据口径以合作伙伴原始清单为准", { x: 0.9, y: 5.85, w: 2.9, h: 0.3, fontSize: 10, color: C.accent4 });
    const hdr = { bold: true, color: C.background1, fill: { color: C.accent1 }, fontSize: 12, valign: "middle" };
    const cell = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 11, color: C.text1, valign: "middle" }, o) });
    const num = (t, o = {}) => cell(t, Object.assign({ align: "right", bold: true, fontSize: 12 }, o));
    const data = [
      ["便利连锁", "美宜佳（福建）1,300 · 见福（福建）1,000 · 罗森（广东）300 · 邻几（福建）150 · 十分（厦门）105 · 罗森（福建）100 · 7-ELEVEN（福建）100", "2,980"],
      ["卖场", "天虹 8 · 乐海 8 · 世纪汇鲜 3 · 人人乐 1", "20"],
      ["生鲜连锁", "民兴 50 · 金红日 15 · 闽篮 12 · 集正 12 · 福鲜生 7 · 人和旺 6", "102"],
      ["精品店", "元初 181 · 美岁 10 · 千滋百味 9", "200"],
      ["面包连锁", "安德鲁森（厦门）150 · 澳联 80", "230"],
      ["中专大学", "鹭银海 20 · 鸿润福 8 · 可思汉 6", "35"],
      ["二批", "百胜达、达昌隆等 13 · 恩记、钰信、云翔等 12", "25"],
    ];
    const rows = [[{ text: "渠道类型", options: hdr }, { text: "主要客户（店数）", options: hdr }, { text: "小计（家）", options: Object.assign({}, hdr, { align: "right" }) }]]
      .concat(data.map((r) => [cell(r[0], { bold: true, fontSize: 12 }), cell(r[1]), num(r[2])]))
      .concat([[cell("合计", { bold: true, fontSize: 12, fill: { color: C.accent4 } }), cell("七类渠道小计合计", { color: C.text1, fill: { color: C.accent4 } }), num("3,592", { fill: { color: C.accent4 } })]]);
    s.addTable(rows, {
      x: 4.2, y: 1.75, w: 8.5, colW: [1.4, 5.9, 1.2], rowH: [0.38, 0.7, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42, 0.42],
      fill: { color: C.background1 }, border: { type: "solid", pt: 0.75, color: HEX.accent4 },
      margin: [0, 0.1, 0, 0.1],
    });
    txt(s, [{ text: "客户定位：", options: { bold: true, color: C.accent5 } }, { text: "以上为馒头产品潜在终端渠道，非预拌粉直接客户；B2B 直接客户为原料经销商及馒头生产厂。" }],
      { x: 4.2, y: 5.9, w: 8.5, h: 0.35, fontSize: 11 });
    note(s, "注：数据依合作伙伴提供之渠道表，小计依原表；含罗森（广东）300家；部分品牌明细与小计略有差异，待核对；未去重、未确认进场。", 6.4);
    s.addNotes("附件依合作伙伴提供的渠道表：便利连锁2,980、卖场20、生鲜连锁102、精品店200、面包连锁230、中专大学35、二批25，合计3,592家。含罗森（广东）300家。均为潜在终端渠道，不是预拌粉的B2B直接客户，尚未去重及确认进场。");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
