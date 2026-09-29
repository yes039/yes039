// ---------- cast ----------
const AMA = { id: 'a', skin: '#f0c4a2', skinD: '#d49473', hair: 'perm', hairC: '#dcd8d4', hairD: '#a29d98', top: '#a0607e', topD: '#7e4762', inner: '#f7efe4' };
const TEACH = { id: 't', skin: '#f7d5ba', skinD: '#e0aa8a', hair: 'pony', hairC: '#2f2420', hairD: '#1f1714', top: '#3f6f9f', topD: '#2c5277', inner: '#ffffff', glasses: false, age: 'young', earring: false, necklace: false };
const UNCLE = { id: 'u', skin: '#e4b28e', skinD: '#c48863', hair: 'bald', hairC: '#c7c2bc', top: '#6f9361', topD: '#56764a', cardigan: false, earring: false, necklace: false, browC: '#9b948d' };
const FRIEND = { id: 'f', skin: '#efc3a0', skinD: '#d39472', hair: 'short', hairC: '#5a463f', top: '#e08c52', topD: '#bf6f38', inner: '#fff3e0', glasses: false, necklace: false };
const KID = { id: 'k', skin: '#f8d3b4', skinD: '#e4a987', hair: 'kid', hairC: '#2a1f1b', top: '#4fa3e0', topD: '#3683bd', cardigan: false, age: 'kid', glasses: false, earring: false, necklace: false };

const DEFS = `<defs>
${personDefs('a', AMA.skin, AMA.skinD, AMA.hairC, AMA.hairD)}
${personDefs('t', TEACH.skin, TEACH.skinD, TEACH.hairC, TEACH.hairD)}
${personDefs('u', UNCLE.skin, UNCLE.skinD, UNCLE.hairC, '#8f8a85')}
${personDefs('f', FRIEND.skin, FRIEND.skinD, FRIEND.hairC, '#3b2e29')}
${personDefs('k', KID.skin, KID.skinD, KID.hairC, '#1a1311')}
<radialGradient id="pearl" cx=".35" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d9d2c8"/></radialGradient>
<radialGradient id="vig" cx=".5" cy=".48" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6dc" stop-opacity=".95"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>
<radialGradient id="warmglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffc86b" stop-opacity=".85"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></radialGradient>
<linearGradient id="aiG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b6cff"/><stop offset="1" stop-color="#35c6c0"/></linearGradient>
<linearGradient id="micG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fd1a1"/><stop offset="1" stop-color="#1fa77a"/></linearGradient>
<linearGradient id="ctaG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ff5f5f"/></linearGradient>
<filter id="b4" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="b8" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="b16" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity=".28"/></filter>
</defs>`;

function cam(content, s, cx, cy, t, shake = 1) {
  const sx = nz(t, 1) * 5 * shake, sy = nz(t, 7) * 5 * shake, r = nz(t, 3) * .25 * shake;
  return `<g transform="translate(${W / 2 + sx},${H / 2 + sy}) rotate(${r}) scale(${s}) translate(${-cx},${-cy})">${content}</g>`;
}
const P = (x, y, s, inner) => `<g transform="translate(${x},${y}) scale(${s})">${inner}</g>`;

