/* MIN-004 百業 AI 行銷員工｜G1 共用底座
 * 產業模板只負責「內容」：呼叫 MIN004.registerIndustry(def)。
 * 底座負責：九宮格、工作流、成果卡、轉換、事件紀錄。新增產業不需要改這個檔案。 */
(function () {
  'use strict';

  const M = (window.MIN004 = { industries: {}, order: [], plans: null, version: 'G1-0.1' });

  M.registerIndustry = (def) => {
    M.industries[def.id] = def;
    if (!M.order.includes(def.id)) M.order.push(def.id);
  };

  // ── 九宮格定義（共用；順序即畫面位置，05 在正中央）──────────────────
  M.MODULES = [
    { id: 'copy', no: '01', name: 'AI 文案員工', gen: '模板生成' },
    { id: 'video', no: '02', name: 'AI 短影音員工', gen: '模板生成' },
    { id: 'post', no: '03', name: 'AI PO 文員工', gen: '模擬排程' },
    { id: 'line', no: '04', name: 'LINE 客服員工', gen: '規則式示範' },
    { id: 'director', no: '05', name: 'AI 行銷總監', gen: '規則式彙整' },
    { id: 'member', no: '06', name: '會員經營員工', gen: '模板生成' },
    { id: 'ads', no: '07', name: '廣告獲客員工', gen: '模板生成' },
    { id: 'design', no: '08', name: '素材設計員工', gen: '模板生成' },
    { id: 'metrics', no: '09', name: '成效分析員工', gen: '模擬數據' },
  ];
  const MOD = Object.fromEntries(M.MODULES.map((m) => [m.id, m]));

  // ── 內容積木：產業模板回傳這些，底座負責畫出來與轉成純文字 ─────────
  M.B = {
    copy: (label, text, meta) => ({ t: 'copy', label, text, meta }),
    list: (label, items) => ({ t: 'list', label, items }),
    kv: (label, pairs) => ({ t: 'kv', label, pairs }),
    table: (label, head, rows) => ({ t: 'table', label, head, rows }),
    note: (text, tone) => ({ t: 'note', text, tone: tone || 'info' }),
    tasks: (label, items) => ({ t: 'tasks', label, items }),
    calendar: (label, items) => ({ t: 'calendar', label, items }),
    chat: (label, faq) => ({ t: 'chat', label, faq }),
    funnel: (label, stages) => ({ t: 'funnel', label, stages }),
    posters: (label, items) => ({ t: 'posters', label, items }),
    json: (label, obj, note) => ({ t: 'json', label, obj, note }),
  };
  const B = M.B;

  M.tag = (s) => String(s).replace(/[^\p{L}\p{N}_]/gu, '');

  // 依店名產生固定亂數，讓同一家店每次看到的模擬數字一致
  function hash(str) {
    let x = 2166136261;
    for (const ch of String(str)) x = Math.imul(x ^ ch.codePointAt(0), 16777619);
    return x >>> 0;
  }
  function rng(seed) {
    let a = seed || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const fmt = (n) => Number(n).toLocaleString('zh-TW');
  M.fmt = fmt;

  M.sim = {
    // base：預估觸及；rates：每一層轉換率；全部是模擬
    funnel(c, base, rates, labels) {
      labels = labels || ['觸及', '互動', '詢問', '預約', '到店', '成交'];
      const r = rng(c.seed);
      let v = Math.round(base * (0.85 + r() * 0.3));
      const out = [{ name: labels[0], value: v, rate: null }];
      rates.forEach((rate, i) => {
        const real = Math.min(0.99, rate * (0.9 + r() * 0.2));
        v = Math.max(1, Math.round(v * real));
        out.push({ name: labels[i + 1], value: v, rate: real });
      });
      return out;
    },
  };

  M.calPreview = (items) => {
    const platforms = new Set(items.map((i) => i.channel.split(' ')[0]));
    return `本週 ${items.length} 則・${platforms.size} 個平台`;
  };

  // 預留給 VID100／LibTV 的影音生產介面：G1 只顯示交接內容，不送出
  M.videoHandoff = (c, shots) =>
    B.json(
      'VID100／LibTV 影音生產介面（預留・本輪未啟用）',
      {
        interface: 'min004.video_job.v0',
        provider: 'VID100 | LibTV（G2 選定）',
        status: 'disabled_in_G1',
        aspect_ratio: '9:16',
        duration_sec: 30,
        industry: c.ind.id,
        brief: { shop: c.shop, product: c.product, goal: c.goal.label, cta: c.goal.cta },
        shots: shots.map(([time, visual, subtitle]) => ({ time, visual, subtitle })),
        source_media: '店家上傳的真實素材（G2）',
        human_review_required: true,
        paid_generation: false,
      },
      '本輪不呼叫任何付費生成服務。G2 接上後，這份分鏡會直接成為影音生產的工單。'
    );

  // ── 狀態 ─────────────────────────────────────────────────────────
  const S = {
    industry: null,
    mode: 'demo', // demo | mine
    input: null,
    out: null,
    ctx: null,
    delegated: [],
    choice: null,
    sid: Math.random().toString(36).slice(2, 10),
    events: [],
  };
  M.state = S;

  // ── 事件紀錄：只在本機瀏覽器，不送出；不含店名等自由輸入內容 ──────
  const EV_KEY = 'min004.g1.events';
  try {
    S.events = JSON.parse(localStorage.getItem(EV_KEY) || '[]');
  } catch (e) {
    S.events = [];
  }
  M.track = (name, props) => {
    const ev = {
      ts: new Date().toISOString(),
      event: name,
      session_id: S.sid,
      industry: S.industry,
      mode: S.mode,
      props: props || {},
    };
    S.events.push(ev);
    if (S.events.length > 500) S.events.splice(0, S.events.length - 500);
    try {
      localStorage.setItem(EV_KEY, JSON.stringify(S.events));
    } catch (e) {}
    renderTester();
  };

  // ── DOM 小工具（一律用 textContent，使用者輸入不會變成 HTML）──────
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props)
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : String(c));
    }
    return el;
  }
  const $ = (id) => document.getElementById(id);
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  function copyText(text, what) {
    const done = () => {
      toast('已複製：' + what);
      M.track('output_copy', { what, chars: text.length });
    };
    const fallback = () => {
      const ta = h('textarea', { class: 'copy-fallback', readonly: true, 'aria-label': '複製內容' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {}
      ta.remove();
      if (ok) done();
      else {
        showSheet('手動複製', [h('p', { class: 'muted' }, '這個瀏覽器不允許自動複製，請長按下方文字全選後複製。'), h('textarea', { class: 'manual-copy', readonly: true }, text)]);
        M.track('output_copy', { what, chars: text.length, manual: true });
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  M.copyText = copyText;

  const genPill = (gen) => h('span', { class: 'gen', dataset: { gen } }, gen);

  // ── 積木 → 畫面 ─────────────────────────────────────────────────
  function blockHead(label, ...extra) {
    return h('div', { class: 'blk-head' }, h('h4', null, label), ...extra);
  }
  function copyBtn(text, what) {
    return h('button', { class: 'btn-copy', type: 'button', onclick: () => copyText(text, what) }, '複製');
  }

  function renderBlock(b) {
    switch (b.t) {
      case 'copy':
        return h('div', { class: 'blk' }, blockHead(b.label, copyBtn(b.text, b.label)), b.meta && h('p', { class: 'meta' }, b.meta), h('pre', { class: 'copytext' }, b.text));
      case 'list':
        return h('div', { class: 'blk' }, blockHead(b.label), h('ul', { class: 'bul' }, b.items.map((i) => h('li', null, i))));
      case 'kv':
        return h('div', { class: 'blk' }, blockHead(b.label), h('dl', { class: 'kv' }, b.pairs.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
      case 'table':
        return h(
          'div',
          { class: 'blk' },
          blockHead(b.label),
          h('div', { class: 'tblwrap' }, h('table', null, h('thead', null, h('tr', null, b.head.map((x) => h('th', null, x)))), h('tbody', null, b.rows.map((r) => h('tr', null, r.map((x) => h('td', null, x)))))))
        );
      case 'note':
        return h('p', { class: 'note', dataset: { tone: b.tone } }, b.text);
      case 'tasks':
        return h(
          'div',
          { class: 'blk' },
          blockHead(b.label),
          h('ol', { class: 'tasks' }, b.items.map(([title, why, owner]) => h('li', null, h('div', { class: 'task-main' }, h('strong', null, title), h('p', null, why)), h('span', { class: 'owner' }, owner))))
        );
      case 'calendar':
        return calendarBlock(b);
      case 'chat':
        return chatBlock(b);
      case 'funnel':
        return funnelBlock(b);
      case 'posters':
        return h(
          'div',
          { class: 'blk' },
          blockHead(b.label),
          h(
            'div',
            { class: 'posters' },
            b.items.map((p) =>
              h(
                'figure',
                { class: 'poster', dataset: { motif: S.ctx.ind.motif, ratio: p.ratio } },
                h('div', { class: 'poster-art' }, h('span', { class: 'p-kicker' }, p.kicker), h('strong', { class: 'p-title' }, p.title), h('span', { class: 'p-sub' }, p.sub), h('span', { class: 'p-foot' }, p.foot)),
                h('figcaption', null, p.kind)
              )
            )
          ),
          h('p', { class: 'meta' }, '版面示意。正式素材以店家實拍照片替換，文字可直接編修。')
        );
      case 'json':
        return h(
          'div',
          { class: 'blk' },
          blockHead(b.label),
          b.note && h('p', { class: 'meta' }, b.note),
          h('details', { class: 'json' }, h('summary', null, '查看交接欄位'), h('pre', null, JSON.stringify(b.obj, null, 2)))
        );
    }
    return h('div');
  }

  function calendarBlock(b) {
    const statusTone = (s) => (s.includes('已') ? 'ok' : s.includes('待審') ? 'warn' : 'muted');
    return h(
      'div',
      { class: 'blk' },
      blockHead(b.label),
      h(
        'ul',
        { class: 'cal' },
        b.items.map((it) => {
          const st = h('span', { class: 'status', dataset: { tone: statusTone(it.status) } }, it.status);
          const act =
            it.status === '待審稿'
              ? h(
                  'button',
                  {
                    class: 'btn-mini',
                    type: 'button',
                    onclick: (e) => {
                      it.status = '已核准・模擬發布';
                      st.textContent = it.status + '（未連平台）';
                      st.dataset.tone = 'ok';
                      e.currentTarget.remove();
                      M.track('post_simulate_publish', { channel: it.channel });
                      toast('模擬發布完成：沒有真的發到平台');
                    },
                  },
                  '核准・模擬發布'
                )
              : null;
          return h('li', null, h('div', { class: 'cal-when' }, h('b', null, it.day), h('span', null, it.time)), h('div', { class: 'cal-what' }, h('span', { class: 'chan' }, it.channel), h('p', null, it.title), h('div', { class: 'cal-st' }, st, act)));
        })
      )
    );
  }

  function chatBlock(b) {
    const log = h('div', { class: 'chatlog', 'aria-live': 'polite' });
    function bubble(f) {
      const actions = h('div', { class: 'bub-act' });
      if (f.handoff) {
        actions.append(h('span', { class: 'status', dataset: { tone: 'danger' } }, '已轉真人・通知店長（模擬）'));
      } else {
        actions.append(
          h(
            'button',
            {
              class: 'btn-mini',
              type: 'button',
              onclick: () => {
                actions.replaceChildren(h('span', { class: 'status', dataset: { tone: 'ok' } }, '店員已採用・模擬送出（未連 LINE）'));
                M.track('line_reply_accept', { chip: f.chip });
              },
            },
            '採用並送出'
          ),
          h(
            'button',
            {
              class: 'btn-mini ghost',
              type: 'button',
              onclick: () => {
                actions.replaceChildren(h('span', { class: 'status', dataset: { tone: 'warn' } }, '改由真人回覆（模擬）'));
                M.track('line_handoff_manual', { chip: f.chip });
              },
            },
            '改由真人回'
          )
        );
      }
      return [
        h('div', { class: 'bub cust' }, h('span', { class: 'who' }, '顧客'), f.q),
        h(
          'div',
          { class: 'bub ai', dataset: { handoff: f.handoff ? '1' : '0' } },
          h('span', { class: 'who' }, f.handoff ? '轉真人接手' : 'AI 建議回覆・等店員確認'),
          f.reason && h('span', { class: 'reason' }, f.reason),
          f.a,
          f.note && h('span', { class: 'reason' }, f.note),
          actions
        ),
      ];
    }
    function ask(f, silent) {
      log.append(...bubble(f));
      if (!silent) {
        M.track('line_sim_ask', { chip: f.chip, handoff: !!f.handoff });
        log.lastElementChild.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      }
    }
    ask(b.faq[0], true);
    return h(
      'div',
      { class: 'blk' },
      blockHead(b.label),
      h('div', { class: 'phone-chat' }, log),
      h('div', { class: 'chips', role: 'group', 'aria-label': '模擬顧客問題' }, b.faq.map((f) => h('button', { class: 'chip', type: 'button', onclick: () => ask(f) }, f.chip)))
    );
  }

  function funnelBlock(b) {
    const max = b.stages[0].value;
    return h(
      'div',
      { class: 'blk' },
      blockHead(b.label, h('span', { class: 'gen', dataset: { gen: '模擬數據' } }, '模擬數據')),
      h(
        'ol',
        { class: 'funnel' },
        b.stages.map((s) =>
          h(
            'li',
            null,
            h('span', { class: 'f-name' }, s.name),
            h('span', { class: 'f-bar' }, h('i', { style: `width:${Math.max(0.6, (s.value / max) * 100).toFixed(1)}%` })),
            h('span', { class: 'f-val' }, fmt(s.value)),
            h('span', { class: 'f-rate' }, s.rate == null ? '' : (s.rate * 100).toFixed(0) + '%')
          )
        )
      ),
      h('p', { class: 'meta' }, '百分比為由上一層轉換的比例。')
    );
  }

  // ── 積木 → 純文字（成果包複製用）──────────────────────────────
  function blocksToText(blocks) {
    return blocks
      .map((b) => {
        switch (b.t) {
          case 'copy':
            return `【${b.label}】\n${b.text}`;
          case 'list':
            return `【${b.label}】\n` + b.items.map((i) => '・' + i).join('\n');
          case 'kv':
            return `【${b.label}】\n` + b.pairs.map(([k, v]) => `${k}：${v}`).join('\n');
          case 'table':
            return `【${b.label}】\n` + b.rows.map((r) => r.map((x, i) => `${b.head[i]}：${x}`).join('｜')).join('\n');
          case 'tasks':
            return `【${b.label}】\n` + b.items.map(([t, w], i) => `${i + 1}. ${t}（${w}）`).join('\n');
          case 'calendar':
            return `【${b.label}】\n` + b.items.map((i) => `${i.day} ${i.time}｜${i.channel}｜${i.title}`).join('\n');
          case 'chat':
            return `【${b.label}】\n` + b.faq.map((f) => `顧客：${f.q}\n${f.handoff ? '轉真人（安撫訊息）' : '建議回覆'}：${f.a}`).join('\n\n');
          case 'funnel':
            return `【${b.label}（模擬）】\n` + b.stages.map((s) => `${s.name} ${fmt(s.value)}`).join(' → ');
          default:
            return '';
        }
      })
      .filter(Boolean)
      .join('\n\n');
  }
  M.blocksToText = blocksToText;

  // ── 產生九宮格內容 ─────────────────────────────────────────────
  function buildCtx(ind, input) {
    const goal = ind.goals.find((g) => g.id === input.goal) || ind.goals[0];
    return { ind, shop: input.shop, product: input.product, audience: input.audience, goal, seed: hash(input.shop + '|' + input.product + '|' + goal.id), mine: S.mode === 'mine', out: {} };
  }
  function generate() {
    const ind = M.industries[S.industry];
    const ctx = buildCtx(ind, S.input);
    S.ctx = ctx;
    for (const m of M.MODULES) if (m.id !== 'director') ctx.out[m.id] = ind.modules[m.id](ctx);
    const d = ind.modules.director(ctx);
    d.blocks.push(
      B.list(
        '團隊今日狀態',
        M.MODULES.filter((m) => m.id !== 'director').map((m) => `${m.no} ${m.name}：${ctx.out[m.id].status}`)
      )
    );
    ctx.out.director = d;
    S.out = ctx.out;
  }

  // ── 各區塊渲染 ─────────────────────────────────────────────────
  function renderTabs() {
    const nav = $('industryTabs');
    nav.replaceChildren(
      ...M.order.map((id) => {
        const ind = M.industries[id];
        const on = S.mode === 'demo' && S.industry === id;
        return h(
          'button',
          {
            class: 'tab',
            type: 'button',
            role: 'tab',
            'aria-selected': on ? 'true' : 'false',
            onclick: () => {
              setDemo(id);
              M.track('industry_switch', { to: id });
            },
          },
          h('b', null, ind.name),
          h('span', null, ind.demo.shop)
        );
      })
    );
  }

  function renderStore() {
    const ind = M.industries[S.industry];
    const c = S.ctx;
    const el = $('store');
    el.replaceChildren(
      h(
        'div',
        { class: 'store-top' },
        h('span', { class: 'badge', dataset: { mode: S.mode } }, S.mode === 'demo' ? '示範店' : '你的店'),
        h('span', { class: 'store-type' }, ind.name),
        S.mode === 'mine' && h('button', { class: 'linkbtn', type: 'button', onclick: () => setDemo(S.industry) }, '回到示範店')
      ),
      h('h2', { class: 'store-name' }, c.shop),
      h('dl', { class: 'store-kv' }, h('dt', null, '主打'), h('dd', null, c.product), h('dt', null, '客群'), h('dd', null, c.audience), h('dt', null, '目標'), h('dd', null, c.goal.label))
    );
    $('pains').replaceChildren(h('p', { class: 'eyebrow' }, ind.name + '老闆最常卡住的地方'), h('ul', null, ind.pains.map((p) => h('li', null, p))));
  }

  function renderGrid() {
    const el = $('grid');
    el.replaceChildren(
      ...M.MODULES.map((m) => {
        const o = S.out[m.id];
        return h(
          'button',
          { class: 'cell', type: 'button', dataset: { mod: m.id }, onclick: () => openModule(m.id, 'grid'), 'aria-label': `${m.no} ${m.name}：${o.preview}，點開看成果` },
          h('span', { class: 'cell-no' }, m.no),
          h('strong', { class: 'cell-name' }, m.name),
          h('span', { class: 'cell-prev' }, o.preview),
          h('span', { class: 'cell-st' }, o.status)
        );
      })
    );
  }

  function openModule(id, from) {
    const m = MOD[id];
    const o = S.out[id];
    showSheet(
      m.name,
      o.blocks.map(renderBlock),
      h('div', { class: 'sheet-meta' }, h('span', { class: 'cell-no' }, m.no), genPill(m.gen), h('span', { class: 'muted' }, S.ctx.shop))
    );
    M.track('grid_cell_open', { module: id, from });
  }
  M.openModule = openModule;

  let lastFocus = null;
  function showSheet(title, kids, meta) {
    const sh = $('sheet');
    lastFocus = document.activeElement;
    $('sheetTitle').textContent = title;
    $('sheetMeta').replaceChildren(meta || '');
    $('sheetBody').replaceChildren(...kids);
    sh.hidden = false;
    document.body.classList.add('locked');
    $('sheetBody').scrollTop = 0;
    $('sheetClose').focus();
  }
  function closeSheet() {
    $('sheet').hidden = true;
    document.body.classList.remove('locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // 工作流：目標 → 文案 → 短影音 → PO 文 → LINE →（產業加值步驟）→ 成效
  let wfRun = 0;
  async function renderWorkflow(animate) {
    const run = ++wfRun;
    const ind = M.industries[S.industry];
    const c = S.ctx;
    const steps = [{ mod: 'goal', title: '選擇行銷目標' }, ...ind.workflow];
    const el = $('workflow');
    const prog = h('i');
    const list = h('ol', { class: 'wf' });
    el.replaceChildren(
      h('p', { class: 'eyebrow' }, S.mode === 'demo' ? `${ind.name}・完整示範案例` : '你的店・第一條 AI 行銷工作流'),
      h('h3', { class: 'sec-title' }, S.mode === 'demo' ? ind.caseTitle : `${c.shop}：${c.goal.label}`),
      h('div', { class: 'wf-prog', role: 'progressbar', 'aria-label': '工作流進度', 'aria-valuemin': 0, 'aria-valuemax': steps.length }, prog),
      list
    );
    const items = steps.map((s, i) => {
      const owner = s.mod === 'goal' ? MOD.director : MOD[s.mod];
      const body = h('div', { class: 'wf-body' });
      const st = h('span', { class: 'wf-st' }, '等待中');
      const li = h('li', { class: 'wf-step', dataset: { state: 'wait' } }, h('div', { class: 'wf-head' }, h('span', { class: 'wf-no' }, String(i + 1)), h('div', null, h('strong', null, s.title), h('span', { class: 'wf-who' }, owner.name + '・' + owner.gen)), st), body);
      list.append(li);
      return { s, li, body, st };
    });
    for (let i = 0; i < items.length; i++) {
      const { s, li, body, st } = items[i];
      if (animate) {
        li.dataset.state = 'work';
        st.textContent = '工作中…';
        await wait(650);
        if (run !== wfRun) return;
      }
      li.dataset.state = 'done';
      st.textContent = '完成';
      body.replaceChildren(...stepBody(s, c));
      prog.style.width = ((i + 1) / items.length) * 100 + '%';
      $('workflow').querySelector('.wf-prog').setAttribute('aria-valuenow', i + 1);
    }
    if (animate) {
      M.track('workflow_complete', { goal: c.goal.id, steps: items.length });
      renderResults();
    }
  }

  function stepBody(s, c) {
    if (s.mod === 'goal') {
      return [
        renderBlock(
          B.kv('本次任務', [
            ['行銷目標', c.goal.label],
            ['為什麼先做這個', c.goal.why],
            ['主打', c.product],
            ['給客人的理由', c.goal.offer],
            ['主要客群', c.audience],
            ['成功指標', c.goal.kpi],
          ])
        ),
      ];
    }
    const o = S.out[s.mod];
    const picks = (o.wf || [0, 1]).map((i) => o.blocks[i]).filter(Boolean);
    return [...picks.map(renderBlock), h('button', { class: 'linkbtn', type: 'button', onclick: () => openModule(s.mod, 'workflow') }, `看${MOD[s.mod].name}完整成果`)];
  }

  // 成果包：可直接複製的四份 + 成果卡
  function packs() {
    const o = S.out;
    return [
      ['文案', '社群與 LINE 文案', blocksToText(o.copy.blocks)],
      ['短影音企劃', '主題、分鏡、字幕、CTA', blocksToText(o.video.blocks)],
      ['發布計畫', '本週行事曆與發布規則', blocksToText(o.post.blocks)],
      ['客服回覆範例', '常見詢問與轉真人規則', blocksToText(o.line.blocks)],
    ];
  }
  function renderResults() {
    const c = S.ctx;
    const el = $('results');
    const ps = packs();
    const all = `${c.shop}｜AI 行銷員工成果包（${c.goal.label}）\n內容為模板生成，發布前請確認價格與檔期。\n\n` + ps.map(([n, , t]) => `==== ${n} ====\n${t}`).join('\n\n');
    const img = h('img', { class: 'card-img', alt: `${c.shop} 的 AI 行銷員工體驗成果卡` });
    el.replaceChildren(
      h('p', { class: 'eyebrow' }, '成果展示'),
      h('h3', { class: 'sec-title' }, S.mode === 'demo' ? '示範店拿到的成果' : '這些是你的店現在就能用的成果'),
      h(
        'ul',
        { class: 'packs' },
        ps.map(([n, d, t]) => h('li', null, h('div', null, h('strong', null, n), h('span', null, `${d}・${fmt(t.length)} 字`)), h('button', { class: 'btn-copy', type: 'button', onclick: () => copyText(t, n) }, '複製')))
      ),
      h('button', { class: 'btn-wide', type: 'button', onclick: () => copyText(all, '全部成果') }, '一次複製全部成果'),
      h('div', { class: 'cardbox' }, h('p', { class: 'eyebrow' }, '我的 AI 行銷員工體驗成果卡'), img, h('p', { class: 'meta' }, '手機可長按圖片儲存，或截圖分享給合夥人、店長。'))
    );
    drawCard().then((url) => {
      img.src = url;
    });
    renderDelegate();
  }

  // ── 成果卡（canvas → 圖片）────────────────────────────────────
  function cssVar(n) {
    return getComputedStyle(document.body).getPropertyValue(n).trim();
  }
  async function drawCard() {
    try {
      await Promise.race([document.fonts.ready, wait(1500)]);
    } catch (e) {}
    const c = S.ctx;
    const W = 1080,
      H = 1920;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    const accent = cssVar('--card-accent') || '#6A3D9A';
    const F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    g.fillStyle = '#F6F6F9';
    g.fillRect(0, 0, W, H);
    g.fillStyle = accent;
    g.fillRect(0, 0, W, 360);
    g.fillStyle = '#FFFFFF';
    g.font = `500 34px ${F}`;
    g.fillText('我的 AI 行銷員工體驗成果卡', 72, 104);
    g.font = `900 92px ${F}`;
    wrap(g, c.shop, 72, 220, W - 144, 100, 1);
    g.font = `500 36px ${F}`;
    g.fillText(`${c.ind.name}・${c.goal.label}`, 72, 300);

    let y = 470;
    const section = (title) => {
      g.fillStyle = accent;
      g.font = `700 36px ${F}`;
      g.fillText(title, 72, y);
      y += 66;
    };
    const body = (text, size, lines) => {
      g.fillStyle = '#1A1D26';
      g.font = `500 ${size}px ${F}`;
      y = wrap(g, text, 72, y, W - 144, size * 1.5, lines) + size * 1.5 + 8;
    };
    section('今日最重要的三件行銷任務');
    S.out.director.blocks[0].items.forEach(([t], i) => body(`${i + 1}. ${t}`, 40, 2));
    y += 34;
    section('AI 文案員工寫好的開頭');
    body(S.out.copy.blocks[0].text.split('\n').filter(Boolean).slice(0, 2).join(' '), 38, 3);
    y += 34;
    section('短影音開場 3 秒');
    body(c.goal.hook, 38, 2);
    y += 34;
    section('本週發布計畫');
    body(S.out.post.preview + '（店家確認後發布）', 38, 1);
    y += 34;
    section('預期成效（模擬）');
    const st = S.out.metrics.blocks[0].stages;
    body(st.map((s) => `${s.name} ${fmt(s.value)}`).join(' → '), 38, 3);

    g.fillStyle = '#E3E4EA';
    g.fillRect(72, H - 210, W - 144, 2);
    g.fillStyle = '#5A6070';
    g.font = `500 28px ${F}`;
    g.fillText('百業 AI 行銷員工｜G1 體驗版', 72, H - 150);
    g.fillText('內容為模板生成・數據為模擬・未連任何發布平台', 72, H - 104);
    return cv.toDataURL('image/png');
  }
  function wrap(g, text, x, y, maxW, lh, maxLines) {
    const chars = Array.from(String(text));
    let line = '',
      n = 0;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (g.measureText(test).width > maxW && line) {
        n++;
        if (n === maxLines) {
          while (g.measureText(line + '…').width > maxW) line = line.slice(0, -1);
          g.fillText(line + '…', x, y);
          return y;
        }
        g.fillText(line, x, y);
        y += lh;
        line = chars[i];
      } else line = test;
    }
    g.fillText(line, x, y);
    return y;
  }

  // ── 委派意願（驗收核心 3）──────────────────────────────────────
  function renderDelegate() {
    const el = $('delegate');
    const picked = new Set(S.delegated);
    const result = h('div', { class: 'deleg-result', 'aria-live': 'polite' });
    const chips = M.MODULES.map((m) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': picked.has(m.id) ? 'true' : 'false',
          onclick: (e) => {
            const b = e.currentTarget;
            if (picked.has(m.id)) picked.delete(m.id);
            else picked.add(m.id);
            b.setAttribute('aria-pressed', picked.has(m.id) ? 'true' : 'false');
          },
        },
        m.name.replace('AI ', '')
      )
    );
    el.replaceChildren(
      h('p', { class: 'eyebrow' }, '換你決定'),
      h('h3', { class: 'sec-title' }, '看完成果，哪些工作你願意先交給 AI 員工做？'),
      h('p', { class: 'muted' }, '可以多選。AI 先做初稿，最後都由你或店員確認。'),
      h('div', { class: 'chips' }, chips),
      h(
        'button',
        {
          class: 'btn-wide',
          type: 'button',
          onclick: () => {
            S.delegated = M.MODULES.filter((m) => picked.has(m.id)).map((m) => m.id);
            const rec = recommend(S.delegated);
            result.replaceChildren(
              h('p', null, S.delegated.length ? `你選了 ${S.delegated.length} 項：${S.delegated.map((id) => MOD[id].name).join('、')}。` : '你目前還不想交給 AI，沒關係，可以先從學會操作開始。'),
              h('p', null, h('strong', null, '建議起點：' + M.plans.list.find((p) => p.id === rec).name))
            );
            highlightPlan(rec);
            M.track('delegate_select', { modules: S.delegated, count: S.delegated.length, recommend: rec });
          },
        },
        '送出我的選擇'
      ),
      result
    );
  }
  function recommend(ids) {
    if (ids.length >= 5 || ids.includes('line') || ids.includes('member') || ids.includes('ads')) return 'C';
    if (ids.length >= 2) return 'B';
    return 'A';
  }

  // ── 下一步（驗收核心 4）────────────────────────────────────────
  function renderNext() {
    const el = $('next');
    const panel = h('div', { class: 'next-panel', 'aria-live': 'polite' });
    el.replaceChildren(
      h('p', { class: 'eyebrow' }, '下一步'),
      h('h3', { class: 'sec-title' }, '你想怎麼讓這支 AI 行銷團隊開始上班？'),
      h(
        'div',
        { class: 'next-btns' },
        M.plans.next.map((n) =>
          h(
            'button',
            {
              class: 'next-btn',
              type: 'button',
              dataset: { plan: n.plan },
              onclick: (e) => {
                S.choice = n.id;
                const cur = e.currentTarget;
                el.querySelectorAll('.next-btn').forEach((b) => b.setAttribute('aria-pressed', b === cur ? 'true' : 'false'));
                showNext(n, panel);
                M.track('cta_click', { choice: n.id, plan: n.plan });
              },
            },
            h('strong', null, n.label),
            h('span', null, n.sub)
          )
        )
      ),
      panel
    );
  }
  function showNext(n, panel) {
    const plan = M.plans.list.find((p) => p.id === n.plan);
    const c = S.ctx;
    const summary =
      `【AI 行銷員工諮詢需求】\n店型：${c.ind.name}\n店名：${c.shop}\n主打：${c.product}\n客群：${c.audience}\n行銷目標：${c.goal.label}\n我的選擇：${n.label}（${plan.name}）` +
      (S.delegated.length ? `\n願意先交給 AI：${S.delegated.map((id) => MOD[id].name).join('、')}` : '');
    panel.replaceChildren(
      h('p', null, h('strong', null, `對應：${plan.name}`)),
      h('ul', { class: 'bul' }, n.then.map((t) => h('li', null, t))),
      h('p', { class: 'note', dataset: { tone: 'info' } }, 'G1 體驗版不收集姓名、電話或 LINE ID。正式版會在這裡接上諮詢表單或 LINE 官方帳號，並依推薦夥伴與同意規格處理。現在可以先複製需求摘要，自己傳給顧問。'),
      h('button', { class: 'btn-wide', type: 'button', onclick: () => copyText(summary, '需求摘要') }, '複製我的需求摘要')
    );
    highlightPlan(n.plan);
  }

  function highlightPlan(id) {
    document.querySelectorAll('.plan').forEach((p) => p.setAttribute('data-hl', p.dataset.plan === id ? '1' : '0'));
  }

  function renderPlans() {
    const el = $('plans');
    const P = M.plans;
    el.replaceChildren(
      h('p', { class: 'eyebrow' }, '服務方案'),
      h('h3', { class: 'sec-title' }, '三種合作方式'),
      h('p', { class: 'muted' }, P.intro),
      h(
        'div',
        { class: 'plans' },
        P.list.map((p) =>
          h(
            'article',
            {
              class: 'plan',
              dataset: { plan: p.id },
              'data-hl': '0',
              tabindex: '-1',
            },
            h('div', { class: 'plan-head' }, h('span', { class: 'plan-id' }, '方案 ' + p.id), h('h4', null, p.name), h('p', null, p.pitch)),
            h(
              'dl',
              { class: 'plan-kv' },
              h('dt', null, '適合'),
              h('dd', null, p.fit),
              h('dt', null, '交付範圍'),
              h('dd', null, h('ul', { class: 'bul' }, p.deliver.map((d) => h('li', null, d)))),
              h('dt', null, '人工審核責任'),
              h('dd', null, h('ul', { class: 'bul' }, p.review.map((d) => h('li', null, d)))),
              h('dt', null, '平台費用'),
              h('dd', null, p.fees),
              h('dt', null, '可自動化程度'),
              h('dd', null, h('span', { class: 'meter', 'aria-label': `自動化程度 ${p.auto} / 5` }, [1, 2, 3, 4, 5].map((i) => h('i', { dataset: { on: i <= p.auto ? '1' : '0' } }))), ' ', p.autoText),
              h('dt', null, '價格'),
              h('dd', null, P.price)
            ),
            h(
              'button',
              {
                class: 'linkbtn',
                type: 'button',
                onclick: () => {
                  M.track('plan_interest', { plan: p.id });
                  toast(`已記下你對方案 ${p.id} 有興趣（只存在這台裝置）`);
                },
              },
              '我對這個方案有興趣'
            )
          )
        )
      )
    );
  }

  // ── 換成我的店：表單 ───────────────────────────────────────────
  let formInd = null;
  function renderForm() {
    const f = $('tryForm');
    formInd = formInd || S.industry;
    const ind = M.industries[formInd];
    const typeChips = M.order.map((id) =>
      h(
        'button',
        {
          class: 'chip',
          type: 'button',
          'aria-pressed': id === formInd ? 'true' : 'false',
          onclick: () => {
            const keep = readForm();
            formInd = id;
            renderForm();
            $('f-shop').value = keep.shop;
          },
        },
        M.industries[id].name
      )
    );
    const presetChips = (key, input) =>
      h(
        'div',
        { class: 'chips small' },
        ind.presets[key].map((v) =>
          h(
            'button',
            {
              class: 'chip',
              type: 'button',
              onclick: () => {
                $(input).value = v;
                $(input).dispatchEvent(new Event('input'));
              },
            },
            v
          )
        )
      );
    f.replaceChildren(
      h(
        'form',
        { id: 'tryFormEl', novalidate: true, onsubmit: onSubmit },
        h('div', { class: 'form-head' }, h('h3', { class: 'sec-title' }, '換成我的店'), h('p', { class: 'muted' }, '五個欄位，免登入、免留電話。')),
        h('fieldset', null, h('legend', null, '1. 店型'), h('div', { class: 'chips' }, typeChips)),
        h('label', { for: 'f-shop' }, '2. 店名'),
        h('input', { id: 'f-shop', name: 'shop', maxlength: 20, autocomplete: 'off', placeholder: ind.placeholder.shop, required: true }),
        h('label', { for: 'f-product' }, '3. 主打服務或產品'),
        h('input', { id: 'f-product', name: 'product', maxlength: 30, autocomplete: 'off', placeholder: ind.placeholder.product, required: true }),
        presetChips('product', 'f-product'),
        h('label', { for: 'f-aud' }, '4. 主要客群'),
        h('input', { id: 'f-aud', name: 'audience', maxlength: 30, autocomplete: 'off', placeholder: ind.placeholder.audience, required: true }),
        presetChips('audience', 'f-aud'),
        h(
          'fieldset',
          null,
          h('legend', null, '5. 本次行銷目標'),
          h(
            'div',
            { class: 'goals' },
            ind.goals.map((g, i) =>
              h('label', { class: 'goal' }, h('input', { type: 'radio', name: 'goal', value: g.id, checked: i === 0 }), h('span', null, h('b', null, g.label), h('small', null, g.why)))
            )
          )
        ),
        h('p', { class: 'form-err', id: 'formErr', role: 'alert' }),
        h('button', { class: 'btn-primary', type: 'submit' }, '讓 AI 員工開始工作'),
        h('p', { class: 'meta' }, '你輸入的內容只在這個瀏覽器裡產生示範，不會上傳、不會存到伺服器。內容為模板生成，不是真實 AI 模型輸出。')
      )
    );
  }
  function readForm() {
    const v = (id) => (($(id) && $(id).value) || '').trim();
    const g = document.querySelector('#tryFormEl input[name=goal]:checked');
    return { shop: v('f-shop'), product: v('f-product'), audience: v('f-aud'), goal: g ? g.value : null };
  }
  function onSubmit(e) {
    e.preventDefault();
    const d = readForm();
    const miss = [];
    if (!d.shop) miss.push('店名');
    if (!d.product) miss.push('主打服務或產品');
    if (!d.audience) miss.push('主要客群');
    if (miss.length) {
      $('formErr').textContent = `還差：${miss.join('、')}。可以點下方的建議快速填入。`;
      const first = { 店名: 'f-shop', 主打服務或產品: 'f-product', 主要客群: 'f-aud' }[miss[0]];
      $(first).focus();
      M.track('try_submit_invalid', { missing: miss.length });
      return;
    }
    $('formErr').textContent = '';
    S.mode = 'mine';
    S.industry = formInd;
    S.input = d;
    S.delegated = [];
    M.track('try_submit', { goal: d.goal, shop_len: d.shop.length, used_preset: M.industries[formInd].presets.product.includes(d.product) });
    applyAll(true);
    $('tryForm').hidden = true;
    $('tryCta').hidden = false;
    $('tryBtn').textContent = '再換一次內容';
    document.getElementById('store').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  function openForm() {
    formInd = S.industry;
    renderForm();
    $('tryForm').hidden = false;
    $('tryCta').hidden = true;
    $('tryForm').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => $('f-shop').focus({ preventScroll: true }), reduced() ? 0 : 350);
    M.track('try_start', {});
  }

  // ── 測試者面板（驗收用）───────────────────────────────────────
  function renderTester() {
    const el = $('tester');
    if (!el) return;
    const E = S.events;
    const count = (n, f) => E.filter((e) => e.event === n && (!f || f(e))).length;
    const sessions = new Set(E.map((e) => e.session_id)).size;
    const kpi = [
      ['1. 換成自己的店', count('try_submit'), '送出「換成我的店」'],
      ['2. 拿到可用成果', count('output_copy'), '複製文案／企劃／回覆'],
      ['3. 願意交給 AI', count('delegate_select', (e) => e.props.count > 0), '委派至少 1 項'],
      ['4. 詢問服務', count('cta_click') + count('plan_interest'), '點下一步或方案'],
    ];
    el.replaceChildren(
      h('p', { class: 'muted' }, `這台裝置累計 ${E.length} 筆事件、${sessions} 個體驗場次。資料只存在本機瀏覽器，不含店名等輸入內容。`),
      h('div', { class: 'kpis' }, kpi.map(([k, v, d]) => h('div', { class: 'kpi' }, h('span', null, k), h('b', null, v), h('small', null, d)))),
      h('ol', { class: 'evlog', reversed: true }, E.slice(-12).reverse().map((e) => h('li', null, h('code', null, e.event), ' ', h('span', { class: 'muted' }, `${e.ts.slice(11, 19)}・${e.industry || ''}・${e.mode}`)))),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn-mini', type: 'button', onclick: () => copyText(JSON.stringify(S.events, null, 2), '事件紀錄 JSON') }, '複製事件紀錄 JSON'),
        h(
          'button',
          {
            class: 'btn-mini ghost',
            type: 'button',
            onclick: () => {
              S.events = [];
              try {
                localStorage.removeItem(EV_KEY);
              } catch (e) {}
              renderTester();
            },
          },
          '清除紀錄'
        )
      )
    );
  }

  // ── 流程控制 ─────────────────────────────────────────────────
  function applyAll(animate) {
    document.body.dataset.industry = S.industry;
    generate();
    renderTabs();
    renderStore();
    renderGrid();
    renderNext();
    renderPlans();
    if (animate) {
      $('results').replaceChildren();
      $('delegate').replaceChildren();
      renderWorkflow(true);
    } else {
      renderWorkflow(false);
      renderResults();
    }
  }
  function setDemo(id) {
    S.mode = 'demo';
    S.industry = id;
    S.input = Object.assign({}, M.industries[id].demo);
    S.delegated = [];
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    applyAll(false);
    $('tryBtn').textContent = '30 秒免費體驗｜換成我的店';
    $('tryForm').hidden = true;
    $('tryCta').hidden = false;
  }

  M.boot = () => {
    const fromHash = location.hash.slice(1);
    const first = M.industries[fromHash] ? fromHash : M.order[0];
    $('tryBtn').addEventListener('click', openForm);
    $('floatTry').addEventListener('click', () => {
      M.track('float_cta_click', {});
      openForm();
    });
    $('sheetClose').addEventListener('click', closeSheet);
    $('sheet').addEventListener('click', (e) => {
      if (e.target.id === 'sheet') closeSheet();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('sheet').hidden) closeSheet();
    });
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (M.industries[id] && !(S.mode === 'demo' && S.industry === id)) setDemo(id);
    });
    // 九宮格下方的主 CTA 不在畫面上時，顯示底部浮動 CTA
    if ('IntersectionObserver' in window) {
      const fl = $('floatWrap');
      let ctaVisible = true,
        formOpen = false;
      const sync = () => (fl.hidden = ctaVisible || formOpen || S.mode === 'mine' || window.scrollY < 300);
      new IntersectionObserver((es) => {
        ctaVisible = es[0].isIntersecting;
        sync();
      }).observe($('tryCta'));
      new IntersectionObserver((es) => {
        formOpen = es[0].isIntersecting;
        sync();
      }).observe($('tryForm'));
      window.addEventListener('scroll', sync, { passive: true });
    }
    setDemo(first);
    M.track('demo_view', { landing: first, version: M.version });
  };
})();
