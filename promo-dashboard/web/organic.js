// A. 日常 FB 發文：主體 → 帳號或社團 → 每篇貼文；發文日曆與貼文清單兩種檢視
import { useState } from 'preact/hooks';
import { html, api, useApi, V, Kpi, Badge, Modal, Form, Field, Loading, Empty } from './ui.js';
import { fmt, md, ymd, rangeText } from './format.js';
import { OrganicTable, CountRules, PostStatus, Reconcile } from './shared.js';
import { BUCKETS } from '../src/organic.js';

const STATUSES = ['待製作', '待審核', '待發布', '已發布', '取消'];
const WD = ['一', '二', '三', '四', '五', '六', '日'];

function qs(params) {
  const s = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return s ? '?' + s : '';
}

export function OrganicPage({ q, params }) {
  const bucket = params.bucket in BUCKETS ? params.bucket : '';
  const view = params.view === 'list' || bucket ? 'list' : 'calendar';
  const filters = { type: params.type || '', outlet: params.outlet || '', project: params.project || '' };
  const st = useApi('/organic?' + q + qs(filters).replace('?', '&'));
  const [modal, setModal] = useState(null);
  const go = (patch) => { location.hash = '#/organic' + qs({ view, ...filters, ...patch }); };
  return html`<${Loading} state=${st}>${(d) => {
    const outlets = d.outlets.filter((o) => !filters.type || o.type === filters.type);
    const isTest = d.outlets.some((o) => o.is_test);
    const summaryRows = filters.type
      ? d.byOutlet.map((o) => ({ ...o, label: o.name, sub: o.label, key: o.id }))
      : d.bySubject.map((s) => ({ ...s, sub: `${s.outlets} 個帳號或社團` }));
    return html`<main class="page">
      ${isTest ? html`<div class="test-banner" role="note"><b>測試資料</b> 發布位置與貼文都是標示【測試】的程式產生資料。</div>` : null}
      <div class="page-head">
        <div><div class="crumb"><a href="#/">宣傳總覽</a> ／ 日常 FB 發文</div>
          <h1>日常 FB 發文${filters.type ? '：' + d.subjects[filters.type] : ''}${filters.outlet ? '・' + (d.outlets.find((o) => o.id === filters.outlet)?.name || '') : ''}</h1>
          <p class="sub">${rangeText(d.range)}・預計依預定日期、已發依實際發布日期</p></div>
        <div class="head-actions">
          <button class="btn small" onClick=${() => setModal('outlet')}>＋ 新增帳號或社團</button>
          <button class="btn primary small" onClick=${() => setModal('post')}>＋ 新增發文</button>
        </div>
      </div>
      <div class="filters">
        <div class="chips" role="group" aria-label="發布主體">
          <button type="button" class=${'chip' + (!filters.type ? ' on' : '')} aria-pressed=${!filters.type} onClick=${() => go({ type: '', outlet: '' })}>全部主體</button>
          ${Object.entries(d.subjects).map(([k, l]) => html`<button type="button" class=${'chip' + (filters.type === k ? ' on' : '')} aria-pressed=${filters.type === k} onClick=${() => go({ type: k, outlet: '' })}>${l}</button>`)}
        </div>
        <div class="filter-row">
          <label class="field inline"><span>帳號或社團</span>
            <select id="outlet-filter" value=${filters.outlet} onChange=${(e) => go({ outlet: e.target.value })}>
              <option value="">全部</option>${outlets.map((o) => html`<option value=${o.id}>${d.subjects[o.type]}・${o.name}</option>`)}
            </select></label>
          <label class="field inline"><span>支援專案</span>
            <select id="project-filter" value=${filters.project} onChange=${(e) => go({ project: e.target.value })}>
              <option value="">全部貼文</option><option value="none">未掛專案</option>${d.projects.map((p) => html`<option value=${p.id}>${p.code}｜${p.name}</option>`)}
            </select></label>
          <div class="seg" role="group" aria-label="檢視方式">
            <button type="button" class=${view === 'calendar' ? 'on' : ''} aria-pressed=${view === 'calendar'} onClick=${() => go({ view: 'calendar' })}>發文日曆</button>
            <button type="button" class=${view === 'list' ? 'on' : ''} aria-pressed=${view === 'list'} onClick=${() => go({ view: 'list' })}>貼文清單</button>
          </div>
        </div>
      </div>
      <section class="kpis compact" aria-label="本期發文">
        <${Kpi} label="預計發文"><span class="val">${fmt.int(d.total.counts.planned)}</span></${Kpi}>
        <${Kpi} label="已發文"><span class="val">${fmt.int(d.total.counts.published)}</span></${Kpi}>
        <${Kpi} label="待發文" sub=${d.total.counts.overdue ? html`<span class="late">其中逾期 ${d.total.counts.overdue}</span>` : '沒有逾期'}><span class="val">${fmt.int(d.total.counts.pending)}</span></${Kpi}>
        <${Kpi} label="按讚" m=${d.total.likes} /><${Kpi} label="留言" m=${d.total.comments} /><${Kpi} label="分享" m=${d.total.shares} />
        <${Kpi} label="可確認詢問" m=${d.total.inquiries} sub="人工確認來源" />
      </section>
      <section class="panel" aria-labelledby="h-rc">
        <h2 class="sec" id="h-rc">發文數核對</h2>
        <${Reconcile} c=${d.total.counts} linkOf=${(k) => '#/organic' + qs({ view: 'list', ...filters, bucket: k })} />
      </section>
      <section class="panel">
        <${OrganicTable} first=${filters.type ? '帳號或社團' : '發布主體'} rows=${summaryRows} total=${d.total}
          linkOf=${(r) => '#/organic' + qs({ view, project: filters.project, ...(filters.type ? { type: filters.type, outlet: r.id } : { type: r.type }) })} />
        <${CountRules} />
      </section>
      <section class="panel">
        ${view === 'calendar' ? html`<${Calendar} posts=${d.posts} range=${d.range} today=${d.today} subjects=${d.subjects} />` : html`${bucket ? html`<div class="filter-note" role="status">只顯示「${BUCKETS[bucket]}」${d.posts.filter((p) => p.flags[bucket]).length} 篇 <a class="btn tiny" href=${'#/organic' + qs({ view: 'list', ...filters })}>顯示全部</a></div>` : null}
          <${PostList} posts=${bucket ? d.posts.filter((p) => p.flags[bucket]) : d.posts} subjects=${d.subjects} />`}
      </section>
      ${modal === 'post' ? html`<${PostForm} meta=${d} preset=${{ outlet_id: filters.outlet, project_id: filters.project !== 'none' ? filters.project : '' }} onClose=${() => setModal(null)} onDone=${(id) => { setModal(null); location.hash = '#/post/' + id; }} />` : null}
      ${modal === 'outlet' ? html`<${Modal} title="新增帳號或社團" onClose=${() => setModal(null)}>
        <${Form} onCancel=${() => setModal(null)} onSubmit=${async (f) => { await api('POST', '/outlets', f); setModal(null); st.reload(); }}>
          <${Field} label="發布主體" name="type" value=${filters.type || 'page'} options=${Object.entries(d.subjects)} />
          <${Field} label="名稱" name="name" required />
          <${Field} label="網址" name="url" placeholder="https://..." />
          <${Field} label="負責人" name="owner" />
        </${Form}>
      </${Modal}>` : null}
    </main>`;
  }}</${Loading}>`;
}