// ---------- backgrounds ----------
function bgKitchen() {
  let g = `<rect x="-400" y="-400" width="1880" height="2720" fill="#c9d3d8"/>`;
  g += `<rect x="60" y="260" width="470" height="700" rx="10" fill="#eef6fb"/><rect x="60" y="260" width="470" height="700" rx="10" fill="url(#glow)"/>`;
  g += `<path d="M295,260 V960 M60,610 H530" stroke="#b9c4ca" stroke-width="16"/>`;
  g += `<path d="M30,230 Q120,600 70,1000 L20,1000Z" fill="#e7d6c4"/><path d="M560,230 Q470,600 520,1000 L570,1000Z" fill="#e7d6c4"/>`;
  g += `<rect x="40" y="960" width="520" height="30" fill="#b7aa9c"/>`;
  g += `<path d="M150,960 l-20,-90 h90 l-20,90z" fill="#c67b5c"/><circle cx="175" cy="840" r="46" fill="#6f9a62"/><circle cx="140" cy="800" r="34" fill="#81ad72"/><circle cx="210" cy="805" r="32" fill="#5f8a55"/>`;
  g += `<rect x="640" y="200" width="440" height="420" fill="#dfe3e2"/><path d="M640,410 H1080" stroke="#c4cac8" stroke-width="6"/><circle cx="700" cy="410" r="8" fill="#a8a8a8"/>`;
  g += `<rect x="620" y="900" width="460" height="24" fill="#b39b85"/>`;
  for (let i = 0; i < 4; i++) g += `<rect x="${660 + i * 100}" y="${820 - (i % 2) * 30}" width="70" height="${80 + (i % 2) * 30}" rx="12" fill="${['#e8c07a', '#b5d0c2', '#e59a82', '#f1e3c9'][i]}"/>`;
  g += `<circle cx="920" cy="760" r="0" fill="none"/>`;
  return `<g filter="url(#b8)">${g}</g>`;
}
function bgClass() {
  let g = `<rect x="-400" y="-400" width="1880" height="2720" fill="#f1e6d6"/>`;
  g += `<rect x="-40" y="190" width="780" height="560" rx="12" fill="#fdfdfb" stroke="#c9c2b6" stroke-width="16"/>`;
  g += txt(40, 330, 'AI 小幫手', 84, '#2d6cdf', { weight: 700 });
  g += `<g transform="translate(560,320)"><rect x="-70" y="-60" width="140" height="120" rx="36" fill="none" stroke="#e0593b" stroke-width="10"/><circle cx="-28" cy="-5" r="12" fill="#e0593b"/><circle cx="28" cy="-5" r="12" fill="#e0593b"/><path d="M-26,30 Q0,48 26,30" stroke="#e0593b" stroke-width="9" fill="none"/><path d="M0,-60 V-95" stroke="#e0593b" stroke-width="9"/><circle cx="0" cy="-102" r="12" fill="#e0593b"/></g>`;
  g += txt(40, 470, '① 按住說話', 58, '#333', { weight: 700 });
  g += txt(40, 560, '② 拍照問問題', 58, '#333', { weight: 700 });
  g += txt(40, 650, '③ 請它幫忙寫字', 58, '#333', { weight: 700 });
  g += `<rect x="800" y="150" width="320" height="720" fill="#dff0ff"/><rect x="800" y="150" width="320" height="720" fill="url(#glow)"/><path d="M960,150 V870 M800,510 H1120" stroke="#e2d7c6" stroke-width="16"/>`;
  g += `<rect x="-400" y="1020" width="1880" height="1300" fill="#e6d7c2"/>`;
  return `<g filter="url(#b8)">${g}</g>`;
}
function bgPark(t) {
  let g = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3f2"/><stop offset="1" stop-color="#fff0cf"/></linearGradient>`;
  g += `<rect x="-400" y="-400" width="1880" height="2720" fill="url(#sky)"/>`;
  g += `<circle cx="880" cy="330" r="360" fill="url(#glow)"/>`;
  const trees = [[80, 760, 210, '#6fa35c'], [330, 700, 170, '#86b86b'], [640, 740, 220, '#5d9150'], [960, 690, 190, '#7bb064']];
  for (const [x, y, r, c] of trees) g += `<rect x="${x - 18}" y="${y}" width="36" height="420" fill="#7a5a44"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * .4}" cy="${y - r * .3}" r="${r * .6}" fill="#fff" opacity=".12"/>`;
  g += `<rect x="-400" y="1080" width="1880" height="1300" fill="#9cc97a"/><path d="M380,1920 Q520,1300 560,1080 L640,1080 Q700,1300 900,1920Z" fill="#e9dcc2"/>`;
  g += `<rect x="740" y="1110" width="260" height="22" rx="6" fill="#8a6246"/><rect x="760" y="1132" width="12" height="60" fill="#6b4a34"/><rect x="968" y="1132" width="12" height="60" fill="#6b4a34"/>`;
  return `<g filter="url(#b16)">${g}</g>`;
}
function hibiscus(x, y, r, rot = 0) {
  let g = `<g transform="translate(${x},${y}) rotate(${rot})">`;
  for (let i = 0; i < 5; i++) g += `<ellipse cx="0" cy="${-r * .55}" rx="${r * .42}" ry="${r * .6}" fill="#e8364f" stroke="#c2213a" stroke-width="${r * .03}" transform="rotate(${i * 72})"/>`;
  g += `<circle r="${r * .22}" fill="#9e1030"/><path d="M0,0 L${r * .15},${-r * .75}" stroke="#ffd35c" stroke-width="${r * .06}"/><circle cx="${r * .15}" cy="${-r * .78}" r="${r * .08}" fill="#ffd35c"/>`;
  return g + `</g>`;
}
function leaves(x, y, s) {
  let g = '';
  for (let i = 0; i < 9; i++) { const a = i * 40; g += `<ellipse cx="${x + Math.cos(a) * 120 * s}" cy="${y + Math.sin(a * 1.3) * 90 * s}" rx="${70 * s}" ry="${30 * s}" fill="${i % 2 ? '#3f7d3a' : '#4f9446'}" transform="rotate(${a} ${x + Math.cos(a) * 120 * s} ${y + Math.sin(a * 1.3) * 90 * s})"/>`; }
  return g;
}
function bgLiving(warm = true) {
  let g = `<rect x="-400" y="-400" width="1880" height="2720" fill="${warm ? '#e9c79a' : '#d8cbb8'}"/>`;
  g += `<circle cx="900" cy="560" r="420" fill="url(#warmglow)"/>`;
  g += `<path d="M860,420 h120 l30,150 h-180z" fill="#fff1d2"/><rect x="915" y="570" width="12" height="600" fill="#6d5443"/>`;
  g += `<rect x="120" y="300" width="200" height="250" fill="#8a6a50"/><rect x="138" y="318" width="164" height="214" fill="#bcd6e0"/><circle cx="220" cy="410" r="44" fill="#f0c4a2"/><rect x="175" y="455" width="90" height="77" rx="30" fill="#4fa3e0"/>`;
  g += `<rect x="380" y="360" width="160" height="200" fill="#8a6a50"/><rect x="394" y="374" width="132" height="172" fill="#e9dcc9"/>`;
  g += `<rect x="-40" y="980" width="1160" height="360" rx="80" fill="#7a9a7d"/><rect x="-40" y="1260" width="1160" height="700" fill="#5f7f62"/>`;
  return `<g filter="url(#b8)">${g}</g>`;
}
function bokeh(t, cols, n = 14, seed = 1) {
  let g = '';
  for (let i = 0; i < n; i++) {
    const x = (Math.sin(i * 12.9898 + seed) * 43758.5453 % 1 + 1) % 1 * W;
    const y = (Math.sin(i * 78.233 + seed) * 12543.1 % 1 + 1) % 1 * H;
    const r = 40 + ((i * 37) % 70);
    g += `<circle cx="${x + Math.sin(t * .4 + i) * 20}" cy="${y + Math.cos(t * .3 + i) * 20}" r="${r}" fill="${cols[i % cols.length]}" opacity=".35"/>`;
  }
  return `<g filter="url(#b8)">${g}</g>`;
}

