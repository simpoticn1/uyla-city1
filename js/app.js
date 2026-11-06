// UYLA CITY — найди свой дом. Тот же мир и тот же код, что в рилсах.
import { E, clamp, lerp, ease } from './core.js';
import { mix, PROPS, prop, setOCC, lotGround, mosque, setHaze, VOTE as _V, cam, setCam, proj, ground, sky, horizon, terrain, scatter, props, house, plots, ENV, drawLights, setLOD, addLight, extras, lake, DACHAS, LAKE, plaza, VOTE } from './world.js';
import { CITY } from './citydata.js';

const HOUSES = CITY.houses; const BY = new Map(HOUSES.map((h) => [h.nickname.toLowerCase(), h]));
// свободные участки v3: рамки для «тебя пока нет»
CITY.free.forEach((f, i) => plots.push({ x: f.x, z: f.z, street: f.street, i, j: f.street, taken: false }));
const GHOST = plots[0] || null;
{ const LVQ = +new URLSearchParams(location.search).get('lv'); if (LVQ) HOUSES.forEach((h, i) => (h.lvl = LVQ === 9 ? 1 + (i % 3) : LVQ)); }   // ?lv=1..3 (9 — вперемешку) для съёмки
// ---- время суток и погода «как в жизни»: часы телефона + реальная погода в Бишкеке (Open-Meteo) ----
const KF = {   // sky[5], haze, hazeFar, tint, lit, lamps, stars, sunY, clouds[3], mountains[4]
  night: [['#0b0e28', '#1a1e48', '#2e2c5c', '#4a3a66', '#5a4468'], '#4a4a78', '#3e3e6a', [122, 130, 196], 1, 1, 1, -1, ['rgba(40,40,80,0.6)', 'rgba(30,30,60,0.6)', 'rgba(120,120,170,0.25)'], ['#3a3a62', '#2e2e52', '#24243e', '#1c1a2e']],
  dawn: [['#2e3366', '#6a5a8e', '#e0948a', '#f6c09a', '#fde0c0'], '#c89aa0', '#a088a8', [205, 185, 210], 0.6, 0.6, 0.2, 0.02, ['rgba(150,90,120,0.5)', 'rgba(90,70,120,0.55)', 'rgba(255,190,160,0.6)'], ['#8a6a9a', '#6d5584', '#4f3f62', '#3a3048']],
  morning: [['#5f95d0', '#86b2de', '#bcd2e6', '#f2ddc4', '#fbeedc'], '#c8d0dc', '#b0bcd0', [245, 242, 245], 0.1, 0, 0, 0.35, ['rgba(255,255,255,0.75)', 'rgba(235,240,250,0.7)', 'rgba(255,255,255,0.8)'], ['#8c9cc0', '#7488aa', '#5a7080', '#3e5a48']],
  noon: [['#3f80cc', '#62a0dc', '#96c2e8', '#cde2f0', '#e6f0f4'], '#c4d4e2', '#b4c6da', [255, 255, 255], 0, 0, 0, 0.9, ['rgba(255,255,255,0.8)', 'rgba(240,245,252,0.75)', 'rgba(255,255,255,0.85)'], ['#90a4c4', '#7890b0', '#5c7684', '#40604a']],
  after: [['#5488c8', '#7ea6d6', '#bcc6dc', '#f0d6b4', '#f8e2c4'], '#d4c8c8', '#bcb4c8', [250, 238, 232], 0.1, 0, 0, 0.35, ['rgba(255,245,240,0.75)', 'rgba(230,225,240,0.7)', 'rgba(255,240,225,0.8)'], ['#94a0c0', '#7c88aa', '#607080', '#44584a']],
  sunset: [['#3a3166', '#7a5288', '#ec9468', '#f8c888', '#fde4b4'], '#d79a86', '#b98aa0', [228, 170, 185], 0.7, 0.5, 0, 0.02, ['rgba(160,80,110,0.55)', 'rgba(80,60,110,0.6)', 'rgba(255,190,150,0.55)'], ['#8a6a9a', '#6d5584', '#4f3f62', '#3a3048']],
  dusk: [['#141a3e', '#30306a', '#8a5a86', '#e08a6a', '#f2b48a'], '#d79a86', '#b98aa0', [118, 130, 200], 1, 1, 0.8, -0.2, ['rgba(160,80,110,0.55)', 'rgba(80,60,110,0.6)', 'rgba(255,190,150,0.55)'], ['#8a6a9a', '#6d5584', '#4f3f62', '#3a3048']] };