const postDay = (p) => (p.status === '已發布' && p.published_date ? p.published_date : p.planned_date);

function Calendar({ posts, range, today, subjects }) {
  if (range.period === 'all') return html`<p class="muted">「全部期間」不顯示日曆，請改用貼文清單或選擇本週、本月。</p>`;
  const from = range.from;
  const to = range.fullTo;
  const start = new Date(from + 'T00:00:00Z');
  const lead = (start.getUTCDay() + 6) % 7;
  const days = [];
  for (let i = -lead; ; i++) {
    const d = new Date(start); d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (iso > to && days.length % 7 === 0) break;
    days.push(iso);
    if (days.length > 42) break;
  }
  const byDay = {};
  for (const p of posts) { const d = postDay(p); if (d) (byDay[d] ||= []).push(p); }
  return html`<div>
    <h2 class="sec">發文日曆</h2>
    <p class="sec-note">已發布的貼文放在實際發布日；其他放在預定日。點貼文看單篇。</p>
    <div class="cal" role="grid" aria-label="發文日曆">
      ${WD.map((w) => html`<div class="cal-wd" role="columnheader">週${w}</div>`)}
      ${days.map((iso) => {
        const out = iso < from || iso > to;
        const list = byDay[iso] || [];
        return html`<div class=${'cal-day' + (out ? ' out' : '') + (iso === today ? ' today' : '') + (list.length ? '' : ' empty')} role="gridcell">
          <div class="cal-date">${md(iso)}<span class="show-sm"> 週${WD[(new Date(iso + 'T00:00:00Z').getUTCDay() + 6) % 7]}</span>${iso === today ? html` <b class="today-tag">今天</b>` : null}</div>
          ${out ? null : list.map((p) => html`<a class="cal-post" href=${'#/post/' + p.id}>
            <${PostStatus} status=${p.status} late=${p.flags.overdue} />
            <span class="cal-title">${p.title.replace('【測試】', '')}</span>
            <span class="cal-meta">${subjects[p.outlet?.type]}・${p.outlet?.name.replace('【測試】', '')}・${p.owner || '待指派'}</span>
            ${p.status === '已發布' && p.planned_date && p.planned_date !== p.published_date ? html`<span class="cal-meta">預定 ${md(p.planned_date)}</span>` : null}
            ${!p.planned_date ? html`<span class="cal-meta">臨時加發（無預定日）</span>` : null}
          </a>`)}
        </div>`;
      })}
    </div>
  </div>`;
}

