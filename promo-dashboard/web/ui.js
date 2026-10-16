import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { STATE_LABEL, fmt } from './format.js';

export const html = htm.bind(h);

// ---------- API ----------
export async function api(method, path, body) {
  const init = { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined };
  const req = new Request(new URL('/api' + path, location.origin === 'null' ? 'http://preview.local' : location.origin), init);
  const res = window.__LOCAL_API__ ? await window.__LOCAL_API__(req) : await fetch(req);
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || `錯誤 ${res.status}`);
  return data;
}

export function useApi(path, deps) {
  const [state, set] = useState({ loading: true, data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true }));
    api('GET', path).then((data) => alive && set({ loading: false, data, error: null }), (e) => alive && set({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [path, tick, ...(deps || [])]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

// ---------- 數字與狀態 ----------
/** 顯示一個指標：有數值顯示數值；沒有就顯示狀態，不用 0 代替 */
// why：沒有數值時把原因一起寫出來（例如「暫不計算：廣告資料不完整」）
// incLabel：資料不完整時改用這個標籤（例如花費用「已知小計」），精簡模式也顯示
// prefix：數值前的字（例如預算使用率不完整時的「至少」）
export function V({ m, f = 'int', compact, showNA, why, incLabel, prefix }) {
  if (!m) return html`<span class="state">—</span>`;
  const label = STATE_LABEL[m.s] || '';
  if (compact && !showNA && !why && m.s === 'not_computed') return html`<span class="muted" title=${(label + '：' + (m.r || ''))}>—</span>`;
  if (m.v == null) return html`<span class="state s-${m.s}" title=${m.r || label}>${label}${why && m.r ? '：' + m.r : ''}</span>`;
  const text = fmt[f](m.v);
  if (m.s === 'incomplete' && incLabel) {
    return html`<span class="val" title=${m.r}>${prefix ? html`<span class="small">${prefix} </span>` : null}${text} <span class="state s-incomplete sm">${incLabel}</span></span>`;
  }
  if (m.s === 'incomplete') {
    return html`<span class="val">${text}${compact ? html`<span class="mark-inc" title=${m.r} aria-label=${'資料不完整：' + m.r}>!</span>` : html` <span class="state s-incomplete sm" title=${m.r}>資料不完整</span>`}</span>`;
  }
  if (m.s === 'zero') return compact ? html`<span class="val" title="已確認為零：資料完整，數值為零">${text}</span>` : html`<span class="val" title=${m.r}>${text} <span class="state s-zero sm">已確認為零</span></span>`;
  return html`<span class="val" title=${m.n != null ? `計算：${fmt.int(m.n)} ÷ ${fmt.int(m.d)}` : null}>${text}</span>`;
}

export function Kpi({ label, m, f, sub, children }) {
  return html`<div class="kpi">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${children || html`<${V} m=${m} f=${f} />`}</div>
    ${sub ? html`<div class="kpi-sub">${sub}</div>` : null}
    ${m && m.v == null && m.r ? html`<div class="kpi-why">${m.r}</div>` : m && m.s === 'incomplete' ? html`<div class="kpi-why">${m.r}</div>` : null}
  </div>`;
}

const JUDGE_CLASS = { 持續: 'good', 觀察: 'neutral', 調整: 'serious', 暫不判斷: 'hold', 已結束: 'ended', '—': 'muted' };
export function Judge({ j }) {
  if (!j) return null;
  return html`<span class=${'judge j-' + (JUDGE_CLASS[j.label] || 'muted')} title=${j.reason}>${j.label === '持續' ? '▲ ' : j.label === '調整' ? '▼ ' : j.label === '暫不判斷' ? '… ' : ''}${j.label === '暫不判斷' ? '待補資料／暫不判斷' : j.label}</span>`;
}

const LEVEL = { critical: ['嚴重', '■'], serious: ['注意', '▲'], warning: ['提醒', '●'], manual: ['待辦', '□'] };
export function AlertItem({ a, showProject }) {
  const [label, icon] = LEVEL[a.level] || LEVEL.warning;
  return html`<li class=${'alert lv-' + a.level}>
    <span class="alert-tag"><span aria-hidden="true">${icon}</span> ${label}</span>
    <div class="alert-body">
      <a href=${a.link || (a.project_id ? '#/p/' + a.project_id : '#/')}>${showProject ? html`<b class="proj-code">${a.project}</b> ` : null}${a.title}</a>
      ${a.detail ? html`<div class="alert-detail">${a.detail}</div>` : a.due ? html`<div class="alert-detail">期限 ${a.due}</div>` : null}
    </div>
  </li>`;
}

export function Badge({ kind, children }) {
  return html`<span class=${'badge b-' + kind}>${children}</span>`;
}

export function Empty({ title, children }) {
  return html`<div class="empty"><b>${title}</b>${children ? html`<div>${children}</div>` : null}</div>`;
}

// ---------- 對話框與表單 ----------
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return html`<div class="modal-back" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${title}>
      <div class="modal-head"><h2>${title}</h2><button class="icon-btn" onClick=${onClose} aria-label="關閉">✕</button></div>
      <div class="modal-body">${children}</div>
    </div>
  </div>`;
}

/** 表單：送出時收集欄位，呼叫 onSubmit；錯誤顯示在表單底部 */
export function Form({ onSubmit, submitLabel = '儲存', children, onCancel }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {};
    for (const [k, v] of fd.entries()) data[k] = v;
    for (const el of e.currentTarget.querySelectorAll('input[type=checkbox][name]')) data[el.name] = el.checked;
    setBusy(true); setErr('');
    try { await onSubmit(data, e.currentTarget); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return html`<form class="form" onSubmit=${submit} novalidate>
    ${children}
    ${err ? html`<p class="form-err" role="alert">${err}</p>` : null}
    <div class="form-actions">
      ${onCancel ? html`<button type="button" class="btn ghost" onClick=${onCancel}>取消</button>` : null}
      <button class="btn primary" disabled=${busy}>${busy ? '處理中…' : submitLabel}</button>
    </div>
  </form>`;
}

export function Field({ label, name, value, type = 'text', hint, required, options, placeholder, wide, ...rest }) {
  const id = 'f-' + name;
  let input;
  if (options) {
    input = html`<select id=${id} name=${name} ...${rest}>${options.map((o) => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      // 沒有預設值時不設定 selected，避免背景重新載入把使用者已選的項目改回第一個
      return html`<option value=${v} selected=${value == null ? undefined : String(value) === String(v)}>${l}</option>`;
    })}</select>`;
  } else if (type === 'textarea') {
    input = html`<textarea id=${id} name=${name} rows="3" placeholder=${placeholder} defaultValue=${value ?? ''} ...${rest}></textarea>`;
  } else {
    // 用 defaultValue：背景重新載入時不會清掉使用者正在輸入的內容
    input = html`<input id=${id} name=${name} type=${type} defaultValue=${value ?? ''} placeholder=${placeholder} ...${rest} />`;
  }
  return html`<div class=${'field' + (wide ? ' wide' : '')}>
    <label for=${id}>${label}${required ? html`<span class="req" aria-hidden="true"> *</span>` : null}</label>
    ${input}
    ${hint ? html`<div class="hint">${hint}</div>` : null}
  </div>`;
}

export function Tabs({ tabs, active, base }) {
  return html`<nav class="tabs" aria-label="分頁">${tabs.map(([k, l]) => html`<a href=${base + '/' + k} class=${k === active ? 'on' : ''} aria-current=${k === active ? 'page' : null}>${l}</a>`)}</nav>`;
}

export function Copy({ text }) {
  const [done, setDone] = useState('');
  const ref = useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone('已複製'); }
    catch {
      const r = document.createRange();
      r.selectNodeContents(ref.current);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      setDone('已選取，請按複製');
    }
    setTimeout(() => setDone(''), 2000);
  };
  return html`<span class="copy"><code ref=${ref}>${text}</code><button type="button" class="btn tiny" onClick=${copy}>${done || '複製'}</button></span>`;
}

export function Loading({ state, children }) {
  if (state.error) return html`<div class="page"><div class="error-box" role="alert">${state.error}</div></div>`;
  if (!state.data) return html`<div class="page"><div class="loading">載入中…</div></div>`;
  return children(state.data);
}