const WX = { tint: 'rgb(118,130,200)', lit: 1, code: null, temp: null, kind: 'clear', name: '' };
function sunTimes(d) { const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), len = 12.2 + 3.1 * Math.cos(2 * Math.PI * (doy - 172) / 365), noon = 12.55; return [noon - len / 2, noon + len / 2]; }
function applyWX() {
  const d = new Date(), QP = new URLSearchParams(location.search), h = QP.get('h') != null ? +QP.get('h') : 15, [rise, set] = sunTimes(d); if (QP.get('wx')) WX.kind = QP.get('wx');
  const keys = [[0, 'night'], [rise - 1, 'night'], [rise - 0.2, 'dawn'], [rise + 1.4, 'morning'], [12.5, 'noon'], [set - 1.5, 'after'], [set, 'sunset'], [set + 0.8, 'dusk'], [set + 2, 'night'], [24, 'night']];
  let i = 0; while (i < keys.length - 2 && h >= keys[i + 1][0]) i++;
  const [h0, a] = keys[i], [h1, b] = keys[i + 1], k = h1 > h0 ? clamp((h - h0) / (h1 - h0)) : 0, A = KF[a], B = KF[b], m = (x, y) => mix(x, y, k), n = (x, y) => x + (y - x) * k;
  const wet = ['rain', 'snow', 'storm', 'fog'].includes(WX.kind), cloudy = WX.kind === 'cloud' || wet, grey = cloudy ? (wet ? 0.45 : 0.25) : 0;
  ENV.sky = A[0].map((c, j) => mix(m(c, B[0][j]), '#8a90a0', grey * (1 - n(A[6], B[6]) * 0.6)));
  setHaze(mix(m(A[1], B[1]), '#a0a4b0', grey), mix(m(A[2], B[2]), '#9498a8', grey));
  const t = A[3].map((c, j) => n(c, B[3][j]) * (1 - grey * 0.35)); WX.tint = `rgb(${t.map(Math.round).join(',')})`;
  WX.lit = Math.max(n(A[4], B[4]), cloudy ? 0.3 : 0); ENV.lamps = Math.max(n(A[5], B[5]), wet ? 0.4 : 0); ENV.stars = cloudy ? 0 : n(A[6], B[6]); ENV.moon = n(A[6], B[6]) > 0.3 && !wet; ENV.sunY = cloudy && n(A[7], B[7]) > 0 ? -0.06 : n(A[7], B[7]);
  ENV.dusk = clamp(1 - n(A[7], B[7]) * 2); ENV.cloud = (k < 0.5 ? A : B)[8].map((c) => cloudy ? c.replace(/[\d.]+\)$/, (v) => Math.min(0.92, parseFloat(v) + 0.2) + ')') : c);
  ENV.mt = A[9].map((c, j) => m(c, B[9][j]));
  WX.name = h < rise - 0.3 || h > set + 1 ? 'tun' : h < rise + 1.4 ? 'tong' : h < set - 1.5 ? 'kun' : 'kech';
  const ic = { clear: WX.name === 'tun' ? '☾' : '☀', cloud: '☁', fog: '≋', rain: '☂', snow: '❄', storm: '⚡' }[WX.kind];
  const el = document.getElementById('wx'); if (el) el.textContent = `${ic} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${WX.name}${WX.temp != null ? ' · ' + (WX.temp > 0 ? '+' : '') + Math.round(WX.temp) + '°' : ''}`;
  dirty = true;
}
async function loadWeather() { try { const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.31&longitude=69.28&current=temperature_2m,weather_code&timezone=auto'); const j = await r.json(); const c = j.current.weather_code; WX.code = c; WX.temp = j.current.temperature_2m;
  if (!new URLSearchParams(location.search).get('wx')) WX.kind = c === 0 || c === 1 ? 'clear' : c <= 3 ? 'cloud' : c <= 48 ? 'fog' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c >= 95 ? 'storm' : 'rain'; } catch (e) {} applyWX(); }
let ghostNick = null, tagsGhost = null;
const cv = document.getElementById('c'), g = cv.getContext('2d');
let target = null, fly = null, drag = null;
const OVER = { x: 0, y: 70, z: -230, p: 0.28, f: 1000, yaw: 0 };
const houseCam = (h) => { const tall = ['tower', 'penthouse', 'cucumber', 'garden', 'mansion'].includes(h.type) ? 3 : 0; const wide = E.W > E.H; return { x: h.x + 1.5, y: ground(h.z) + (wide ? 16 : 11) + tall, z: h.z - (wide ? 27 : 21) - tall * 1.5, p: wide ? 0.42 : 0.3, f: 900 }; };
const C = { ...OVER }; setCam(C);
function resize() { const r = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight; cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.width = w + 'px'; cv.style.height = h + 'px'; if (w / h > 1080 / 1920) { E.H = 1920; E.W = Math.round(1920 * w / h); } else { E.W = 1080; E.H = Math.round(1080 * h / w); } E.PX = cv.width / E.W; dirty = true; }
let dirty = true; addEventListener('resize', resize);

