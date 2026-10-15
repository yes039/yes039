// 小型 SVG 圖表：單一數列柱狀圖與漏斗。不用雙 Y 軸；花費與成果分兩張圖。
import { useState } from 'preact/hooks';
import { html } from './ui.js';
import { fmt, md } from './format.js';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** data: [{ date, v (null = 沒有資料) }] */
export function DailyBars({ data, f = 'int', title, color = 'var(--series-1)', missingLabel = '無資料' }) {
  const [hover, setHover] = useState(null);
  const W = 640; const H = 180; const L = 48; const R = 8; const T = 12; const B = 26;
  const vals = data.map((d) => d.v ?? 0);
  const max = niceMax(Math.max(0, ...vals));
  const n = Math.max(1, data.length);
  const step = (W - L - R) / n;
  const bw = Math.max(2, Math.min(28, step - 2));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const every = Math.ceil(n / 8);
  return html`<figure class="chart">
    <figcaption>${title}</figcaption>
    <div class="chart-wrap">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${title} onMouseLeave=${() => setHover(null)}>
        ${[0, 0.5, 1].map((t) => html`<g>
          <line x1=${L} x2=${W - R} y1=${y(max * t)} y2=${y(max * t)} class="grid" />
          <text x=${L - 6} y=${y(max * t) + 4} class="tick" text-anchor="end">${fmt[f === 'money' ? 'int' : f](max * t)}</text>
        </g>`)}
        ${data.map((d, i) => {
          const x = L + i * step + (step - bw) / 2;
          if (d.v == null) {
            return html`<g><rect x=${x} y=${y(max) } width=${bw} height=${H - B - y(max)} class="missing" />
              <rect x=${L + i * step} y=${T} width=${step} height=${H - T - B} fill="transparent" onMouseEnter=${() => setHover(i)} /></g>`;
          }
          const top = y(d.v);
          const hgt = Math.max(0, H - B - top);
          const r = Math.min(4, bw / 2, hgt);
          const path = `M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - B} Z`;
          return html`<g>
            <path d=${path} fill=${color} opacity=${hover == null || hover === i ? 1 : 0.55} />
            <rect x=${L + i * step} y=${T} width=${step} height=${H - T - B} fill="transparent" onMouseEnter=${() => setHover(i)} />
          </g>`;
        })}
        <line x1=${L} x2=${W - R} y1=${H - B} y2=${H - B} class="axis" />
        ${data.map((d, i) => (i % every === 0 ? html`<text x=${L + i * step + step / 2} y=${H - 8} class="tick" text-anchor="middle">${md(d.date)}</text>` : null))}
      </svg>
      ${hover != null ? html`<div class="tip" style=${`left:${((L + hover * step + step / 2) / W) * 100}%`}>
        <b>${md(data[hover].date)}</b> ${data[hover].v == null ? missingLabel : fmt[f](data[hover].v)}
      </div>` : null}
    </div>
  </figure>`;
}

/** steps: [{ label, m }]；比例＝下一階段數量 ÷ 上一階段數量（不是同一批人） */
export function Funnel({ steps }) {
  const values = steps.map((s) => s.m?.v ?? null);
  const max = Math.max(1, ...values.filter((v) => v != null));
  return html`<div class="funnel" role="list">
    ${steps.map((s, i) => {
      const v = values[i];
      const prev = i > 0 ? values[i - 1] : null;
      const rate = v != null && prev ? v / prev : null;
      return html`<div class="f-row" role="listitem">
        <div class="f-label">${s.label}</div>
        <div class="f-bar">${v != null ? html`<div class="f-fill" style=${`width:${Math.max(0.5, (v / max) * 100)}%`}></div>` : null}</div>
        <div class="f-val">${v != null ? fmt.int(v) : html`<span class=${'state s-' + (s.m?.s || 'not_computed')}>${s.m?.s === 'not_connected' ? '尚未接入' : '暫不計算'}</span>`}${s.m?.s === 'incomplete' ? html`<span class="mark-inc" title=${s.m.r}>!</span>` : null}</div>
        <div class="f-rate">${rate != null ? '← ' + fmt.pct(rate) : ''}</div>
      </div>`;
    })}
    <p class="note">比例是「這一階段數量 ÷ 上一階段數量」，各階段是獨立事件的數量，不代表同一批人的轉換。</p>
  </div>`;
}

/** 表格內的橫條（同一欄比較用） */
export function InlineBar({ v, max }) {
  if (v == null || !max) return null;
  return html`<span class="ibar" aria-hidden="true"><span style=${`width:${Math.max(1, (v / max) * 100)}%`}></span></span>`;
}