// ---------- phone screens ----------
function chatHeader(title, sub, avatar) {
  return `<rect width="390" height="120" fill="#fafafa"/>${statusBar()}<path d="M22,86 l-10,-12 l10,-12" stroke="#333" stroke-width="4" fill="none"/>${avatar}` +
    txt(104, 86, title, 25, '#111', { weight: 700 }) + (sub ? txt(104, 110, sub, 16, '#8a8f98') : '') + `<rect y="119" width="390" height="1.5" fill="#e3e3e3"/>`;
}
function screenGrandson(u) {
  let g = `<rect width="390" height="844" fill="#dfe7ef"/>`;
  g += chatHeader('小寶', '', `<circle cx="68" cy="78" r="26" fill="#bfe1ff"/>` + txt(68, 88, '👦', 30, '#000', { anchor: 'middle' }));
  g += bubble(20, 150, 290, ['阿嬤～下禮拜', '我生日喔 🎂'], false, 25, 1);
  g += bubble(20, 270, 290, ['妳可以用 AI', '幫我寫祝福啊！😆'], false, 25, eout(prog(u, .15, .45)));
  // keyboard + input
  g += `<rect y="520" width="390" height="324" fill="#d3d6dc"/>`;
  const rows = ['ㄅㄉˇˋㄓˊ˙ㄚㄞ', 'ㄆㄊㄍㄐㄔㄗㄧㄛ', 'ㄇㄋㄎㄑㄕㄘㄨㄜ', 'ㄈㄌㄏㄒㄖㄙㄩㄝ'];
  rows.forEach((r, ri) => [...r].forEach((c, ci) => { g += `<rect x="${6 + ci * 47.8}" y="${580 + ri * 56}" width="42" height="48" rx="7" fill="#fff"/>` + txt(27 + ci * 47.8, 614 + ri * 56, c, 20, '#222', { anchor: 'middle' }); }));
  g += `<rect x="6" y="804" width="378" height="36" rx="7" fill="#fff" opacity=".7"/>`;
  g += `<rect y="458" width="390" height="62" fill="#f7f7f7"/><rect x="14" y="468" width="300" height="44" rx="22" fill="#fff" stroke="#d9d9d9"/>`;
  const full = 'AI？那是什麼…我不會啦';
  let n = 0;
  if (u > .75) n = Math.floor(prog(u, .75, 1.55) * full.length);
  if (u > 1.75) n = Math.floor((1 - prog(u, 1.75, 2.15)) * full.length);
  const shown = full.slice(0, n);
  g += txt(32, 499, shown, 21, '#222');
  if (Math.floor(u * 3) % 2 === 0) g += `<rect x="${34 + shown.length * 21 * .92}" y="478" width="2.5" height="26" fill="#3478f6"/>`;
  g += `<circle cx="350" cy="490" r="22" fill="#c8c8c8"/><path d="M340,490 l18,0 m-7,-7 l7,7 l-7,7" stroke="#fff" stroke-width="3" fill="none"/>`;
  return g;
}
function aiHeader() {
  return chatHeader('AI 小幫手', '隨時陪您聊聊', `<circle cx="68" cy="78" r="26" fill="url(#aiG)"/>` + txt(68, 88, '✦', 26, '#fff', { anchor: 'middle', weight: 700 }));
}
function micBar(press, level, t) {
  let g = `<rect y="690" width="390" height="154" fill="#ffffff"/><rect y="690" width="390" height="1.5" fill="#e6e6e6"/>`;
  if (press > 0) for (let i = 0; i < 3; i++) { const ph = ((t * 1.4 + i / 3) % 1); g += `<circle cx="195" cy="765" r="${46 + ph * 60}" fill="none" stroke="#2fbf8a" stroke-width="4" opacity="${(1 - ph) * .6 * press}"/>`; }
  const r = 46 * (1 + .12 * press);
  g += `<circle cx="195" cy="765" r="${r}" fill="url(#micG)" filter="url(#shadow)"/>`;
  g += `<rect x="184" y="740" width="22" height="36" rx="11" fill="#fff"/><path d="M175,765 q0,22 20,22 q20,0 20,-22 M195,787 v10" stroke="#fff" stroke-width="4" fill="none"/>`;
  g += txt(195, 832, press > .5 ? '放開 送出' : '按住說話', 19, '#555', { anchor: 'middle', weight: 700 });
  return g;
}
function screenAIVoice(u, t) {
  let g = `<rect width="390" height="844" fill="#f4f6fb"/>` + aiHeader();
  g += bubble(18, 140, 300, ['您好！想問什麼，', '按住下面按鈕說說看 😊'], false, 23, 1);
  const pressed = u > .65 && u < 2.35 ? 1 : 0;
  const req = '幫我寫一段生日祝福給孫子';
  if (u > 2.35) g += bubble(118, 262, 254, ['幫我寫一段生日', '祝福給孫子'], true, 23, eout(prog(u, 2.35, 2.6)));
  if (u > 2.65 && u < 3.2) {
    g += `<rect x="18" y="376" width="96" height="52" rx="24" fill="#fff"/>`;
    for (let i = 0; i < 3; i++) g += `<circle cx="${44 + i * 22}" cy="${402 - Math.max(0, Math.sin(t * 12 - i)) * 6}" r="7" fill="#9aa0aa"/>`;
  }
  if (u > 3.2) {
    const lines = ['好的！可以這樣寫：', '「小寶，生日快樂 🎂', '阿嬤祝你健康長大、', '天天開心！', '阿嬤永遠愛你 ❤️」'];
    const total = lines.join('').length, k = Math.floor(prog(u, 3.2, 4.5) * total);
    let c = 0; const shown = lines.map(l => { const s = l.slice(0, Math.max(0, k - c)); c += l.length; return s; }).filter(s => s.length);
    const lh = 23 * 1.45, h = lines.length * lh + 26;
    g += `<rect x="18" y="376" width="300" height="${h}" rx="24" fill="#fff"/>`;
    shown.forEach((l, i) => g += txt(38, 376 + 13 + 23 + i * lh, l, 23, '#1b1c1f', { weight: 500 }));
  }
  g += micBar(pressed, 0, t);
  if (pressed) {
    const a = eout(prog(u, .65, .85));
    g += `<g opacity="${a}"><rect x="30" y="${470 + (1 - a) * 30}" width="330" height="200" rx="28" fill="#1f2a37" opacity=".92"/>`;
    for (let i = 0; i < 22; i++) { const hh = 8 + Math.abs(Math.sin(t * 9 + i * .9) * Math.sin(t * 3.3 + i * .4)) * 46; g += `<rect x="${62 + i * 12.5}" y="${528 - hh / 2}" width="7" height="${hh}" rx="3.5" fill="#4fd1a1"/>`; }
    const k = Math.floor(prog(u, .8, 2.1) * req.length);
    g += txt(195, 606, req.slice(0, Math.min(k, 7)), 26, '#fff', { anchor: 'middle', weight: 700 });
    g += txt(195, 644, req.slice(7, Math.max(7, k)), 26, '#fff', { anchor: 'middle', weight: 700 });
    g += `</g>`;
  }
  return g;
}
function flowerPhoto() {
  let g = `<rect width="354" height="300" rx="20" fill="#79a863"/>` + leaves(170, 170, 1.1) + hibiscus(180, 150, 110, 15) + hibiscus(320, 40, 70, -20) + hibiscus(30, 270, 60, 40);
  return g;
}
function screenAIPhoto(u) {
  let g = `<rect width="390" height="844" fill="#f4f6fb"/>` + aiHeader();
  g += `<g transform="translate(18,136)"><clipPath id="fp"><rect width="354" height="300" rx="20"/></clipPath><g clip-path="url(#fp)">${flowerPhoto()}</g></g>`;
  g += bubble(212, 452, 160, ['這是什麼花？'], true, 23, eout(prog(u, 0, .25)));
  if (u > .35 && u < .7) {
    g += `<rect x="18" y="530" width="96" height="52" rx="24" fill="#fff"/>`;
    for (let i = 0; i < 3; i++) g += `<circle cx="${44 + i * 22}" cy="556" r="7" fill="#9aa0aa"/>`;
  }
  if (u > .7) {
    const lines = ['這是「扶桑花」🌺', '喜歡陽光，', '幾乎一年四季都開花，', '好種又好照顧喔！'];
    const total = lines.join('').length, k = Math.floor(prog(u, .7, 1.7) * total);
    let c = 0; const shown = lines.map(l => { const s = l.slice(0, Math.max(0, k - c)); c += l.length; return s; }).filter(s => s.length);
    const lh = 23 * 1.45, h = lines.length * lh + 26;
    g += `<rect x="18" y="530" width="300" height="${h}" rx="24" fill="#fff"/>`;
    shown.forEach((l, i) => g += txt(38, 530 + 36 + i * lh, l, 23, '#1b1c1f', { weight: i === 0 ? 700 : 500 }));
  }
  g += micBar(0, 0, 0);
  g += `<circle cx="70" cy="765" r="30" fill="#eef1f6"/><rect x="54" y="752" width="32" height="24" rx="5" fill="none" stroke="#666" stroke-width="3"/><circle cx="70" cy="764" r="7" fill="none" stroke="#666" stroke-width="3"/>`;
  return g;
}
function screenCamera(u) {
  let g = `<rect width="390" height="844" fill="#000"/>`;
  g += `<g transform="translate(-20,150) scale(1.2)">${flowerPhoto()}</g>`;
  g += `<circle cx="195" cy="760" r="40" fill="#fff"/><circle cx="195" cy="760" r="33" fill="none" stroke="#000" stroke-width="3"/>`;
  return g;
}
function screenVideoCall(u, t) {
  let g = `<rect width="390" height="844" fill="#bfe3f7"/>`;
  g += `<rect y="500" width="390" height="344" fill="#f7e2b8"/>`;
  const laugh = .5 + .5 * Math.sin(t * 11);
  g += P(195, 470, 1.25, person(Object.assign({}, KID, { smile: 1, open: .45 + .35 * laugh, happy: u > .6 ? 1 : 0, tilt: Math.sin(t * 5) * 4, partyHat: true, blink: blink(t, 2) })));
  g += `<rect x="262" y="60" width="108" height="150" rx="16" fill="#e9c79a" stroke="#fff" stroke-width="3"/>`;
  g += `<g transform="translate(316,150) scale(.26)"><clipPath id="selfc"><rect x="-208" y="-346" width="416" height="577" rx="60"/></clipPath><g clip-path="url(#selfc)">${person(Object.assign({}, AMA, { smile: 1, happy: 1, open: .4 }))}</g></g>`;
  const a = eout(prog(u, .7, 1.0));
  g += `<g opacity="${a}" transform="translate(0,${(1 - a) * 20})"><rect x="40" y="560" width="310" height="70" rx="35" fill="#000" opacity=".55"/>` + txt(195, 606, '阿嬤好厲害！👍', 30, '#fff', { anchor: 'middle', weight: 700 }) + `</g>`;
  g += `<circle cx="120" cy="760" r="34" fill="#ffffff" opacity=".85"/><circle cx="270" cy="760" r="34" fill="#ff4d4f"/><path d="M252,764 q18,-14 36,0" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  g += `<rect x="109" y="742" width="22" height="30" rx="11" fill="#333"/>`;
  return g;
}

// ---------- scenes ----------
function S1a(u, t) { // kitchen, confused
  const buzz = u > .25 && u < .75 ? Math.sin(u * 120) * 4 : 0;
  const look = eio(prog(u, .5, .9));
  const expr = {
    tilt: lerp(0, 7, eio(prog(u, 1.0, 1.8))), lookX: .4, lookY: lerp(1, .6, look), brow: lerp(-.2, -.9, eio(prog(u, .6, 1.4))),
    smile: lerp(0, -.55, eio(prog(u, .7, 1.5))), blink: blink(t, 0)
  };
  let body = arm(-205, 250, -250, 520, -60, 470, AMA.top, AMA.topD) + arm(205, 250, 260, 520, 120, 440, AMA.top, AMA.topD);
  let lady = person(Object.assign({}, AMA, expr)) + body +
    phone(40 + buzz, 400, .38, -12, '', true) + hand(-40, 470, -20, AMA.skin, AMA.skinD, 1) + hand(120, 445, 25, AMA.skin, AMA.skinD, 1);
  let g = bgKitchen() + P(560, 880, 1.9, lady);
  // foreground teacup + steam
  let fg = `<g filter="url(#b4)"><rect x="-20" y="1640" width="1120" height="300" fill="#8d6e5a"/><path d="M60,1580 h170 l-18,120 h-134z" fill="#f4efe8"/><path d="M230,1605 q50,5 30,55 q-15,20 -40,10" stroke="#f4efe8" stroke-width="14" fill="none"/><ellipse cx="145" cy="1700" rx="130" ry="18" fill="#e9e2d8"/></g>`;
  for (let i = 0; i < 3; i++) { const ph = (t * .5 + i / 3) % 1; fg += `<path d="M${120 + i * 25},${1560 - ph * 200} q-20,-30 0,-60 q20,-30 0,-60" stroke="#fff" stroke-width="10" fill="none" opacity="${(1 - ph) * .35}" filter="url(#b4)"/>`; }
  g += fg;
  const s = lerp(1.0, 1.08, eio(u / 2.5));
  return cam(g, s, 560, 900, t) + `<rect width="${W}" height="${H}" fill="#6d8fb3" opacity=".16"/>`;
}
function S1b(u, t) {
  let g = `<rect x="-400" y="-400" width="1880" height="2720" fill="#9aa6ad"/>` + bokeh(t, ['#e6eef2', '#c9d4db', '#f5efe6'], 12, 3);
  const [gb, gf] = leftGrip(540, 800, 1.42, AMA.skin, AMA.skinD, AMA.top, AMA.topD);
  g += gb + phone(540, 800, 1.42, -2, screenGrandson(u), false, 'ph1') + gf;
  // thumb hovering / typing
  let tx = 700, ty = 1600;
  if (u > .7 && u < 1.6) { tx = 560 + Math.sin(u * 20) * 90; ty = 1500 + (Math.sin(u * 31) > 0 ? 0 : 30); }
  else if (u >= 1.6 && u < 2.2) { tx = 860; ty = 1270 + (Math.sin(u * 40) > 0 ? 0 : 15); }
  g += `<g opacity=".97">${arm(1200, 2000, 1000, 1900, tx + 80, ty + 180, AMA.top, AMA.topD, 150)}${hand(tx, ty, -35, AMA.skin, AMA.skinD, 1.5, 'thumb')}</g>`;
  return cam(g, lerp(1.0, 1.05, u / 2.3), 540, 960, t, .6) + `<rect width="${W}" height="${H}" fill="#6d8fb3" opacity=".12"/>`;
}
function S2(u, t) {
  const talk = Math.abs(Math.sin(t * 9)) * (u < 3.8 ? 1 : .2);
  const up = eio(prog(u, 1.6, 2.2));
  const nod = u > 2.6 ? Math.sin((u - 2.6) * 7) * 3 * (1 - prog(u, 3.6, 4.4)) : 0;
  let g = bgClass();
  // background uncle
  g += `<g filter="url(#b8)">${P(900, 880, .95, person(Object.assign({}, UNCLE, { smile: .6, lookY: 1, lookX: -.5, blink: blink(t, 3) })) + phone(-20, 380, .3, 10, '', true) + hand(-20, 420, 0, UNCLE.skin, UNCLE.skinD, 1))}</g>`;
  // teacher left, leaning in
  const teach = person(Object.assign({}, TEACH, { tilt: 8 + Math.sin(t * 2) * 2, smile: .8, open: talk * .5, lookX: 1, lookY: .8, blink: blink(t, 1.3) }));
  g += P(270, 900, 1.45, teach);
  // lady right
  const lady = person(Object.assign({}, AMA, {
    tilt: -3 + nod, lookX: lerp(-.2, -1, up), lookY: lerp(1, 0, up), brow: lerp(-.7, .1, eio(prog(u, 1.5, 3))),
    smile: lerp(-.2, .75, eio(prog(u, 1.8, 3.2))), blink: blink(t, .5), happy: u > 3.4 && u < 3.9 ? 1 : 0
  })) + arm(-205, 250, -250, 520, -120, 430, AMA.top, AMA.topD) + arm(205, 250, 260, 520, 60, 440, AMA.top, AMA.topD) +
    phone(-40, 380, .4, -8, '', true) + hand(-120, 440, -20, AMA.skin, AMA.skinD, 1) + hand(60, 450, 20, AMA.skin, AMA.skinD, 1);
  g += P(700, 1010, 1.45, lady);
  g += `<g filter="url(#b4)"><rect x="-20" y="1700" width="1120" height="260" fill="#b68b62"/><rect x="80" y="1660" width="300" height="70" rx="8" fill="#fbfaf5" transform="rotate(-6 230 1690)"/><rect x="720" y="1640" width="80" height="110" rx="10" fill="#e87b5c"/></g>`;
  return cam(g, lerp(1.02, 1.1, eio(u / 4.8)), lerp(520, 600, eio(u / 4.8)), 980, t);
}
function S3(u, t) {
  let g = `<rect x="-400" y="-400" width="1880" height="2720" fill="#d9b98f"/>` + bokeh(t, ['#ffe2a8', '#f7c98c', '#fff3dc'], 14, 7);
  const [gb, gf] = leftGrip(540, 800, 1.42, AMA.skin, AMA.skinD, AMA.top, AMA.topD);
  g += gb + phone(540, 800, 1.42, 0, screenAIVoice(u, t), false, 'ph3') + gf;
  // thumb to mic: mic in screen at (195,765) -> world
  const mx = 540 + (12 + 195 - 207) * 1.42, my = 800 + (20 + 765 - 442) * 1.42;
  const reach = eio(prog(u, .25, .65)), leave = eio(prog(u, 2.35, 2.8));
  const press = u > .65 && u < 2.35 ? 1 : 0;
  const tx = lerp(lerp(820, mx + 10, reach), 860, leave), ty = lerp(lerp(1780, my + 70 + press * 10, reach), 1800, leave);
  g += `${arm(1250, 2100, 1050, 1950, tx + 90, ty + 190, AMA.top, AMA.topD, 150)}${hand(tx, ty, -25, AMA.skin, AMA.skinD, 1.5 * (1 - press * .04), 'thumb')}`;
  const s = lerp(1.0, 1.1, eio(u / 4.8));
  return cam(g, s, 540, lerp(900, 800, eio(prog(u, 2.4, 4.6))), t, .5);
}
function S4a(u, t) {
  let g = bgPark(t);
  const lady = person(Object.assign({}, AMA, { tilt: -5, lookX: -1, lookY: .3, brow: .35, smile: .25, blink: blink(t, 1), top: '#6b8fb8', topD: '#4f6f95' })) +
    arm(-205, 250, -330, 420, -300, 150, '#6b8fb8', '#4f6f95') + arm(205, 250, 60, 470, -170, 190, '#6b8fb8', '#4f6f95') +
    phone(-250, 110, .4, -8, '', true) + hand(-310, 170, -30, AMA.skin, AMA.skinD, .9) + hand(-180, 190, 30, AMA.skin, AMA.skinD, .9);
  g += P(740, 960, 1.4, lady);
  // foreground hibiscus bush
  g += `<g filter="url(#b4)">${leaves(140, 1520, 2.6)}${hibiscus(160, 1450, 150, 10)}${hibiscus(360, 1650, 110, -30)}${hibiscus(40, 1760, 120, 50)}</g>`;
  let fl = u > .95 && u < 1.2 ? (1 - prog(u, .95, 1.2)) : 0;
  return cam(g, lerp(1.0, 1.06, u / 1.7), 560, 960, t) + `<rect width="${W}" height="${H}" fill="#fff" opacity="${fl * .85}"/><rect width="${W}" height="${H}" fill="#ffcf7a" opacity=".08"/>`;
}
function S4b(u, t) {
  let g = `<rect x="-400" y="-400" width="1880" height="2720" fill="#9cc97a"/>` + bokeh(t, ['#e8f5c8', '#ffe6a6', '#f2a0a8'], 14, 11);
  const [gb, gf] = leftGrip(540, 800, 1.42, AMA.skin, AMA.skinD, '#6b8fb8', '#4f6f95');
  g += gb + phone(540, 800, 1.42, 1, screenAIPhoto(u), false, 'ph4') + gf + `${arm(1250, 2100, 1050, 1950, 950, 1790, '#6b8fb8', '#4f6f95', 150)}${hand(870, 1620, -25, AMA.skin, AMA.skinD, 1.5, 'thumb')}`;
  return cam(g, lerp(1.0, 1.06, u / 2), 540, 900, t, .5);
}
function S4c(u, t) {
  let g = bgPark(t);
  const wow = u < .4;
  const lady = person(Object.assign({}, AMA, {
    top: '#6b8fb8', topD: '#4f6f95', tilt: wow ? -2 : lerp(-2, 6, eio(prog(u, .4, .8))), lookX: -.3,
    brow: wow ? 1 : lerp(1, .3, prog(u, .4, .7)), open: wow ? .55 : lerp(.55, .25, prog(u, .4, .6)), smile: wow ? .2 : 1, happy: u > .55 ? 1 : 0, blink: 0
  }));
  g += P(540, 1020, 2.5, lady);
  return cam(g, lerp(1.0, 1.1, eout(u / 1.1)), 540, 980, t) + `<rect width="${W}" height="${H}" fill="#ffcf7a" opacity=".1"/>`;
}
function S5(u, t) {
  let g = bgLiving();
  const laugh = .5 + .5 * Math.sin(t * 10);
  const lady = person(Object.assign({}, AMA, {
    tilt: -4 + Math.sin(t * 5) * 2.5, lookX: 1, lookY: .1, smile: 1, open: u > .5 ? .35 + .3 * laugh : .2, happy: u > .5 ? 1 : 0, blink: blink(t, 2)
  })) + arm(205, 250, 300, 500, 330, 170, AMA.top, AMA.topD) + arm(-205, 250, -250, 520, -60, 470, AMA.top, AMA.topD) + hand(-60, 470, -10, AMA.skin, AMA.skinD, 1);
  g += P(380, 1030 + Math.abs(Math.sin(t * 5)) * -6, 1.5, lady);
  g += phone(800, 960, .95, 7, screenVideoCall(u, t), false, 'ph5');
  g += hand(700, 1360, 15, AMA.skin, AMA.skinD, 1.5);
  // hearts
  for (let i = 0; i < 7; i++) {
    const st = .9 + i * .38; if (u < st) continue; const k = (u - st) / 2.2; if (k > 1) continue;
    const x = 800 + Math.sin(i * 2.3 + k * 5) * 120, y = 620 - k * 520, s = .7 + .5 * Math.sin(i);
    g += `<g transform="translate(${x},${y}) scale(${s * (0.6 + back(prog(k, 0, .2)) * .4)})" opacity="${1 - k}"><path d="M0,18 C-40,-10 -30,-45 0,-25 C30,-45 40,-10 0,18Z" fill="${i % 2 ? '#ff6b81' : '#ff9f43'}"/></g>`;
  }
  return cam(g, lerp(1.0, 1.1, eio(u / 4.8)), lerp(560, 600, u / 4.8), 980, t) + `<rect width="${W}" height="${H}" fill="#ffb347" opacity=".1"/>`;
}
function S6(u, t) {
  let g = bgClass() + `<rect width="${W}" height="${H}" fill="#fff" opacity=".12"/>`;
  const bob = k => Math.sin(t * 4 + k) * 4;
  g += P(800, 800 + bob(1), 1.05, person(Object.assign({}, TEACH, { smile: 1, happy: 1, open: .3, blink: 0, tilt: 4 })));
  g += P(200, 1000 + bob(2), 1.15, person(Object.assign({}, UNCLE, { smile: 1, happy: blink(t, 1) > .2 ? 0 : 0, lookX: .4, tilt: 6, blink: blink(t, 1) })) + arm(200, 250, 280, 400, 150, 170, UNCLE.top, UNCLE.topD) + hand(150, 150, 10, UNCLE.skin, UNCLE.skinD, 1, 'thumb'));
  g += P(890, 1010 + bob(3), 1.15, person(Object.assign({}, FRIEND, { smile: 1, open: .3, happy: 1, tilt: -6 })));
  const thumb = back(prog(u, .2, .6));
  g += P(540, 960 + bob(0), 1.35, person(Object.assign({}, AMA, { smile: 1, happy: 1, open: .35 + .15 * Math.sin(t * 8), tilt: 3 })) +
    arm(205, 250, 290, 470, 200, lerp(420, 230, thumb), AMA.top, AMA.topD) + hand(200, lerp(420, 220, thumb), 0, AMA.skin, AMA.skinD, 1.1, 'thumb') +
    arm(-205, 250, -250, 520, -80, 470, AMA.top, AMA.topD) + phone(-90, 420, .38, -6, '', true) + hand(-80, 470, -10, AMA.skin, AMA.skinD, 1));
  // sparkles
  for (let i = 0; i < 10; i++) { const x = 100 + ((i * 97) % 880), y = 300 + ((i * 173) % 600), p = (Math.sin(t * 3 + i * 1.7) + 1) / 2; g += `<path d="M${x},${y - 18 * p} L${x + 5},${y} L${x},${y + 18 * p} L${x - 5},${y}Z M${x - 18 * p},${y} L${x},${y + 5} L${x + 18 * p},${y} L${x},${y - 5}Z" fill="#fff4b8" opacity="${p}"/>`; }
  let out = cam(g, lerp(1.08, 1.0, eout(u / 2)), 540, 900, t, .6);
  // CTA card
  const a = eout(prog(u, .45, 1.1));
  const y0 = 1330 + (1 - a) * 700;
  let c = `<g transform="translate(0,${y0})" filter="url(#shadow)"><rect x="50" y="0" width="980" height="440" rx="48" fill="#fffaf2"/>`;
  c += txt(540, 150, '60+ 學 AI', 124, '#2b2b2b', { anchor: 'middle', weight: 700 });
  c += `<rect x="330" y="160" width="420" height="18" rx="9" fill="#ffb347" opacity=".6"/>`;
  c += txt(540, 250, '小班慢慢教・一步一步陪你學會', 48, '#555', { anchor: 'middle', weight: 700 });
  const pulse = 1 + .04 * Math.sin(t * 6) * prog(u, 1.2, 1.6);
  c += `<g transform="translate(540,345) scale(${pulse * back(prog(u, .9, 1.4))})"><rect x="-230" y="-52" width="460" height="104" rx="52" fill="url(#ctaG)"/>` + txt(0, 20, '立即報名 ▸', 56, '#fff', { anchor: 'middle', weight: 700 }) + `</g>`;
  c += `</g>`;
  return out + c;
}

// ---------- subtitles ----------
const SUBS = [];
function setSubs(list) { SUBS.length = 0; SUBS.push(...list); }
function subtitles(t) {
  let g = '';
  for (const s of SUBS) {
    if (t < s.a - .05 || t > s.b + .15) continue;
    const a = Math.min(prog(t, s.a - .05, s.a + .1), 1 - prog(t, s.b, s.b + .15));
    const lines = s.text.split('\n'), size = 64, lh = 86, y0 = 1640 - (lines.length - 1) * lh;
    lines.forEach((l, i) => g += txt(540, y0 + i * lh, l, size, '#ffffff', { anchor: 'middle', weight: 700, stroke: '#1d1d1d', sw: 14, extra: `opacity="${a}"` }));
  }
  return g;
}

// ---------- timeline ----------
const SHOTS = [
  [0, 2.5, S1a], [2.5, 4.8, S1b], [4.8, 9.6, S2], [9.6, 14.4, S3],
  [14.4, 16.1, S4a], [16.1, 18.1, S4b], [18.1, 19.2, S4c], [19.2, 24.0, S5], [24.0, 30.01, S6]
];
let grainURL = null;
function makeGrain() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const d = x.createImageData(512, 512);
  let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 160; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); grainURL = c.toDataURL();
}
function frame(t) {
  let body = '';
  for (let i = 0; i < SHOTS.length; i++) {
    const [a, b, f] = SHOTS[i];
    if (t >= a && t < b) body += f(t - a, t);
  }
  // dissolve from S1b into S2 (mood change) and S4c->S5
  const dz = [[4.8, .35, S1b, 2.5], [19.2, .3, S4c, 18.1]];
  for (const [at, dur, f, st] of dz) if (t >= at && t < at + dur) body += `<g opacity="${1 - (t - at) / dur}">${f(t - st, t)}</g>`;
  if (!grainURL) makeGrain();
  const gx = Math.floor((t * 997) % 400), gy = Math.floor((t * 613) % 400);
  const fadeIn = 1 - prog(t, 0, .35), fadeOut = prog(t, 29.5, 30);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${body}
  <rect width="${W}" height="${H}" fill="url(#vig)" opacity=".7"/>
  <g style="mix-blend-mode:overlay" opacity=".13"><image href="${grainURL}" x="${-gx}" y="${-gy}" width="1600" height="2400" preserveAspectRatio="none"/></g>
  ${subtitles(t)}
  <rect width="${W}" height="${H}" fill="#000" opacity="${Math.max(fadeIn, fadeOut)}"/></svg>`;
}
function render(t) { document.getElementById('root').innerHTML = frame(t); }