function card(g, txt, x, y, size, o = {}) {
  g.save(); g.font = `900 ${size}px "Rubik"`; const w = g.measureText(txt).width + size * 0.9, h = size * 1.5; g.globalAlpha = o.alpha ?? 1; g.translate(x, y);
  g.fillStyle = o.bg || '#fff6e4'; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, h * 0.3); g.fill(); g.strokeStyle = '#2b2230'; g.lineWidth = Math.max(2.5, size * 0.1); g.stroke();
  g.beginPath(); g.moveTo(-size * 0.3, h / 2 - 2); g.lineTo(size * 0.3, h / 2 - 2); g.lineTo(0, h / 2 + size * 0.45); g.closePath(); g.fill(); g.stroke(); g.fillRect(-size * 0.3 + 2, h / 2 - 6, size * 0.6 - 4, 6);
  g.fillStyle = '#2b2230'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, size * 0.05); g.restore();
}
// рисуем мир (общий код для экрана и карточки в сторис)
function safe(g) { if (g.__safe) return; const oe = g.ellipse, oa = g.arc, og = g.createRadialGradient; g.ellipse = function (x, y, rx, ry, ...r) { return oe.call(this, x, y, Math.abs(rx), Math.abs(ry), ...r); }; g.arc = function (x, y, r, ...a) { return oa.call(this, x, y, Math.abs(r), ...a); }; g.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return og.call(this, x0, y0, Math.abs(r0), x1, y1, Math.abs(r1)); }; g.__safe = true; }
// мир рисуем на отдельном слое: ночной тон ложится на дома целиком, без полосы по линии горизонта
const WL = document.createElement('canvas'), WM = document.createElement('canvas');
function drawWorld(G, T, opt = {}) {
  const cw = G.canvas.width, ch = G.canvas.height; for (const c of [WL, WM]) if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  let g = WL.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch); g.setTransform(G.getTransform()); safe(g);
  G.save(); sky(G, T); const hz = horizon(G, T); G.restore();
  terrain(g, T, {}); lake(g, T); if (opt.plaza !== false) plaza(g, T, [1, 1, 1, 1, 1]);
  const vis = []; for (const h of HOUSES) { const c = proj(h.x, ground(h.z) + 3, h.z + 3); if (c[2] < 2 || c[2] > 1300 || c[0] < -200 || c[0] > E.W + 200 || c[1] < -400 || c[1] > E.H + 300) continue; vis.push([h, c[2]]); }
  for (const d of DACHAS) { const c = proj(d.x, ground(d.z) + 3, d.z + 3); if (c[2] > 2 && c[2] < 600) vis.push([d, c[2], 'd']); }
  for (const q of PROPS) { const c = proj(q.x, ground(q.z), q.z); if (c[2] > 1 && c[2] < 600) vis.push([q, c[2], 'p']); }
  // здание-победитель голосования: vis.push([null, zc, 'm']) и mosque(...) — пример в выпуске 3
  vis.sort((a, b) => b[1] - a[1]);
  for (const [h, zc, kind] of vis) if (!kind && zc < 520 && !(opt.hide && opt.hide(h))) lotGround(g, h);   // газоны и дорожки — до домов
  const tags = [];
  for (const [h, zc, kind] of vis) { if (kind === 'p') { prop(g, h, T); continue; } if (kind === 'd') { house(g, h, T, 1, 0, 0); continue; } if (kind === 'm') { mosque(g, 0, -58, T); continue; } if (opt.hide && opt.hide(h)) continue; const lit = h.status === 'dark' ? 0 : WX.lit; const inf = house(g, h, T, 1, lit, 0); if (!inf) continue; if (opt.pick) { const a = proj(h.x - h.w / 2, ground(h.z), h.z), b = proj(h.x + h.w / 2, inf.roofTop, h.z); opt.pick.push([h, Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1]), zc]); } if (zc < 220) extras(g, h, inf, T, lit);
    if ((!opt.onlyHero && zc < (opt.tagDist || 60)) || h === opt.hero) { const p = proj(h.x, inf.roofTop + 1.2, h.z + 1); if (p[2] > 2) tags.push([h, p[0], p[1], h === opt.hero ? 54 : clamp(cam.f / p[2] * 1.1, 22, 40)]); } }
  if (opt.ghost && GHOST) { const x = GHOST.x, z = GHOST.z, b = ground(z + 7) + 0.3, P8 = [[x - 3.8, b, z], [x + 3.8, b, z], [x + 3.8, b + 5, z], [x - 3.8, b + 5, z], [x, b + 7.5, z]].map((q) => proj(...q));
    if (P8.every((q) => q[2] > 1)) { g.save(); g.setLineDash([10, 9]); g.strokeStyle = '#ffe2a0'; g.lineWidth = 4; g.beginPath(); g.moveTo(P8[0][0], P8[0][1]); g.lineTo(P8[1][0], P8[1][1]); g.lineTo(P8[2][0], P8[2][1]); g.lineTo(P8[4][0], P8[4][1]); g.lineTo(P8[3][0], P8[3][1]); g.closePath(); g.stroke(); g.restore(); const c = proj(x, b + 2.5, z + 3); addLight(c[0], c[1], 150, '255,214,140', 0.3); const t = proj(x, b + 9.5, z); tagsGhost = [opt.ghost, t[0], t[1]]; } }
  { const m = WM.getContext('2d'); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, cw, ch); m.drawImage(WL, 0, 0);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = WX.tint; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'destination-in'; g.drawImage(WM, 0, 0); g.restore(); }
  G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.drawImage(WL, 0, 0); G.restore(); g = G; setOCC(opt.pick && opt.pick.length ? opt.pick : null); drawLights(g); setOCC(null);
  tags.sort((a, b) => (a[0] === opt.hero) - (b[0] === opt.hero) || a[3] - b[3]);
  if (opt.ghost && tagsGhost) { card(g, opt.ghost + '?', tagsGhost[1], tagsGhost[2] - 54, 54, { bg: '#ffcf7a' }); tagsGhost = null; }
  const placed = []; for (const [h, x, y, s] of tags.reverse()) { if (y < 60 || y > E.H - 40) continue; g.font = `900 ${s}px Rubik`; const w = g.measureText(h.nickname).width + s; const r = [x - w / 2, y - s * 1.8, x + w / 2, y]; if (placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue; placed.push(r); card(g, h.nickname, x, y - s, s, { bg: h === opt.hero ? '#ffcf7a' : '#fff6e4', alpha: h.status === 'dark' ? 0.6 : 1 }); }
}
let T0 = performance.now(), lastMove = 1, hiq = false;
function frame(now) {
  const T = (now - T0) / 1000;
  if (fly) { const k = clamp((now - fly.t0) / fly.d), e = ease.inOut(k); const a = fly.a, b = fly.b, up = Math.sin(k * Math.PI) * fly.hop;
    Object.assign(C, { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) + up, z: lerp(a.z, b.z, e) - up * 0.6 * fly.arc, p: lerp(a.p, b.p, e) + Math.sin(k * Math.PI) * 0.15 * fly.arc, f: lerp(a.f, b.f, e), yaw: lerp(a.yaw || 0, b.yaw || 0, e) }); if (k >= 1 && fly.done) fly.done(); if (k >= 1) fly = null; dirty = true; }
  const moving = !!fly || !!drag; if (!moving && lastMove && now - lastMove > 120 && !hiq) { hiq = true; dirty = true; } if (moving) { lastMove = now; hiq = false; }
  if (dirty) { setLOD(hiq ? 480 : 150); setCam(C); g.setTransform(E.PX, 0, 0, E.PX, 0, 0);
    safe(g);
    PICK = []; drawWorld(g, Math.floor(T * 4) / 4, { pick: PICK, ghost: ghostNick, hero: target, hide: target ? hideFor(target) : (ghostNick && GHOST ? (h) => h.z < GHOST.z - 1 && h.z > GHOST.z - 40 && Math.abs(h.x - GHOST.x) < 22 : null) }); dirty = false; }
  requestAnimationFrame(frame);
}
const fx = document.getElementById('fx'), fg = fx.getContext('2d');
function live(now) { const T = now / 1000; fx.width !== cv.width && (fx.width = cv.width, fx.height = cv.height); fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, fx.width, fx.height); fg.setTransform(E.PX, 0, 0, E.PX, 0, 0);
  const dry = !['rain', 'snow', 'storm'].includes(WX.kind);
  if (WX.kind === 'rain' || WX.kind === 'storm') { fg.strokeStyle = 'rgba(200,215,255,0.45)'; fg.lineWidth = 2; fg.beginPath(); for (let i = 0; i < 140; i++) { const x = ((i * 53.7 + T * 90) % (E.W + 200)) - 100, y = ((i * 131.3 + T * 1400) % (E.H + 100)) - 50; fg.moveTo(x, y); fg.lineTo(x - 8, y + 34); } fg.stroke(); if (WX.kind === 'storm' && (T % 7) < 0.12) { fg.fillStyle = 'rgba(255,255,255,0.35)'; fg.fillRect(0, 0, E.W, E.H); } }
  if (WX.kind === 'snow') { fg.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 120; i++) { const x = ((i * 71.3 + Math.sin(T + i) * 30 + T * 20) % (E.W + 40)) - 20, y = ((i * 97.1 + T * (60 + i % 5 * 15)) % (E.H + 40)) - 20; fg.beginPath(); fg.arc(x, y, 2 + (i % 3), 0, 7); fg.fill(); } }
  if (WX.kind === 'fog') { const gr = fg.createLinearGradient(0, E.H * 0.3, 0, E.H); gr.addColorStop(0, 'rgba(220,220,230,0)'); gr.addColorStop(0.4, 'rgba(220,220,230,0.35)'); gr.addColorStop(1, 'rgba(220,220,230,0.15)'); fg.fillStyle = gr; fg.fillRect(0, 0, E.W, E.H); }
  if (dry && ENV.lamps > 0.5) for (let i = 0; i < 36; i++) { const x = ((i * 97.3 + T * (14 + i % 5 * 6)) % (E.W + 120)) - 60, y = E.H * 0.45 + ((i * 211) % (E.H * 0.5)) + Math.sin(T * 1.3 + i) * 30, a = 0.25 + 0.5 * Math.max(0, Math.sin(T * 2.2 + i * 1.7));
    const gr = fg.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, `rgba(255,236,150,${a})`); gr.addColorStop(1, 'rgba(255,236,150,0)'); fg.fillStyle = gr; fg.fillRect(x - 14, y - 14, 28, 28); }
  const m = proj(-60, ground(600) + 75, 600); if (m[2] > 1 && Math.floor(T * 1.6) % 2) { const gr = fg.createRadialGradient(m[0], m[1], 0, m[0], m[1], 26); gr.addColorStop(0, 'rgba(255,90,90,0.9)'); gr.addColorStop(1, 'rgba(255,90,90,0)'); fg.fillStyle = gr; fg.fillRect(m[0] - 26, m[1] - 26, 52, 52); }
  const ph = (T % 11) / 11; if (ph < 0.08 && ENV.stars > 0.5) { const k = ph / 0.08, sx = E.W * (0.75 - k * 0.5), sy = E.H * (0.05 + k * 0.12); fg.strokeStyle = `rgba(255,250,235,${1 - k})`; fg.lineWidth = 3; fg.beginPath(); fg.moveTo(sx, sy); fg.lineTo(sx + 90, sy - 22); fg.stroke(); }
  requestAnimationFrame(live); }