/** 每篇在本期的歸類（與「發文數核對」同一套口徑） */
function bucketOf(f) {
  if (f.cancelled) return '取消';
  if (f.onPlan) return '依期發布';
  if (f.crossIn) return '跨期補發';
  if (f.extra) return '臨時加發';
  if (f.plannedOut) return '期外發布';
  if (f.overdue) return '待發・逾期';
  if (f.pending) return '待發';
  return '';
}

function PostList({ posts, subjects }) {
  const rows = [...posts].sort((a, b) => String(postDay(b)).localeCompare(String(postDay(a))));
  if (!rows.length) return html`<${Empty} title="這段期間沒有貼文" />`;
  return html`<div>
    <h2 class="sec">貼文清單 <span class="count">${rows.length}</span></h2>
    <div class="tbl"><table class="data">
      <thead><tr><th>主題</th><th>日期</th><th>狀態</th><th class="hide-sm">負責人</th><th class="num hide-sm">讚</th><th class="num hide-sm">留言</th><th class="num hide-sm">分享</th><th class="num hide-sm">詢問</th><th class="hide-sm">連結</th></tr></thead>
      <tbody>${rows.map((p) => html`<tr>
        <td><a href=${'#/post/' + p.id}><b>${p.title}</b></a><div class="muted small">${subjects[p.outlet?.type]}・${p.outlet?.name}${p.project ? html`・<span class="proj-code">${p.project.code}</span>` : ''}</div>
          <div class="show-sm small muted">讚 ${p.likes ?? '—'}・留言 ${p.comments ?? '—'}・分享 ${p.shares ?? '—'}</div></td>
        <td class="small nowrap">${p.published_date ? '發布 ' + md(p.published_date) : p.planned_date ? '預定 ' + md(p.planned_date) : '—'}${p.published_date && p.planned_date && p.planned_date !== p.published_date ? html`<div class="muted">預定 ${md(p.planned_date)}</div>` : null}</td>
        <td><${PostStatus} status=${p.status} late=${p.flags.overdue} /><div class="small muted">${bucketOf(p.flags)}</div></td>
        <td class="small hide-sm">${p.owner || '待指派'}</td>
        ${['likes', 'comments', 'shares', 'inquiries'].map((k) => html`<td class="num hide-sm">${p.status !== '已發布' ? html`<span class="muted">—</span>` : p[k] == null ? html`<span class="state s-not_connected sm" title="尚未登錄（人工登錄）">未登錄</span>` : fmt.int(p[k])}</td>`)}
        <td class="hide-sm">${p.url ? html`<a href=${p.url} target="_blank" rel="noopener">開啟</a>` : '—'}</td>
      </tr>`)}</tbody>
    </table></div>
    <p class="note">「未登錄」表示貼文已發布但還沒人工登錄互動數字，不以 0 計。</p>
  </div>`;
}

