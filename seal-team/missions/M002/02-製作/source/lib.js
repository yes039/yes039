// ---------- helpers ----------
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eio = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eout = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// smooth pseudo-noise for handheld camera
const nz = (t, s) => Math.sin(t * 1.3 + s) * .6 + Math.sin(t * 2.7 + s * 3.1) * .3 + Math.sin(t * 4.9 + s * 1.7) * .1;
function blink(t, seed = 0) {
  const per = 2.9 + seed * .7, ph = ((t + seed * 1.37) % per) / per * per;
  if (ph < .07) return ph / .07;
  if (ph < .16) return 1 - (ph - .07) / .09;
  return 0;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function txt(x, y, s, size, fill, opt = {}) {
  const w = opt.weight || 400, anc = opt.anchor || 'start';
  const st = opt.stroke ? `stroke="${opt.stroke}" stroke-width="${opt.sw || 8}" paint-order="stroke" stroke-linejoin="round"` : '';
  return `<text x="${x}" y="${y}" font-family="Noto Sans CJK TC, Noto Color Emoji" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anc}" ${st} ${opt.extra || ''}>${esc(s)}</text>`;
}

// ---------- people ----------
// Generic person, head centre at (0,0); body extends down to ~y=560.
function person(o) {
  const d = Object.assign({
    tilt: 0, lookX: 0, lookY: 0, brow: 0, smile: 0, open: 0, happy: 0, blink: 0,
    skin: '#f0c4a2', skinD: '#d99a78', hair: 'perm', hairC: '#cfcbc7', hairD: '#9e9994',
    top: '#9b5f7a', topD: '#7c4861', inner: '#f6efe6', glasses: true, age: 'old', earring: true,
    necklace: true, headScale: 1, id: 'p'
  }, o);
  const s = d.smile, br = d.brow, old = d.age === 'old', kid = d.age === 'kid';
  let g = '';
  // ---- body ----
  if (d.hair === 'perm' || d.hair === 'pony')
    g += `<path d="M-128,-20 C-150,-140 -80,-195 0,-195 C80,-195 150,-140 128,-20 C135,40 118,82 95,96 L-95,96 C-118,82 -135,40 -128,-20Z" fill="${d.hairD}"/>`;
  g += `<path d="M-40,70 L-44,178 L44,178 L40,70Z" fill="${d.skinD}"/>`;
  g += `<path d="M-255,600 C-258,340 -225,212 -118,180 L-40,162 L0,200 L40,162 L118,180 C225,212 258,340 255,600Z" fill="${d.top}"/>`;
  g += `<path d="M-150,200 C-180,260 -190,380 -185,600" stroke="${d.topD}" stroke-width="6" fill="none" opacity=".45"/>`;
  g += `<path d="M150,200 C180,260 190,380 185,600" stroke="${d.topD}" stroke-width="6" fill="none" opacity=".45"/>`;
  if (d.cardigan !== false) {
    g += `<path d="M-50,166 L0,${kid ? 250 : 330} L50,166 L40,162 L0,196 L-40,162Z" fill="${d.inner}"/>`;
    g += `<path d="M-50,166 L0,${kid ? 250 : 330} L50,166" stroke="${d.topD}" stroke-width="12" fill="none" stroke-linejoin="round"/>`;
    if (!kid) for (let i = 0; i < 3; i++) g += `<circle cx="0" cy="${365 + i * 55}" r="9" fill="${d.topD}"/><circle cx="-2" cy="${363 + i * 55}" r="4" fill="#ffffff" opacity=".35"/>`;
    if (d.necklace) for (let i = -6; i <= 6; i++) { const a = i / 6; g += `<circle cx="${a * 40}" cy="${178 + (1 - a * a) * 48}" r="6" fill="url(#pearl)"/>`; }
  } else {
    g += `<path d="M-46,164 Q0,215 46,164" stroke="${d.topD}" stroke-width="10" fill="none"/>`;
  }
  // ---- head ----
  const hs = d.headScale;
  g += `<g transform="rotate(${d.tilt} 0 90) scale(${hs})">`;
  g += `<ellipse cx="-103" cy="12" rx="17" ry="27" fill="${d.skinD}"/><ellipse cx="103" cy="12" rx="17" ry="27" fill="${d.skinD}"/>`;
  if (d.earring) g += `<circle cx="-105" cy="44" r="7" fill="url(#pearl)"/><circle cx="105" cy="44" r="7" fill="url(#pearl)"/>`;
  const jaw = kid ? 108 : 124;
  g += `<path d="M-104,-20 C-104,-112 -60,-142 0,-142 C60,-142 104,-112 104,-20 C104,58 ${kid ? 80 : 70},${jaw - 4} 0,${jaw} C-${kid ? 80 : 70},${jaw - 4} -104,58 -104,-20Z" fill="url(#skin_${d.id})"/>`;
  // cheeks
  g += `<ellipse cx="-58" cy="42" rx="26" ry="15" fill="#e87d74" opacity="${(kid ? .35 : .16) + .22 * Math.max(s, 0)}"/>`;
  g += `<ellipse cx="58" cy="42" rx="26" ry="15" fill="#e87d74" opacity="${(kid ? .35 : .16) + .22 * Math.max(s, 0)}"/>`;
  if (old) {
    const nl = .35 + .35 * Math.max(s, 0);
    g += `<path d="M-30,28 Q-46,55 -36,${76 - s * 6}" stroke="#b97c5f" stroke-width="3" fill="none" opacity="${nl}" stroke-linecap="round"/>`;
    g += `<path d="M30,28 Q46,55 36,${76 - s * 6}" stroke="#b97c5f" stroke-width="3" fill="none" opacity="${nl}" stroke-linecap="round"/>`;
    const fl = .18 + .4 * Math.abs(br);
    g += `<path d="M-38,-86 Q0,-${92 + br * 4} 38,-86" stroke="#c48c6d" stroke-width="2.5" fill="none" opacity="${fl}"/>`;
    g += `<path d="M-30,-74 Q0,-${79 + br * 4} 30,-74" stroke="#c48c6d" stroke-width="2.5" fill="none" opacity="${fl}"/>`;
  }
  // eyes
  for (const side of [-1, 1]) {
    const cx = side * 40, cy = -4;
    const hp = clamp(d.happy);
    if (hp > .5) {
      g += `<path d="M${cx - 17},${cy + 4} Q${cx},${cy - 13} ${cx + 17},${cy + 4}" stroke="#3a2a22" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    } else {
      const ry = Math.max(.6, (kid ? 13 : 10.5) * (1 - d.blink) * (1 - hp * .5) * (1 + Math.max(br, 0) * .25));
      const rx = kid ? 15 : 16.5;
      g += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fbf7f2"/>`;
      if (ry > 2) {
        const ir = kid ? 10 : 8;
        g += `<ellipse cx="${cx + d.lookX * 5}" cy="${cy + d.lookY * 3}" rx="${ir}" ry="${Math.min(ir, ry)}" fill="#3b271c"/>`;
        g += `<circle cx="${cx + d.lookX * 5 + 3}" cy="${cy + d.lookY * 3 - 3}" r="${kid ? 3.6 : 2.8}" fill="#fff"/>`;
      }
      g += `<path d="M${cx - rx - 1},${cy + 1} Q${cx},${cy - ry * 2 - 3} ${cx + rx + 1},${cy + 1}" stroke="#3f2b20" stroke-width="${kid ? 4 : 3.8}" fill="none" stroke-linecap="round"/>`;
    }
    if (old) {
      g += `<path d="M${cx - 13},${cy + 15} Q${cx},${cy + 21} ${cx + 13},${cy + 15}" stroke="#c08466" stroke-width="2.4" fill="none" opacity=".55"/>`;
      g += `<path d="M${side * 64},${cy - 4} l${side * 10},-5 M${side * 65},${cy + 3} l${side * 11},1 M${side * 64},${cy + 9} l${side * 9},6" stroke="#c08466" stroke-width="2" opacity="${.4 + .3 * Math.max(s, 0)}"/>`;
    }
    // brows
    const inY = -40 - (br < 0 ? -br * 13 : br * 12), outY = -38 - (br < 0 ? br * 5 : br * 12);
    const bc = d.browC || (old ? '#8f8882' : '#3a2a22');
    g += `<path d="M${side * 15},${inY} Q${side * 38},${Math.min(inY, outY) - 8} ${side * 62},${outY}" stroke="${bc}" stroke-width="${kid ? 6 : 7}" fill="none" stroke-linecap="round"/>`;
  }
  // nose
  g += `<path d="M-2,4 Q-8,34 -14,42 Q-4,50 8,43" stroke="${d.skinD}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  g += `<ellipse cx="0" cy="36" rx="12" ry="8" fill="#fff" opacity=".12"/>`;
  // mouth
  const my = kid ? 66 : 72, cyM = my - s * 10;
  if (d.open > .05) {
    const oh = 6 + d.open * 34 + Math.max(s, 0) * 4;
    g += `<path d="M-28,${cyM} Q0,${my - 6 + s * 2} 28,${cyM} Q0,${my + oh} -28,${cyM}Z" fill="#7a2e33"/>`;
    g += `<path d="M-22,${cyM + 1} Q0,${my - 3 + s * 2} 22,${cyM + 1} Q0,${my + 7} -22,${cyM + 1}Z" fill="#fff"/>`;
    g += `<ellipse cx="0" cy="${my + oh * .7}" rx="14" ry="${oh * .18}" fill="#d56a6a"/>`;
    g += `<path d="M-28,${cyM} Q0,${my + oh} 28,${cyM}" stroke="#b9575a" stroke-width="3.5" fill="none"/>`;
  } else {
    g += `<path d="M-26,${cyM} Q0,${my + s * 16} 26,${cyM}" stroke="#b5575a" stroke-width="5.5" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M-12,${my + 12 + s * 5} Q0,${my + 16 + s * 5} 12,${my + 12 + s * 5}" stroke="#c98a6c" stroke-width="2.5" fill="none" opacity=".5"/>`;
  }
  // hair front
  if (d.hair === 'perm') {
    const curls = [[-112, -10, 26], [-114, -48, 30], [-100, -88, 32], [-72, -120, 34], [-35, -140, 34], [5, -146, 34], [45, -138, 34], [80, -116, 33], [104, -82, 31], [114, -44, 29], [112, -8, 25],
      [-60, -118, 30], [-20, -124, 30], [22, -122, 30], [60, -110, 28]];
    for (const [x, y, r] of curls) g += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#hair_${d.id})" stroke="${d.hairD}" stroke-width="2.5"/>`;
    g += `<path d="M-90,-92 Q-40,-72 10,-98 Q50,-70 92,-92" stroke="${d.hairD}" stroke-width="3" fill="none" opacity=".6"/>`;
  } else if (d.hair === 'pony') {
    g += `<path d="M-112,10 C-122,-120 -50,-160 5,-158 C80,-156 124,-110 112,10 C104,-40 80,-80 30,-98 C-10,-70 -70,-60 -112,10Z" fill="${d.hairC}"/>`;
    g += `<path d="M20,-150 Q80,-140 95,-100" stroke="#fff" stroke-width="5" opacity=".15" fill="none"/>`;
  } else if (d.hair === 'short') {
    g += `<path d="M-108,-6 C-116,-120 -50,-158 5,-156 C70,-154 118,-116 108,-6 C100,-58 92,-80 70,-92 C20,-80 -40,-84 -80,-94 C-98,-70 -102,-40 -108,-6Z" fill="${d.hairC}"/>`;
  } else if (d.hair === 'kid') {
    g += `<path d="M-110,0 C-120,-130 -40,-162 10,-156 C80,-150 122,-110 110,0 C100,-50 70,-74 40,-84 L30,-60 L10,-86 L-10,-62 L-30,-88 C-70,-84 -100,-60 -110,0Z" fill="${d.hairC}"/>`;
  } else if (d.hair === 'bald') {
    g += `<path d="M-108,10 C-116,-40 -110,-60 -98,-70 C-96,-30 -100,-5 -108,10Z M108,10 C116,-40 110,-60 98,-70 C96,-30 100,-5 108,10Z" fill="${d.hairC}"/>`;
    g += `<ellipse cx="-30" cy="-112" rx="36" ry="14" fill="#fff" opacity=".22"/>`;
  }
  if (d.cap) {
    g += `<path d="M-112,-60 C-110,-170 110,-170 112,-60Z" fill="${d.cap}"/><path d="M-20,-66 C40,-80 120,-70 150,-52 C110,-44 40,-50 -20,-56Z" fill="${d.cap}" opacity=".9"/>`;
  }
  if (d.partyHat) {
    g += `<g transform="rotate(12 0 -150)"><path d="M-55,-128 L10,-300 L65,-128Z" fill="#ff7a59"/><path d="M-40,-165 L50,-165 M-25,-205 L38,-205 M-8,-245 L24,-245" stroke="#ffd65c" stroke-width="12"/><circle cx="10" cy="-302" r="16" fill="#ffd65c"/></g>`;
  }
  if (d.glasses) {
    for (const side of [-1, 1]) g += `<rect x="${side * 40 - 31}" y="-27" width="62" height="45" rx="17" stroke="#a9824c" stroke-width="3.6" fill="#dff1ff" fill-opacity=".10"/>`;
    g += `<path d="M-9,-10 Q0,-17 9,-10" stroke="#a9824c" stroke-width="3.6" fill="none"/>`;
    g += `<path d="M-71,-12 L-100,-6 M71,-12 L100,-6" stroke="#a9824c" stroke-width="3.2"/>`;
    g += `<path d="M-60,-22 l14,-2 M20,-22 l14,-2" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>`;
  }
  g += `</g>`;
  return g;
}
function personDefs(id, skin, skinD, hairC, hairD) {
  return `<radialGradient id="skin_${id}" cx=".45" cy=".38" r=".7"><stop offset="0" stop-color="${skin}"/><stop offset=".75" stop-color="${skin}"/><stop offset="1" stop-color="${skinD}"/></radialGradient>
  <radialGradient id="hair_${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".25" stop-color="${hairC}"/><stop offset="1" stop-color="${hairD}"/></radialGradient>`;
}
// arm: shoulder -> elbow -> hand, sleeve colour, returns path; hand drawn at end
function arm(sx, sy, ex, ey, hx, hy, col, colD, w = 86) {
  return `<path d="M${sx},${sy} Q${ex},${ey} ${hx},${hy}" stroke="${colD}" stroke-width="${w + 6}" fill="none" stroke-linecap="round"/>
  <path d="M${sx},${sy} Q${ex},${ey} ${hx},${hy}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
}
function hand(x, y, rot, skin, skinD, sc = 1, pose = 'grip') {
  let g = `<g transform="translate(${x},${y}) rotate(${rot}) scale(${sc})">`;
  if (pose === 'thumb') {
    g += `<rect x="-38" y="-30" width="76" height="70" rx="30" fill="${skin}" stroke="${skinD}" stroke-width="3"/>`;
    g += `<rect x="-16" y="-92" width="30" height="72" rx="15" fill="${skin}" stroke="${skinD}" stroke-width="3"/>`;
    for (let i = 0; i < 3; i++) g += `<path d="M34,${-14 + i * 18} h-26" stroke="${skinD}" stroke-width="3" stroke-linecap="round"/>`;
  } else {
    g += `<rect x="-40" y="-46" width="82" height="96" rx="34" fill="${skin}" stroke="${skinD}" stroke-width="3"/>`;
    for (let i = 0; i < 3; i++) g += `<path d="M-6,${-20 + i * 23} h40" stroke="${skinD}" stroke-width="3" stroke-linecap="round"/>`;
    g += `<rect x="-58" y="-78" width="30" height="64" rx="15" fill="${skin}" stroke="${skinD}" stroke-width="3" transform="rotate(-28 -43 -14)"/>`;
  }
  return g + `</g>`;
}

// ---------- phone ----------
// phone of screen size 390x844 at (x,y) centre with scale; content = svg string in screen coords.
let phoneN = 0;
function phone(x, y, sc, rot, content, back = false, id = 'ph') {
  let g = `<g transform="translate(${x},${y}) rotate(${rot}) scale(${sc}) translate(-207,-442)">`;
  g += `<rect x="0" y="0" width="414" height="884" rx="62" fill="#1d1f24"/>`;
  g += `<rect x="3" y="3" width="408" height="878" rx="60" fill="none" stroke="#6b7078" stroke-width="3"/>`;
  if (back) {
    g += `<rect x="12" y="12" width="390" height="860" rx="52" fill="#e9d8c8"/>`;
    g += `<rect x="36" y="36" width="130" height="130" rx="34" fill="#d6c3b1"/><circle cx="72" cy="72" r="24" fill="#222"/><circle cx="72" cy="130" r="24" fill="#222"/><circle cx="130" cy="100" r="10" fill="#fff6d0"/>`;
  } else {
    g += `<clipPath id="${id}"><rect x="0" y="0" width="390" height="844" rx="50"/></clipPath>`;
    g += `<g clip-path="url(#${id})" transform="translate(12,20)"><rect width="390" height="844" fill="#fff"/>${content}</g>`;
    g += `<rect x="150" y="34" width="114" height="32" rx="16" fill="#0b0b0d"/>`;
    g += `<path d="M40,60 L150,20" stroke="#fff" stroke-width="30" opacity=".03"/>`;
  }
  return g + `</g>`;
}
function statusBar(dark = false) {
  const c = dark ? '#fff' : '#111';
  return txt(36, 36, '9:41', 17, c, { weight: 700 }) + `<rect x="318" y="22" width="36" height="16" rx="4" stroke="${c}" stroke-width="2" fill="none"/><rect x="321" y="25" width="26" height="10" rx="2" fill="${c}"/>`;
}
function bubble(x, y, w, lines, me, size = 25, appear = 1) {
  const lh = size * 1.45, h = lines.length * lh + 26;
  const sc = back(appear);
  const ox = me ? x + w : x;
  let g = `<g transform="translate(${ox},${y}) scale(${sc}) translate(${-ox},${-y})" opacity="${clamp(appear * 2)}">`;
  g += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${me ? '#9be38a' : '#f0f1f4'}"/>`;
  lines.forEach((l, i) => g += txt(x + 20, y + 13 + size + i * lh, l, size, '#1b1c1f', { weight: 500 }));
  return g + `</g>`;
}