function flyTo(b, d = 2600, done = null) { const dist = Math.hypot(b.x - C.x, b.z - C.z); fly = { a: { ...C }, b: { yaw: 0, ...b }, t0: performance.now(), d: dist < 60 ? Math.min(d, 1300) : d, hop: Math.min(160, dist * 0.25), arc: dist < 60 ? 0 : 1, done }; }

// ---- интерфейс ----
const $ = (s) => document.querySelector(s);
const info = $('#info'), msg = $('#msg');
function find(q) {
  q = q.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase(); if (!q) return;
  const h = BY.get(q);
  if (!h) { $('#welcome').classList.add('gone'); const near = HOUSES.filter((x) => x.nickname.toLowerCase().includes(q)).slice(0, 5);
    if (near.length) { msg.innerHTML = 'Aniq mos kelmadi. Balki sen: ' + near.map((x) => `<a href="#" data-n="${x.nickname}">${x.nickname}</a>`).join(', '); info.hidden = true; return; }
    msg.textContent = ''; target = null; mode = 'free'; $('#orbitbar').hidden = true; info.hidden = true; ghostNick = q; dirty = true;
    if (GHOST) flyTo({ x: GHOST.x + 1.5, y: ground(GHOST.z) + 13, z: GHOST.z - 24, p: 0.32, f: 900, yaw: 0 });
    $('#gnick').textContent = q; $('#ghost').hidden = false; return; }
  ghostNick = null; $('#ghost').hidden = true;
  msg.textContent = ''; inspect(h);
}
function neighbours(h) { return HOUSES.filter((x) => x !== h && x.street === h.street).sort((a, b) => Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z)).slice(0, 4); }
function placeBars() { const hgt = info.hidden ? 0 : info.offsetHeight; $('#orbitbar').style.bottom = `calc(env(safe-area-inset-bottom) + ${hgt + 24}px)`; $('#tools').style.bottom = `calc(env(safe-area-inset-bottom) + ${hgt + 84}px)`; }
addEventListener('resize', () => requestAnimationFrame(placeBars));
// ---- улучшение домов: друзья по твоей ссылке ----
const LV = [['Uy', 0], ['Hovli', 3], ['Qasr', 10]];
async function refCount(nick, post) { try { const r = await fetch('/api/ref' + (post ? '' : '?nick=' + encodeURIComponent(nick)), post ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nick }) } : {}); if (!r.ok) return null; return (await r.json()).count; } catch (e) { return null; } }
function renderLvl(h, n) { const L = n == null ? (h.lvl || 1) : n >= 10 ? 3 : n >= 3 ? 2 : 1; if (L !== h.lvl) { h.lvl = L; dirty = true; }
  $('#lstars').textContent = '★'.repeat(L) + '☆'.repeat(3 - L);
  const next = LV[L]; $('#ltxt').textContent = next ? `${LV[L - 1][0]}. «${next[0]}»gacha: havolang orqali ${next[1]} doʻstdan ${n ?? 0} tasi keldi` : 'Qasr: hovuz, mashina, yashil devor. Maksimum!';
  $('#lfill').style.width = next ? `${Math.min(100, ((n ?? 0) / next[1]) * 100)}%` : '100%'; }