export function PostPage({ id }) {
  const st = useApi('/posts/' + id);
  const [edit, setEdit] = useState(false);
  return html`<${Loading} state=${st}>${(d) => {
    const p = d.post;
    const late = p.status !== '已發布' && p.status !== '取消' && p.planned_date && p.planned_date < d.today;
    const metric = (k, label) => html`<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${p.status !== '已發布' ? html`<span class="state s-not_computed">尚未發布</span>` : p[k] == null ? html`<span class="state s-not_connected">尚未登錄</span>` : html`<span class="val">${fmt.int(p[k])}</span>`}</div></div>`;
    return html`<main class="page">
      ${p.is_test ? html`<div class="test-banner" role="note"><b>測試資料</b> 這篇是測試貼文。</div>` : null}
      <div class="page-head">
        <div><div class="crumb"><a href="#/">宣傳總覽</a> ／ <a href=${'#/organic?type=' + d.outlet.type}>${d.subjects[d.outlet.type]}</a> ／ <a href=${'#/organic?type=' + d.outlet.type + '&outlet=' + d.outlet.id}>${d.outlet.name}</a></div>
          <h1>${p.title}</h1>
          <p class="sub"><${PostStatus} status=${p.status} late=${late} />・${d.subjects[d.outlet.type]}・${d.outlet.name}・負責人 ${p.owner || '待指派'}</p></div>
        <div class="head-actions"><button class="btn primary small" onClick=${() => setEdit(true)}>編輯／登錄成效</button></div>
      </div>
      <section class="facts">
        <div><span>預定日期</span><b>${p.planned_date ? ymd(p.planned_date) : '無（臨時加發）'}</b></div>
        <div><span>實際發布日期</span><b>${ymd(p.published_date)}</b></div>
        <div><span>共同題材</span><b>${d.topic?.title || '無'}</b></div>
        <div><span>支援專案</span><b>${d.project ? html`<a href=${'#/p/' + d.project.id}>${d.project.code}｜${d.project.name}</a>` : '無（日常發文）'}</b></div>
        <div><span>發文目的</span><b>${p.purpose || '待填'}</b></div>
        <div><span>引流去向</span><b>${p.destination || '待填'}</b></div>
        <div><span>貼文連結</span><b>${p.url ? html`<a href=${p.url} target="_blank" rel="noopener">開啟貼文</a>` : '尚無'}</b></div>
        <div><span>素材</span><b>${p.asset || '—'}</b></div>
      </section>
      <section class="panel"><h2 class="sec">內容</h2><p class="content">${p.content || '待填'}</p></section>
      <section class="panel">
        <h2 class="sec">成效</h2>
        <div class="kpis compact">${metric('likes', '按讚')}${metric('comments', '留言')}${metric('shares', '分享')}${metric('inquiries', '可確認詢問')}${metric('conversions', '可確認轉換')}${metric('pending_replies', '待回覆')}</div>
        <p class="note">資料來源：${p.metrics_source || '尚未登錄'}・統計截至：${p.metrics_as_of || '—'}・最後更新：${p.metrics_updated_at ? p.metrics_updated_at.slice(0, 16).replace('T', ' ') : '—'}。互動為統計截至時間的累計數字。Graph API 自動取得尚未串接。</p>
      </section>
      ${d.siblings.length ? html`<section class="panel">
        <h2 class="sec">同一題材的其他發布位置 <span class="count">${d.siblings.length}</span></h2>
        <p class="sec-note">每個位置各自一筆紀錄與成效，發文數依實際筆數計算。</p>
        <div class="tbl"><table class="data"><thead><tr><th>位置</th><th>日期</th><th>狀態</th><th class="num">讚</th><th class="num">留言</th><th class="num">分享</th></tr></thead>
          <tbody>${d.siblings.map((x) => html`<tr><td><a href=${'#/post/' + x.id}>${d.subjects[x.outlet_type]}・${x.outlet_name}</a></td><td class="small">${x.published_date ? '發布 ' + md(x.published_date) : x.planned_date ? '預定 ' + md(x.planned_date) : '—'}</td>
            <td><${PostStatus} status=${x.status} /></td>${['likes', 'comments', 'shares'].map((k) => html`<td class="num">${x[k] ?? html`<span class="muted">—</span>`}</td>`)}</tr>`)}</tbody></table></div>
      </section>` : null}
      ${edit ? html`<${PostForm} meta=${d} post=${p} onClose=${() => setEdit(false)} onDone=${() => { setEdit(false); st.reload(); }} />` : null}
    </main>`;
  }}</${Loading}>`;
}