// POV left hand holding a phone (phone centre px,py, scale sc): palm behind, thumb over left edge
function leftGrip(px, py, sc, skin, skinD, sleeve, sleeveD) {
  const lx = px - 207 * sc, by = py + 300 * sc;
  const behind = `<path d="M${lx - 260},2300 Q${lx - 150},${by + 380} ${lx + 10},${by + 60}" stroke="${sleeveD}" stroke-width="176" fill="none" stroke-linecap="round"/><path d="M${lx - 260},2300 Q${lx - 150},${by + 380} ${lx + 10},${by + 60}" stroke="${sleeve}" stroke-width="170" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="${lx + 40}" cy="${by}" rx="95" ry="130" fill="${skin}" stroke="${skinD}" stroke-width="4"/>` +
    [0, 1, 2].map(i => `<rect x="${lx + 330 * sc * 1.25 - 10}" y="${by - 190 + i * 62}" width="46" height="56" rx="23" fill="${skin}" stroke="${skinD}" stroke-width="3"/>`).join('');
  const front = `<path d="M${lx - 30},${by + 40} Q${lx - 10},${by - 90} ${lx + 55},${by - 170}" stroke="${skinD}" stroke-width="62" fill="none" stroke-linecap="round"/><path d="M${lx - 30},${by + 40} Q${lx - 10},${by - 90} ${lx + 55},${by - 170}" stroke="${skin}" stroke-width="56" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="${lx + 52}" cy="${by - 168}" rx="17" ry="13" fill="#f6dccb" transform="rotate(-50 ${lx + 52} ${by - 168})"/>`;
  return [behind, front];
}