function showInfo(h) {
  renderLvl(h, null); refCount(h.nickname).then((n) => { if (target === h) { renderLvl(h, n); requestAnimationFrame(placeBars); } });
  $('#nbrs').hidden = true; $('#nbtn').textContent = 'Qoʻshnilar ▾';
  $('#nbrs').innerHTML = neighbours(h).map((x) => `<button class="chip" data-n="${x.nickname}">${x.nickname}</button>`).join('');
  $('#nick').textContent = h.nickname; $('#addr').textContent = `${h.street}-koʻcha · ${h.num || 1}-uy`;
  $('#status').textContent = h.status === 'dark' ? 'Chiroq oʻchiq. @uyla.city ga obuna boʻl — va u yonadi!' : (h.rank < 6 || h.id <= 6 ? 'Shaharning ilk aholisidan biri.' : `${HOUSES.length} aholidan №${h.id}`);
  info.hidden = false; history.replaceState(null, '', '#' + h.nickname); requestAnimationFrame(placeBars);
}
$('#wf').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#wq').value.trim(); if (!v) return; $('#q').value = v; $('#welcome').classList.add('gone'); find(v); });
$('#walk').onclick = () => $('#welcome').classList.add('gone');
$('#f').addEventListener('submit', (e) => { e.preventDefault(); find($('#q').value); $('#q').blur(); });
msg.addEventListener('click', (e) => { const n = e.target.dataset?.n; if (n) { e.preventDefault(); $('#q').value = n; find(n); } });
$('#nbtn').onclick = () => { const n = $('#nbrs'); n.hidden = !n.hidden; $('#nbtn').textContent = n.hidden ? 'Qoʻshnilar ▾' : 'Qoʻshnilar ▴'; requestAnimationFrame(placeBars); };
$('#nbrs').addEventListener('click', (e) => { const n = e.target.dataset?.n; if (n) { $('#q').value = n; find(n); } });
$('#invite').onclick = async () => { if (!target) return; const url = location.origin + '/?ref=' + encodeURIComponent(target.nickname) + '#' + encodeURIComponent(target.nickname);
  const text = `UYLA CITY da mening oʻz uyim bor, ${target.street}-koʻcha. Havola orqali kir, oʻz uyingni top — mening uyim kattaroq boʻladi:`;
  try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(text + ' ' + url); $('#invite').textContent = 'Havola nusxalandi'; setTimeout(() => ($('#invite').textContent = 'Uyni kattalashtirish'), 2000); } } catch (e) {} };
{ const ref = new URLSearchParams(location.search).get('ref'); if (ref && /^[A-Za-z0-9._]{1,30}$/.test(ref) && BY.has(ref.toLowerCase())) { let done = null; try { done = localStorage.getItem('tlc_ref'); } catch (e) {}
  if (!done) { refCount(ref, true); try { localStorage.setItem('tlc_ref', ref); } catch (e) {} } history.replaceState(null, '', location.pathname + location.hash); } }