export function PostForm({ meta, post, preset = {}, onClose, onDone }) {
  const [status, setStatus] = useState(post?.status || '待製作');
  const now = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 16);
  return html`<${Modal} title=${post ? '編輯發文' : '新增發文'} onClose=${onClose} wide>
    <${Form} onCancel=${onClose} onSubmit=${async (f) => {
      if (f.status !== '已發布') { for (const k of ['likes', 'comments', 'shares', 'inquiries', 'conversions']) delete f[k]; delete f.metrics_as_of; }
      const r = post ? await api('PUT', '/posts/' + post.id, f) : await api('POST', '/posts', f);
      onDone(r.id);
    }}>
      <div class="grid2">
        <${Field} label="主題" name="title" value=${post?.title} required />
        <${Field} label="發布位置" name="outlet_id" value=${post?.outlet_id || preset.outlet_id} options=${meta.outlets.map((o) => [o.id, `${meta.subjects[o.type]}・${o.name}`])} />
        <${Field} label="共同題材" name="topic_id" value=${post?.topic_id || ''} options=${[['', '不串題材'], ...meta.topics.map((t) => [t.id, t.title])]} hint="同一題材發到不同位置時選同一個" />
        <${Field} label="或建立新題材" name="new_topic" placeholder="輸入新題材名稱" />
        <div class="field"><label for="f-status">狀態</label><select id="f-status" name="status" value=${status} onChange=${(e) => setStatus(e.target.value)}>${STATUSES.map((s) => html`<option value=${s}>${s}</option>`)}</select></div>
        <${Field} label="負責人" name="owner" value=${post?.owner} />
        <${Field} label="預定日期" name="planned_date" type="date" value=${post?.planned_date} />
        <${Field} label="實際發布日期" name="published_date" type="date" value=${post?.published_date} hint="狀態為已發布時必填" />
        <${Field} label="支援專案（選填）" name="project_id" value=${post?.project_id || preset.project_id || ''} options=${[['', '無（日常發文）'], ...meta.projects.map((p) => [p.id, `${p.code}｜${p.name}`])]} />
        <${Field} label="貼文連結" name="url" value=${post?.url} placeholder="https://..." />
        <${Field} label="發文目的" name="purpose" value=${post?.purpose} />
        <${Field} label="引流去向" name="destination" value=${post?.destination} />
        <${Field} label="內容" name="content" type="textarea" value=${post?.content} wide />
        <${Field} label="素材說明" name="asset" value=${post?.asset} wide />
      </div>
      ${status === '已發布' ? html`<fieldset class="metrics-def"><legend>成效（人工登錄；填寫時需附統計截至時間）</legend>
        <div class="grid3">
          <${Field} label="按讚" name="likes" type="number" min="0" value=${post?.likes} />
          <${Field} label="留言" name="comments" type="number" min="0" value=${post?.comments} />
          <${Field} label="分享" name="shares" type="number" min="0" value=${post?.shares} />
          <${Field} label="可確認詢問" name="inquiries" type="number" min="0" value=${post?.inquiries} hint="只填能確認來自這篇的詢問" />
          <${Field} label="可確認轉換" name="conversions" type="number" min="0" value=${post?.conversions} />
          <${Field} label="統計截至" name="metrics_as_of" type="datetime-local" value=${post?.metrics_as_of ? post.metrics_as_of.replace(' ', 'T') : now} />
        </div></fieldset>` : null}
      <${Field} label="待回覆的留言或詢問" name="pending_replies" type="number" min="0" value=${post?.pending_replies} hint="人工登錄；有數量時會列入首頁待辦" />
    </${Form}>
  </${Modal}>`;
}