$('#gclose').onclick = () => { $('#ghost').hidden = true; ghostNick = null; dirty = true; };
// --- 1: голосование ---
const VOTES = [['masjid', 'Masjid'], ['choyxona', 'Choyxona'], ['bozor', 'Bozor'], ['stadion', 'Stadion']];
const voted = () => { try { return localStorage.getItem('tlc_vote'); } catch (e) { return null; } };
function renderVotes(data) { const tot = Object.values(data || {}).reduce((a, b) => a + b, 0) || 0, me = voted();
  $('#vlist').innerHTML = VOTES.map(([k, n]) => { const v = data ? data[k] || 0 : null, pc = data && tot ? Math.round(v / tot * 100) : 0;
    return `<button class="vopt${me === k ? ' me' : ''}" data-k="${k}" ${me ? 'disabled' : ''}><span class="bar" style="width:${me ? pc : 0}%"></span><span class="vn">${n}</span><span class="vp">${me && data ? pc + '%' : ''}</span></button>`; }).join('');
  $('#vnote').textContent = me === 'closed' ? (tot ? `Ovozlar: ${tot}.` : '') : me ? (tot ? `Ovozlar: ${tot}. Gʻolib keyingi qismda paydo boʻladi.` : 'Ovozing qabul qilindi!') : 'Bitta telefondan bitta ovoz. Oʻz variantingni Reels ostidagi izohga yoz.'; }
async function loadVotes() { try { const r = await fetch('/api/vote'); renderVotes(r.ok ? await r.json() : null); } catch (e) { renderVotes(null); } }
$('#voteBtn').onclick = () => { $('#vote').hidden = false; renderVotes(null); loadVotes(); };
$('#vclose').onclick = () => ($('#vote').hidden = true);
$('#vgo').onclick = () => { $('#vote').hidden = true; target = null; mode = 'free'; info.hidden = true; flyTo({ x: 6, y: ground(-80) + 14, z: -92, p: 0.22, f: 900, yaw: 0 }, 2200); };
$('#vlist').addEventListener('click', async (e) => { const b = e.target.closest('.vopt'); if (!b || voted()) return; const k = b.dataset.k;
  try { localStorage.setItem('tlc_vote', k); } catch (e2) {} renderVotes(null);
  try { const r = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ opt: k }) }); renderVotes(r.ok || r.status === 409 ? await (r.status === 409 ? (await fetch('/api/vote')).json() : r.json()) : null); } catch (e3) { renderVotes(null); } });
$('#overview').onclick = () => { target = null; mode = 'free'; orb = null; $('#orbitbar').hidden = true; info.hidden = true; flyTo(OVER, 2200); };
// ---- управление: один палец двигает, два пальца приближают; тап по дому — осмотр ----
let PICK = [], mode = 'free', orb = null;   // orb: { h, a, e, d }
const centerOf = (h) => [h.x, ground(h.z + 3) + Math.max(1.5, Math.min(h.h * 0.4, 12)), h.z + 3.5];
function orbitCam(o) { const [cx, cy, cz] = centerOf(o.h), ce = Math.cos(o.e); return { x: cx + o.d * Math.sin(o.a) * ce, y: cy + o.d * Math.sin(o.e), z: cz - o.d * Math.cos(o.a) * ce, p: o.e, f: 900, yaw: -o.a }; }
function hideFor(t) {
  if (mode === 'orbit') { const [cx, , cz] = centerOf(t); return (h) => { if (h === t) return false; if (Math.hypot(h.x - C.x, h.z + h.d / 2 - C.z) < Math.max(h.w, h.d) / 2 + 4) return true; const vx = cx - C.x, vz = cz - C.z, L = Math.hypot(vx, vz) || 1, px = h.x - C.x, pz = h.z + 3.5 - C.z, u = (px * vx + pz * vz) / L; if (u < 0 || u > L - 3) return false; return Math.abs(px * vz - pz * vx) / L < h.w / 2 + 3; }; }
  return (h) => h !== t && h.z < t.z - 1 && Math.abs(h.x - t.x) < 22 && Math.abs(C.x - t.x) < 3;
}
function inspect(h) { target = h; mode = 'orbit'; const tall = ['tower', 'penthouse', 'cucumber', 'garden', 'mansion'].includes(h.type); orb = { h, a: 0, e: 0.16, d: Math.max(tall ? 24 : 17, h.h * 1.1 + 8) }; flyTo(orbitCam(orb), 2400); showInfo(h); $('#orbitbar').hidden = false; const sp = $('#orbitbar span'); sp.style.display = ''; clearTimeout(window.__hint); window.__hint = setTimeout(() => (sp.style.display = 'none'), 4000); }
function leaveOrbit() { if (mode !== 'orbit') return; mode = 'free'; $('#orbitbar').hidden = true; flyTo({ ...houseCam(target), yaw: 0 }, 900); }
function setOrb() { orb.a = ((orb.a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; orb.e = clamp(orb.e, 0.04, 1.2); orb.d = clamp(orb.d, 10, 70); Object.assign(C, orbitCam(orb)); dirty = true; }
const ptrs = new Map(); let gest = null, tap = null;
const toLogical = (x, y) => [x * E.W / innerWidth, y * E.H / innerHeight];
cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); fly = null; drag = true; lastMove = performance.now(); hiq = false;
  tap = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; startGest(); });
function startGest() { const P = [...ptrs.values()]; if (!P.length) { gest = null; return; } const mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length, d = P.length > 1 ? Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]) : 0;
  gest = { mx, my, d, n: P.length, c: { ...C }, o: orb ? { ...orb } : null }; }
cv.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (!gest) return;
  const P = [...ptrs.values()], mx = P.reduce((s, p) => s + p[0], 0) / P.length, my = P.reduce((s, p) => s + p[1], 0) / P.length, dx = mx - gest.mx, dy = my - gest.my;
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tap = null;
  const sc = P.length > 1 && gest.d > 0 ? gest.d / Math.hypot(P[0][0] - P[1][0], P[0][1] - P[1][1]) : 1;   // >1 — пальцы сводят (дальше)
  lastMove = performance.now(); hiq = false;
  if (mode === 'orbit') { orb.a = gest.o.a - dx * 0.008; orb.e = gest.o.e + dy * 0.005; orb.d = gest.o.d * sc; setOrb(); return; }
  const c = gest.c, gy = ground(c.z + 40), k = (c.y - gy) / 500 + 0.05;
  C.x = clamp(c.x - dx * k * 1.4, -1250, 1250); C.z = clamp(c.z + dy * k * 2.2, -1000, 1050);
  if (P.length > 1) { const h = clamp((c.y - gy) * sc, 8, 600); C.y = gy + h; C.z = clamp(C.z + (c.y - gy - h) * 0.35, -1000, 1050); } else C.y = Math.max(c.y + (ground(C.z + 40) - gy), ground(C.z + 20) + 8);
  dirty = true; });
function endPtr(e) { ptrs.delete(e.pointerId); if (tap && ptrs.size === 0 && performance.now() - tap.t < 350) pickAt(tap.x, tap.y); tap = null; if (!ptrs.size) drag = null; startGest(); lastMove = performance.now(); }
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
function pickAt(x, y) { const [lx, ly] = toLogical(x, y); let best = null; for (const r of PICK) if (lx >= r[1] - 6 && lx <= r[2] + 6 && ly >= r[3] - 6 && ly <= r[4] + 6 && (!best || r[5] < best[5])) best = r;
  if (best) { $('#welcome').classList.add('gone'); if (mode === 'orbit' && best[0] === target) return; inspect(best[0]); } }
cv.addEventListener('wheel', (e) => { e.preventDefault(); lastMove = performance.now(); hiq = false; const k = Math.exp(e.deltaY * 0.001);
  if (mode === 'orbit') { orb.d *= k; setOrb(); return; } C.y = clamp(ground(C.z + 20) + (C.y - ground(C.z + 20)) * k, ground(C.z + 20) + 8, 600); dirty = true; }, { passive: false });
$('#zin').onclick = () => { if (mode === 'orbit') { orb.d *= 0.75; setOrb(); return; } C.y = Math.max(ground(C.z + 20) + 8, ground(C.z + 20) + (C.y - ground(C.z + 20)) * 0.7); C.z += 10; dirty = true; };
$('#zout').onclick = () => { if (mode === 'orbit') { orb.d *= 1.3; setOrb(); return; } C.y = Math.min(600, ground(C.z + 20) + (C.y - ground(C.z + 20)) * 1.4); C.z -= 10; dirty = true; };
$('#oleft').onclick = () => { orb.a -= 0.35; setOrb(); }; $('#oright').onclick = () => { orb.a += 0.35; setOrb(); }; $('#oexit').onclick = leaveOrbit;

// ---- карточка в сторис 1080×1920 ----
async function storyCard(h) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const q = c.getContext('2d');
  const save = { W: E.W, H: E.H, PX: E.PX, cam: { ...C } };
  E.W = 1080; E.H = 1920; E.PX = 1; const hc = houseCam(h); setCam({ ...hc, y: hc.y + 2, z: hc.z - 4, yaw: 0 });
  drawWorld(q, 1, { hero: h, onlyHero: true, hide: (x) => x !== h && x.z < h.z - 1 && Math.abs(x.x - h.x) < 22 });
  E.W = save.W; E.H = save.H; E.PX = save.PX; setCam(save.cam);
  q.textAlign = 'center'; q.lineJoin = 'round';
  const top = q.createLinearGradient(0, 0, 0, 520); top.addColorStop(0, 'rgba(22,16,32,0.9)'); top.addColorStop(1, 'rgba(22,16,32,0)'); q.fillStyle = top; q.fillRect(0, 0, 1080, 520);
  q.font = '800 58px Rubik'; q.fillStyle = '#fff3dc'; q.strokeStyle = '#1e1628'; q.lineWidth = 10; q.strokeText('Mening uyim paydo boʻldi', 540, 300); q.fillText('Mening uyim paydo boʻldi', 540, 300);
  q.font = '900 96px Rubik'; q.fillStyle = '#ffcf7a'; q.strokeText('UYLA CITY da', 540, 410); q.fillText('UYLA CITY da', 540, 410);
  const bot = q.createLinearGradient(0, 1400, 0, 1920); bot.addColorStop(0, 'rgba(22,16,32,0)'); bot.addColorStop(1, 'rgba(22,16,32,0.92)'); q.fillStyle = bot; q.fillRect(0, 1400, 1080, 520);
  q.font = '800 44px Rubik'; q.fillStyle = '#fff3dc'; q.fillText(`${h.street}-koʻcha · ${h.num || 1}-uy`, 540, 1560);
  q.fillStyle = '#ffcf7a'; q.beginPath(); q.roundRect(250, 1610, 580, 100, 50); q.fill(); q.font = '900 50px Rubik'; q.fillStyle = '#1e1628'; q.fillText('@uyla.city', 540, 1678);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
$('#story').onclick = async () => { if (!target) return; const b = $('#story'); b.disabled = true; b.textContent = 'Tayyorlanmoqda…';
  try { const blob = await storyCard(target); const file = new File([blob], `uylacity-${target.nickname}.png`, { type: 'image/png' });
    try { await navigator.clipboard?.writeText('@uyla.city'); } catch (e) {}
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); $('#msg').innerHTML = 'Rasm saqlandi. Instagram → Stories ni och va uni tanla.'; }
  } catch (e) {} b.disabled = false; b.textContent = 'Storiesga'; };
$('#wcount').textContent = $('#count').textContent = HOUSES.filter((h) => h.status !== 'dark').length.toLocaleString('uz-UZ');

applyWX(); loadWeather(); setInterval(applyWX, 60000); setInterval(loadWeather, 20 * 60000);
document.fonts.load('900 40px Rubik').then(() => { resize(); requestAnimationFrame(frame); requestAnimationFrame(live); $('#loading').remove(); if (location.hash.length > 1) { $('#welcome').classList.add('gone'); $('#q').value = decodeURIComponent(location.hash.slice(1)); find($('#q').value); } else setTimeout(() => $('#wq').focus({ preventScroll: true }), 600); });
