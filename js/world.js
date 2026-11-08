// world.js — THE LAST CITY: постоянный мир в 3D-проекции, нарисованный кодом в духе аниме-фонов 80–90-х.
// Метры, y — вверх, камера смотрит вдоль +z с наклоном вниз (pitch). Склон холма: y = ground(z).
import { E, clamp, lerp } from './core.js';

// ---------- цвет ----------
const hexRGB = (h) => { if (h[0] === 'r') return h.slice(h.indexOf('(') + 1, -1).split(',').map(Number); const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const MIXC = new Map();   // кэш смешивания цветов: раньше съедал 15% кадра
export const mix = (a, b, k) => { k = Math.round(clamp(k) * 64) / 64; const key = a + '|' + b + '|' + k; let r = MIXC.get(key); if (r) return r;
  const A = hexRGB(a), B = hexRGB(b); r = `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; if (MIXC.size > 60000) MIXC.clear(); MIXC.set(key, r); return r; };
const shade = (c, k) => k >= 0 ? mix(c, '#fff4e0', k) : mix(c, '#1a1226', -k);
export let HAZE = '#d79a86', HAZE_FAR = '#b98aa0';
export function setHaze(a, b) { HAZE = a; HAZE_FAR = b; }
const H01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- окружение: время суток и источники света ----------
export const ENV = { dusk: 0, lamps: 0, sky: null, sunY: 0.2, stars: 0, day: 0, cloud: ['rgba(160,80,110,0.55)', 'rgba(80,60,110,0.6)', 'rgba(255,190,150,0.55)'], mt: null };
export const LIGHTS = [];
export let LZ = 0; export const setLZ = (z) => (LZ = z); export let OCC = null; export const setOCC = (o) => (OCC = o);
export function addLight(x, y, r, col, a) { if (r < 16 || LIGHTS.length > 400) return; LIGHTS.push([x, y, Math.min(r * 0.6, 110), col, Math.min(a, 0.3), LZ]); }
export function drawLights(g) {
  g.save(); g.globalCompositeOperation = 'screen';
  for (let [x, y, r, col, a, z] of LIGHTS) { if (r < 1 || a <= 0) continue; if (OCC && OCC.some((q) => q[5] < z - 4 && x > q[1] && x < q[2] && y > q[3] && y < q[4])) continue; if (r > 200) { a *= 200 / r; r = 200; } const gl = g.createRadialGradient(x, y, 0, x, y, r); gl.addColorStop(0, `rgba(${col},${a})`); gl.addColorStop(0.35, `rgba(${col},${a * 0.35})`); gl.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gl; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.restore(); LIGHTS.length = 0;
}
const lerpHex = (a, b, k) => mix(a, b, k);
// ---------- камера ----------
export const cam = { yaw: 0, x: 0, y: 30, z: -60, p: 0.3, f: 1000 };
export function setCam(c) { Object.assign(cam, c); }
export function proj(x, y, z) {
  let dx = x - cam.x; const dy = y - cam.y; let dz = z - cam.z; const cp = Math.cos(cam.p), sp = Math.sin(cam.p);
  if (cam.yaw) { const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), rx = dx * cy - dz * sy; dz = dx * sy + dz * cy; dx = rx; }
  let zc = dz * cp - dy * sp; const yc = dy * cp + dz * sp; if (Math.abs(zc) < 1e-3) zc = zc < 0 ? -1e-3 : 1e-3;
  return [E.W / 2 + cam.f * dx / zc, E.H / 2 - cam.f * yc / zc, zc];
}
export const ground = (z) => 0.28 * clamp(z, -60, 90) + 0.07 * Math.max(0, z - 90) + 0.05 * Math.min(0, z + 60);
const fog = (zc) => clamp((zc - 40) / 420, 0, 0.85);
const NEAR = 0.6;
export function clipNear(pts) {  // отсечение по ближней плоскости: земля и стены не пропадают у камеры
  const c = pts.map((p) => [(p[0] - E.W / 2) * p[2] / cam.f, (E.H / 2 - p[1]) * p[2] / cam.f, p[2]]), out = [];
  for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR;
    if (ia) out.push(a); if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); } }
  if (out.length < 3) return null; return out.map((q) => [E.W / 2 + cam.f * q[0] / q[2], E.H / 2 - cam.f * q[1] / q[2], q[2]]);
}
function poly(g, pts, fill, stroke = null, lw = 1.6) {
  if (pts.some((p) => p[2] < 0.6)) { pts = clipNear(pts); if (!pts) return; }
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
}
const P = (pts) => pts.map((q) => proj(q[0], q[1], q[2]));
const avgZ = (pts) => pts.reduce((s, q) => s + q[2], 0) / pts.length;
function face(g, pts3, col, light, o = {}) {
  const pr = P(pts3), zc = avgZ(pr);
  const c = mix(shade(col, light), zc > 200 ? HAZE_FAR : HAZE, fog(zc));
  poly(g, pr, c, o.line === false ? null : mix(mix(shade(col, -0.55), '#5a2266', 0.4), HAZE, fog(zc)), o.lw ?? Math.max(1, Math.min(3, 80 / zc)));
  return pr;
}

// ---------- небо ----------
export function sky(g, T) {
  const hz = proj(0, ground(400), cam.z + 1e5)[1];
  const gr = g.createLinearGradient(0, 0, 0, Math.max(200, hz + 60));
  const d = ENV.dusk; if (ENV.sky) { [0, 0.38, 0.7, 0.9, 1].forEach((t, i) => gr.addColorStop(t, ENV.sky[i])); } else { gr.addColorStop(0, lerpHex('#3a3166', '#141a3e', d)); gr.addColorStop(0.38, lerpHex('#7a5288', '#30306a', d)); gr.addColorStop(0.7, lerpHex('#ec9468', '#8a5a86', d)); gr.addColorStop(0.9, lerpHex('#f8c888', '#e08a6a', d)); gr.addColorStop(1, lerpHex('#fde4b4', '#f2b48a', d)); }
  g.fillStyle = gr; g.fillRect(0, 0, E.W, E.H);
  // солнце у горизонта
  const sx = 760 - (cam.yaw || 0) * 600, sy = ENV.sky ? hz - 40 - ENV.sunY * (hz - 120) : hz - 90 + ENV.dusk * 150;
  const sg = g.createRadialGradient(sx, sy, 10, sx, sy, 520); sg.addColorStop(0, 'rgba(255,236,190,0.95)'); sg.addColorStop(0.15, 'rgba(255,200,140,0.55)'); sg.addColorStop(1, 'rgba(255,160,120,0)');
  if (ENV.sunY > -0.05) { g.fillStyle = sg; g.fillRect(0, 0, E.W, E.H); g.fillStyle = '#fff1cf'; g.beginPath(); g.arc(sx, sy, 62, 0, 7); g.fill(); }
  else if (ENV.moon !== false) { const mx = E.W * 0.8, my = Math.max(120, hz - 190); g.fillStyle = 'rgba(255,245,220,0.15)'; g.beginPath(); g.arc(mx, my, 90, 0, 7); g.fill(); g.fillStyle = '#f4ead2'; g.beginPath(); g.arc(mx, my, 40, 0, 7); g.fill(); g.fillStyle = ENV.sky ? ENV.sky[0] : '#141a3e'; g.beginPath(); g.arc(mx + 16, my - 8, 34, 0, 7); g.fill(); }
  // мазки облаков: тёмный низ, подсвеченная кромка
  for (let i = 0; i < 9; i++) {
    const y = hz - 120 - i * 95 - (i % 3) * 20, x = ((i * 337 + T * (6 + i)) % 1700) - 300, w = 380 + (i % 4) * 160, h = 26 + (i % 3) * 12;
    g.fillStyle = i < 4 ? ENV.cloud[0] : ENV.cloud[1]; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill();
    g.fillStyle = ENV.cloud[2]; g.beginPath(); g.ellipse(x + 20, y + h * 0.55, w * 0.85, h * 0.32, 0, 0, 7); g.fill();
  }
  // звёзды сверху
  g.fillStyle = 'rgba(255,240,220,0.9)'; for (let i = 0; i < 70; i++) { const x = H01(i) * E.W, y = H01(i + 50) * Math.max(0, hz - 300); if (y > 20) { g.globalAlpha = (ENV.sky ? ENV.stars : ENV.dusk) * (0.3 + 0.6 * Math.abs(Math.sin(T * 2 + i))); g.fillRect(x, y, 2.5, 2.5); } } g.globalAlpha = 1;
  return hz;
}

// ---------- горизонт: горы, лес, радиовышка (вместо небоскрёбов) ----------
const RUINS = [];
function ridge(g, hz, amp, base, seed, col, step) {
  g.fillStyle = col; g.beginPath(); g.moveTo(-20, E.H);
  for (let x = -20; x <= E.W + 40; x += step) { const u = ((x - E.W / 2) / MS + E.W / 2 + cam.x * 2 - (cam.yaw || 0) * 900) / 180 + seed; const h = MS * amp * (0.55 + 0.3 * Math.sin(u) + 0.15 * Math.sin(u * 2.7 + seed) + 0.08 * Math.sin(u * 7.3)); g.lineTo(x, hz - base - h); }
  g.lineTo(E.W + 40, E.H); g.closePath(); g.fill();
}
function ruin(g, r, T) {}
export let MS = 1;
export function horizon(g, T) {
  MS = clamp(1.55 - cam.y / 160, 0.85, 1.5);
  const hz = proj(0, ground(400), cam.z + 1e5)[1];
  ridge(g, hz, 260, 40, 1.3, (ENV.mt ? ENV.mt[0] : '#8a6a9a'), 24);   // дальние горы — холодные
  // снежные шапки — жёсткие пятна
  ridge(g, hz, 170, 10, 4.1, (ENV.mt ? ENV.mt[1] : '#6d5584'), 20);
  ridge(g, hz, 90, -6, 7.7, (ENV.mt ? ENV.mt[2] : '#4f3f62'), 16);    // ближние холмы
  tashkentSkyline(g, T);
  // кромка леса: зубчатые ели жёсткой заливкой
  g.fillStyle = ENV.mt ? ENV.mt[3] : '#3a3048'; g.beginPath(); g.moveTo(-20, hz + 30);
  for (let x = -20; x <= E.W + 30; x += 14) { const h = 22 + 16 * Math.abs(Math.sin(x * 0.37 + 1.7)) + 10 * Math.abs(Math.sin(x * 0.11)); g.lineTo(x, hz + 6 - h); g.lineTo(x + 7, hz + 6); }
  g.lineTo(E.W + 30, hz + 40); g.closePath(); g.fill();
  return hz;
}
// ---------- земля, дороги, участки ----------
export const PLOT = 13;
export const plots = [];   // свободные участки (заполняет app.js из city v3)
export const GRID = { LW: 16, LD: 22, ST: 10, XP: 138, ZP: 32, X0: -5 };
const isStreetZ = (z) => ((z % 32) + 32) % 32 < 10, isStreetX = (x) => (((x + 5) % 138) + 138) % 138 < 10;
function groundQuad(g, x0, x1, z0, z1, col, light = 0, line = null) {
  const pts = [[x0, ground(z0) + 0.02, z0], [x1, ground(z0) + 0.02, z0], [x1, ground(z1) + 0.02, z1], [x0, ground(z1) + 0.02, z1]];
  let pr = P(pts); if (pr.every((p) => p[2] < NEAR)) return null; if (pr.some((p) => p[2] < NEAR)) { pr = clipNear(pr); if (!pr) return null; } const zc = avgZ(pr);
  poly(g, pr, mix(shade(col, light), HAZE_FAR, fog(zc)), line, 1.2); return pr;
}
function groundDetail(g, T) {
  const R0 = 70, cx = Math.round(cam.x / 2.5) * 2.5, cz = Math.round(cam.z / 2.5) * 2.5, items = [];
  for (let x = cx - R0; x <= cx + R0; x += 2.5) for (let z = cz - R0; z <= cz + R0; z += 2.5) {
    if (isStreetZ(z) || isStreetX(x)) continue;   // не на улице
    const h = H01(x * 0.37 + z * 1.91) * 0.62; const px = x + (H01(x + z * 3.1) - 0.5) * 2.6, pz = z + (H01(x * 2.3 - z) - 0.5) * 2.6;
    const b = proj(px, ground(pz), pz); if (b[2] < 5 || b[2] > 90) continue; items.push([b, h, px, pz]); }
  items.sort((a, b) => b[0][2] - a[0][2]);
  for (const [b, h] of items) { const s = cam.f / b[0 + 2], f = fog(b[2]), sway = Math.sin(T * 1.6 + h * 40) * 0.08 * s;
    if (h < 0.22) { g.fillStyle = mix(h < 0.11 ? '#6e8a48' : '#4c6236', HAZE_FAR, f); g.beginPath(); g.ellipse(b[0], b[1], (1.4 + h * 6) * s, (0.5 + h * 2) * s * Math.max(0.25, Math.sin(cam.p + 0.25)), 0, 0, 7); g.fill(); }
    else if (h < 0.42) { g.strokeStyle = mix('#8fae5c', HAZE_FAR, f); g.lineWidth = Math.max(1, 0.07 * s); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(b[0] + k * 0.12 * s, b[1]); g.quadraticCurveTo(b[0] + k * 0.16 * s, b[1] - 0.4 * s, b[0] + k * 0.26 * s + sway, b[1] - 0.75 * s); g.stroke(); } }
    else if (h < 0.5) { g.fillStyle = mix('#7a706a', HAZE_FAR, f); g.beginPath(); g.ellipse(b[0], b[1] - 0.12 * s, 0.4 * s, 0.22 * s, 0, 0, 7); g.fill(); }
    else { g.fillStyle = mix(['#e8c46a', '#d98aa0', '#f0e6d8'][Math.floor(h * 300) % 3], HAZE_FAR, f); for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(b[0] + (k - 1) * 0.3 * s, b[1] - (0.3 + (k % 2) * 0.15) * s, 0.12 * s, 0, 7); g.fill(); } } }
}
export function terrain(g, T, opt = {}) {
  { const hz = proj(0, ground(400), cam.z + 1e5)[1]; g.fillStyle = mix('#5f9a40', HAZE_FAR, 0.8); g.fillRect(0, Math.max(0, hz + 4), E.W, E.H); }
  { const z0 = Math.floor((cam.z + 2) / 40) * 40; const st = [], fw = Math.cos(cam.yaw || 0) >= 0 ? 1 : -1; for (let z = z0 - 760; z <= z0 + 760; z += 40) st.push(z); st.sort((a, b) => fw * (b - a)); for (const z of st) groundQuad(g, cam.x - 3000, cam.x + 3000, z - 40, z + 1, '#66783f', 0); }
  // улицы вдоль x между рядами
  // улицы: тротуар + дорога + разметка, вдоль x перед каждым рядом участков и поперечные каждые 138
  { const jz = Math.round(cam.z / 32), bx = Math.round((cam.x + 5) / 138), XR = 1300, ZR = 1000;
    const rows = []; for (let j = jz - 23; j <= jz + 23; j++) rows.push(j); rows.sort((a, b) => Math.abs(b * 32 + 5 - cam.z) - Math.abs(a * 32 + 5 - cam.z));
    for (const j of rows) { const z = j * 32; if (z < -980 || z > 1060) continue; const xa = Math.max(-1250, cam.x - XR), xb = Math.min(1250, cam.x + XR);
      groundQuad(g, xa, xb, z, z + 1.5, '#9a8e88', -0.02); groundQuad(g, xa, xb, z + 8.5, z + 10, '#9a8e88', -0.02); groundQuad(g, xa, xb, z + 1.5, z + 8.5, '#5a5058', -0.05);
      if (Math.abs(z + 5 - cam.z) < 160) for (let x = Math.floor(xa / 6) * 6; x < xb; x += 6) { if (isStreetX(x) || isStreetX(x + 3)) continue; if (Math.abs(x - cam.x) > 160) continue; groundQuad(g, x, x + 3, z + 4.85, z + 5.15, '#e8dcb0', 0); } }
    const cols = []; for (let b = bx - 10; b <= bx + 10; b++) cols.push(b); cols.sort((a, b) => Math.abs(b * 138 - cam.x) - Math.abs(a * 138 - cam.x));
    for (const b of cols) { const x = -5 + b * 138; if (x < -1260 || x > 1250) continue; const za = Math.max(-980, cam.z - 760), zb = Math.min(1060, cam.z + 760);
      for (let z = za; z < zb;) { const st = Math.abs(z - cam.z) < 200 ? 30 : 100, z2 = Math.min(zb, z + st);   // по кускам: дорога ложится на склон
        groundQuad(g, x, x + 1.5, z, z2 + 0.3, '#9a8e88', -0.02); groundQuad(g, x + 8.5, x + 10, z, z2 + 0.3, '#9a8e88', -0.02); groundQuad(g, x + 1.5, x + 8.5, z, z2 + 0.3, '#5a5058', -0.05); z = z2; } } }
  groundDetail(g, T);
  // трещины и трава на асфальте
  for (let i = 0; i < 60; i++) { const z = -40 + H01(i + 3) * 240, x = (H01(i) - 0.5) * 2.8; const a = proj(x, ground(z) + 0.05, z), b = proj(x + 0.6, ground(z + 1.5) + 0.05, z + 1.5); if (a[2] < 1 || b[2] < 1) continue; g.strokeStyle = 'rgba(40,30,30,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  // участки: пустые — рамка из колышков, подсветка волной
  const glow = opt.plotGlow || 0, gx = opt.glowX ?? 0, gz = opt.glowZ ?? 16;
  for (const pl of plots) {
    if (pl.taken) continue; if (Math.abs(pl.x - cam.x) > 260 || Math.abs(pl.z - cam.z) > 420) continue;
    const x0 = pl.x - 7, x1 = pl.x + 7, z0 = pl.z - 4, z1 = pl.z + 16;
    const d = Math.hypot(pl.x - gx, pl.z - gz), wave = clamp(glow * 160 - d) / 1;
    const tint = ['#5d6a40', '#66703f', '#596638', '#6e6a44'][(((pl.i * 7 + pl.j * 3) % 4) + 4) % 4];
    const pr = groundQuad(g, x0, x1, z0, z1, tint, 0.0);
    if (!pr) continue;
    const zc = avgZ(pr); if (zc > 330) continue;
    const lit = clamp(wave / 20);
    if (lit > 0.02) { g.strokeStyle = `rgba(255,224,150,${0.5 + 0.5 * lit})`; g.lineWidth = 2 + lit * 2.5; g.beginPath(); pr.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke(); g.fillStyle = `rgba(255,214,140,${0.28 * lit})`; g.fill();
      if (zc < 140) for (const c of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { const a = proj(c[0], ground(c[1]), c[1]), b = proj(c[0], ground(c[1]) + 0.9, c[1]); g.strokeStyle = '#3a2a20'; g.lineWidth = Math.max(1, 30 / zc); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    // «?» на части участков
    if (opt.qmarks && H01(pl.i * 31 + pl.j * 7) < 0.33 && zc < 200) { const k = clamp((opt.qmarks - H01(pl.i + pl.j * 3)) * 3); if (k > 0) { const p = proj(pl.x, ground(pl.z + 4.5) + 2.2, pl.z + 4.5); const s = Math.max(22, 1500 / zc) * k; g.font = `900 ${s}px "Rubik"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = s / 6; g.strokeStyle = 'rgba(30,20,40,0.85)'; g.strokeText('?', p[0], p[1]); g.fillStyle = '#ffe2a0'; g.fillText('?', p[0], p[1]); } }
  }
  return null;
}
// крупный реквизит с постоянными местами
export const PROPS = [];
(() => {  // фонари вдоль тротуаров (через участок) и припаркованные машины
  let n = 0; for (let j = -31; j <= 33; j++) { const z = j * 32; if (z < -980 || z > 1060) continue;
    for (let x = -1240; x <= 1240; x += 32) { if (isStreetX(x) || (x > -40 && x < 40 && z > -70 && z < -10)) continue; PROPS.push({ kind: 'lamp', x, z: z + 9.6, seed: n++, d: 0 });
      if (H01(x * 0.13 + j * 3.7) < 0.12) PROPS.push({ kind: 'car', x: x + 11, z: z + 7.2, seed: n++, park: true }); } }
})();
function tree(g, x, z, sc, T, seed) {
  const b = proj(x, ground(z), z); if (b[2] < 2 || b[2] > 300) return; const s = cam.f / b[2] * sc, fz = fog(b[2]);
  g.fillStyle = mix('#4a3428', HAZE, fz); g.fillRect(b[0] - 0.25 * s, b[1] - 3 * s, 0.5 * s, 3 * s);
  const sw = Math.sin(T * 1.3 + seed) * 0.15 * s;
  for (const [dx, dy, r, c] of [[-1.1, -4.2, 1.9, '#3f5a34'], [1.0, -4.5, 1.8, '#3f5a34'], [0, -5.6, 2.1, '#4c6a3a'], [-0.4, -6.4, 1.4, '#5f7f44']]) { g.fillStyle = mix(c, HAZE, fz); g.beginPath(); g.arc(b[0] + dx * s + sw * (dy / -6), b[1] + dy * s, r * s, 0, 7); g.fill(); }
  g.fillStyle = mix('#c9b060', HAZE, fz); g.globalAlpha = 0.55; g.beginPath(); g.arc(b[0] + 0.9 * s + sw, b[1] - 5.9 * s, 1.0 * s, 0, 7); g.fill(); g.globalAlpha = 1;   // жёсткий блик заката
}
function wallRuin(g, x, z, sc, seed) {
  const y0 = ground(z), w = 5 * sc, pts = [[x - w / 2, y0, z], [x + w / 2, y0, z]]; for (let i = 6; i >= 0; i--) pts.push([x - w / 2 + w * i / 6, y0 + 1.2 + H01(seed * 9 + i) * 2.4, z]);
  face(g, pts, '#8a7a70', 0.0); const v = proj(x - w * 0.3, y0 + 1, z - 0.05); if (v[2] > 1) { const s = cam.f / v[2]; g.fillStyle = '#5e7f45'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(v[0] + i * 0.4 * s, v[1] - (i % 2) * 0.4 * s, 0.35 * s, 0, 7); g.fill(); } }
}
function car(g, x, z, seed) {
  const y0 = ground(z); box(g, x - 0.9, x + 0.9, y0 + 0.3, y0 + 1.2, z, z + 4.2, '#8a5a3a'); box(g, x - 0.8, x + 0.8, y0 + 1.2, y0 + 1.9, z + 1.2, z + 3.0, '#7a4a32');
  onFront(g, x - 0.7, y0 + 1.25, 1.4, 0.55, z + 1.2, '#3a3a4a', 0.1);
}
function lamp(g, x, z, on, T) {
  const y0 = ground(z), a = proj(x, y0, z), b = proj(x, y0 + 5, z); LZ = a[2]; if (a[2] < 6 || a[2] > 260) return; const s = cam.f / a[2];
  g.strokeStyle = mix('#2e2838', HAZE, fog(a[2])); g.lineWidth = Math.max(1.2, 0.18 * s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0] - Math.sign(x) * 0.7 * s, b[1]); g.stroke();
  const hx = b[0] - Math.sign(x) * 0.7 * s, hy = b[1] + 0.15 * s;
  g.fillStyle = on > 0 ? mix('#5a4a40', '#ffe2a0', on) : '#4a4048'; g.beginPath(); g.ellipse(hx, hy, 0.35 * s, 0.18 * s, 0, 0, 7); g.fill();
  if (on > 0) { addLight(hx, hy, 6 * s, '255,200,120', 0.55 * on); const c = proj(x - Math.sign(x) * 0.7, y0 + 0.02, z); g.fillStyle = `rgba(255,210,140,${0.18 * on})`; g.beginPath(); g.ellipse(c[0], c[1], 2.4 * s, 0.9 * s, 0, 0, 7); g.fill(); }
}
export function props(g, T, zLo, zHi) {
  const list = PROPS.filter((q) => q.z >= zLo && q.z < zHi).sort((a, b) => b.z - a.z);
  for (const q of list) prop(g, q, T);
}
export function prop(g, q, T) {
  { if (q.kind === 'tree') tree(g, q.x, q.z, q.s, T, q.seed); else if (q.kind === 'wall') wallRuin(g, q.x, q.z, q.s, q.seed); else if (q.kind === 'car') { if (q.park) parkedCar(g, q.x, q.z, q.seed); else car(g, Math.sign(q.x) * 6.5 + (q.x > 0 ? -2 : 2), q.z, q.seed); } else lamp(g, q.x, q.z, clamp(ENV.lamps * 12 - q.d / 8), T); }
}
// кусты, обломки, трава на переднем плане
export function scatter(g, T) {
  const items = []; for (let i = 0; i < 260; i++) { const x = (H01(i * 1.7) - 0.5) * 170, z = -30 + H01(i * 2.3) * 200; if (Math.abs(x) < 2.2) continue; if (plots.some((p) => p.taken && Math.abs(p.x - x) < 5.5 && z > p.z - 1 && z < p.z + 10)) continue; items.push([x, z, i]); }
  items.sort((a, b) => b[1] - a[1]);
  for (const [x, z, i] of items) { const b = proj(x, ground(z), z); if (b[2] < 2 || b[2] > 220) continue; const s = cam.f / b[2]; const kind = i % 3; const sway = Math.sin(T * 1.6 + i) * 0.12 * s;
    if (kind === 0) { g.fillStyle = mix('#4f6a3a', HAZE, fog(b[2])); g.beginPath(); g.ellipse(b[0] + sway * 0.3, b[1] - 0.5 * s, 1.1 * s, 0.6 * s, 0, 0, 7); g.fill(); g.fillStyle = mix('#7d9a4e', HAZE, fog(b[2])); g.beginPath(); g.ellipse(b[0] - 0.3 * s + sway, b[1] - 0.75 * s, 0.6 * s, 0.35 * s, 0, 0, 7); g.fill(); }
    else if (kind === 1) { g.fillStyle = mix('#6b5c58', HAZE, fog(b[2])); g.beginPath(); g.moveTo(b[0] - 0.9 * s, b[1]); g.lineTo(b[0] - 0.3 * s, b[1] - 0.7 * s); g.lineTo(b[0] + 0.8 * s, b[1] - 0.3 * s); g.lineTo(b[0] + 1.0 * s, b[1]); g.closePath(); g.fill(); }
    else { g.strokeStyle = mix('#8aa05a', HAZE, fog(b[2])); g.lineWidth = Math.max(1, 0.08 * s); for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(b[0] + k * 0.15 * s, b[1]); g.quadraticCurveTo(b[0] + k * 0.2 * s, b[1] - 0.5 * s, b[0] + k * 0.3 * s + sway, b[1] - 0.9 * s); g.stroke(); } } }
}

// ---------- дома ----------
function box(g, x0, x1, y0, y1, z0, z1, col, o = {}) {
  if (cam.x < x0) face(g, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], col, -0.28);
  if (cam.x > x1) face(g, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], col, -0.28);
  if (cam.y > y1 && o.top !== false) face(g, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], o.topCol || col, 0.12);
  return face(g, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], col, 0.05);
}
// прямоугольник на фасаде (z = const) в локальных координатах фасада
function onFront(g, x0, y0, w, h, z, col, light = 0) { return face(g, [[x0, y0, z - 0.02], [x0 + w, y0, z - 0.02], [x0 + w, y0 + h, z - 0.02], [x0, y0 + h, z - 0.02]], col, light, { lw: 1 }); }
function windowAt(g, x, y, w, h, z, lit, T, seed) {
  const pr = onFront(g, x - 0.12, y - 0.12, w + 0.24, h + 0.24, z, '#e8dcc8', 0.1);
  const on = lit > 0 ? clamp(lit) * (0.85 + 0.15 * Math.sin(T * 2 + seed)) : 0;
  onFront(g, x, y, w, h, z - 0.01, on > 0 ? mix('#3a4a6a', '#ffcf7a', on) : '#3a4a6a', 0.15);
  if (on > 0.2) { const c = proj(x + w / 2, y + h / 2, z); if (c[2] > 1 && c[2] < 110) addLight(c[0], c[1], Math.max(14, (w + h) * cam.f / c[2] * 0.9), '255,190,110', 0.35 * on * (0.4 + ENV.dusk)); }
  const a = proj(x + w / 2, y, z - 0.03), b = proj(x + w / 2, y + h, z - 0.03); g.strokeStyle = '#e8dcc8'; g.lineWidth = Math.max(1, 0.1 * cam.f / a[2]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
}
// табличка на фасаде с ником (текст в перспективе фасада)
function signBoard(g, cx, y, w, h, z, nick, col) {
  onFront(g, cx - w / 2, y, w, h, z - 0.05, '#2b2230', 0); onFront(g, cx - w / 2 + 0.08, y + 0.08, w - 0.16, h - 0.16, z - 0.06, col, 0.15);
  const p0 = proj(cx - w / 2, y + h, z - 0.07), p1 = proj(cx + w / 2, y + h, z - 0.07), p2 = proj(cx - w / 2, y, z - 0.07);
  if (p0[2] < 1) return; const K = 100;
  g.save(); g.setTransform(E.PX * (p1[0] - p0[0]) / (w * K), E.PX * (p1[1] - p0[1]) / (w * K), E.PX * (p2[0] - p0[0]) / (h * K), E.PX * (p2[1] - p0[1]) / (h * K), E.PX * p0[0], E.PX * p0[1]);
  let fs = h * K * 0.62; g.font = `900 ${fs}px "Rubik"`; const tw = g.measureText(nick).width; if (tw > w * K * 0.86) { fs *= w * K * 0.86 / tw; g.font = `900 ${fs}px "Rubik"`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#2b2230'; g.fillText(nick, w * K / 2, h * K / 2 + fs * 0.04); g.restore();
}
function gableX(g, x0, x1, y, z0, z1, rh, col, oh = 0.5) {  // конёк вдоль x
  const zm = (z0 + z1) / 2, a = x0 - oh, b = x1 + oh, f = z0 - oh, k = z1 + oh;
  if (cam.x < x0) face(g, [[x0, y, z0], [x0, y, z1], [x0, y + rh, zm]], col, -0.3);
  if (cam.x > x1) face(g, [[x1, y, z0], [x1, y, z1], [x1, y + rh, zm]], col, -0.3);
  if (cam.y > y + rh) face(g, [[a, y, k], [b, y, k], [b, y + rh, zm], [a, y + rh, zm]], col, -0.15);
  return face(g, [[a, y - 0.15, f], [b, y - 0.15, f], [b, y + rh, zm], [a, y + rh, zm]], col, 0.18);
}
function gableZ(g, x0, x1, y, z0, z1, rh, col, wallCol, oh = 0.5) {  // конёк вдоль z: треугольный фронтон спереди
  const xm = (x0 + x1) / 2, a = x0 - oh, b = x1 + oh, f = z0 - oh, k = z1 + oh;
  const L = () => face(g, [[a, y - 0.15, f], [a, y - 0.15, k], [xm, y + rh, k], [xm, y + rh, f]], col, -0.05);
  const R = () => face(g, [[b, y - 0.15, f], [b, y - 0.15, k], [xm, y + rh, k], [xm, y + rh, f]], col, 0.12);
  if (cam.x < xm) { R(); L(); } else { L(); R(); }
  face(g, [[x0, y, z0], [x1, y, z0], [xm, y + rh, z0]], wallCol, 0.0);
  return [a, b, f];
}
function hip(g, x0, x1, y, z0, z1, rh, col, oh = 1.0) {   // японская вальмовая крыша с выносом
  const a = x0 - oh, b = x1 + oh, f = z0 - oh, k = z1 + oh, r0 = lerp(a, b, 0.3), r1 = lerp(a, b, 0.7), zm = (f + k) / 2;
  if (cam.x < a + 1) face(g, [[a, y, f], [a, y, k], [r0, y + rh, zm]], col, -0.3);
  if (cam.x > b - 1) face(g, [[b, y, f], [b, y, k], [r1, y + rh, zm]], col, -0.3);
  if (cam.y > y + rh) face(g, [[a, y, k], [b, y, k], [r1, y + rh, zm], [r0, y + rh, zm]], col, -0.15);
  face(g, [[a - 0.3, y - 0.25, f - 0.2], [b + 0.3, y - 0.25, f - 0.2], [r1, y + rh, zm], [r0, y + rh, zm]], col, 0.15);
  const p = P([[r0, y + rh + 0.15, zm], [r1, y + rh + 0.15, zm]]); g.strokeStyle = '#2a2230'; g.lineWidth = Math.max(1.5, 0.3 * cam.f / p[0][2]); g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[1][0], p[1][1]); g.stroke();
}
export function smoke(g, x, y, z, T, k = 1) {
  for (let i = 0; i < 7; i++) { const ph = (T * 0.35 + i / 7) % 1, p = proj(x + Math.sin(T + i) * 0.4 + ph * 1.5, y + ph * 6, z + ph); if (p[2] < 1) continue; const r = (0.4 + ph * 1.4) * cam.f / p[2]; g.fillStyle = `rgba(230,210,210,${0.35 * (1 - ph) * k})`; g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fill(); }
}

// дом целиком. a — прогресс появления (0..1+), lit — свет в окнах, door — открытие двери
// ---------- двор: газон, дорожка, забор; уровни 1 «Дом», 2 «Усадьба», 3 «Особняк» ----------
const CARC = ['#c0392b', '#2e86c1', '#f0c060', '#e8e4dc', '#27ae60', '#8e44ad'];
function drivewayCar(g, x, z, seed) { const y0 = ground(z + 2), c = CARC[seed % CARC.length];
  box(g, x - 0.95, x + 0.95, y0 + 0.35, y0 + 1.15, z, z + 4.2, c); box(g, x - 0.85, x + 0.85, y0 + 1.15, y0 + 1.8, z + 1.1, z + 3.1, c, { topCol: shade(c, 0.1) });
  onFront(g, x - 0.75, y0 + 1.2, 1.5, 0.5, z + 1.1, '#3a4a6a', 0.1); onFront(g, x - 0.8, y0 + 0.6, 0.35, 0.25, z, '#ffe2a0', 0.2); onFront(g, x + 0.45, y0 + 0.6, 0.35, 0.25, z, '#ffe2a0', 0.2); }
function parkedCar(g, x, z, seed) { const y0 = ground(z), c = CARC[seed % CARC.length];
  box(g, x - 2.1, x + 2.1, y0 + 0.35, y0 + 1.15, z - 0.9, z + 0.9, c); box(g, x - 1.1, x + 1.0, y0 + 1.15, y0 + 1.8, z - 0.8, z + 0.8, c, { topCol: shade(c, 0.1) });
  onFront(g, x - 1.0, y0 + 1.2, 1.9, 0.5, z - 0.8, '#3a4a6a', 0.1);
  for (const wx of [x - 1.3, x + 1.3]) { const p = proj(wx, y0 + 0.35, z - 0.92); if (p[2] > 1) { const r = 0.38 * cam.f / p[2]; g.fillStyle = '#1e1a24'; g.beginPath(); g.arc(p[0], p[1], r, 0, 7); g.fill(); } } }
export function lotGround(g, H) {
  if (!H.lot) return; const [x0, z0, x1, z1] = H.lot, L = H.lvl || 1, c = proj(H.x, ground(H.z), H.z); if (c[2] > 520) return;
  groundQuad(g, x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 0.3, ['#62a843', '#6cb84a', '#7cc852'][L - 1], 0);
  if (c[2] > 260) return;
  groundQuad(g, H.x - 0.8, H.x + 0.8, z0, H.z, '#cdbfa8', 0);                       // дорожка к двери
  if (L >= 2) { groundQuad(g, H.x - H.w / 2, H.x - 1.2, H.z - 1.4, H.z - 0.3, '#5a3a2a', 0); groundQuad(g, H.x + 1.2, H.x + H.w / 2, H.z - 1.4, H.z - 0.3, '#5a3a2a', 0); }
  const SP = H.spec || {};
  if (L >= 3 || SP.pool) { const bz = H.z + H.d + 2, px = SP.banya ? 2.2 : 0; groundQuad(g, H.x + px - 3.6, H.x + px + 3.6, bz - 0.4, bz + 6.4, '#e8e0d0', 0); groundQuad(g, H.x + px - 3.2, H.x + px + 3.2, bz, bz + 6, '#3a9ad0', 0.1); }
  if (L >= 3 || SP.car) groundQuad(g, x1 - 3.6, x1 - 0.6, z0, H.z + 2, '#9a9490', 0);
}
function flowers(g, x0, x1, z) { const n = Math.max(2, Math.round((x1 - x0) / 0.7)); for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n), p = proj(x, ground(z) + 0.35, z); if (p[2] < 1) continue; const s = cam.f / p[2];
  g.fillStyle = mix('#3f6a34', HAZE, fog(p[2])); g.beginPath(); g.arc(p[0], p[1] + 0.1 * s, 0.32 * s, 0, 7); g.fill(); g.fillStyle = ['#ff8aa8', '#ffd25a', '#f4f0ff'][i % 3]; g.beginPath(); g.arc(p[0], p[1] - 0.05 * s, 0.13 * s, 0, 7); g.fill(); } }
function fenceRun(g, xa, za, xb, zb, L) {   // штакетник между двумя точками
  const len = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(len / (L >= 2 ? 0.7 : 2.2))), hgt = L >= 3 ? 1.3 : L >= 2 ? 1.0 : 0.8;
  const col = L >= 3 ? '#3e6a3a' : L >= 2 ? '#f2ece0' : '#8a6a4a';
  if (L >= 3) { face(g, [[xa, ground(za), za], [xb, ground(zb), zb], [xb, ground(zb) + hgt, zb], [xa, ground(za) + hgt, za]], col, 0.05); return; }   // живая изгородь
  for (let i = 0; i <= n; i++) { const x = lerp(xa, xb, i / n), z = lerp(za, zb, i / n), a = proj(x, ground(z), z), b = proj(x, ground(z) + hgt, z); if (a[2] < 1) continue;
    g.strokeStyle = mix(col, HAZE, fog(a[2])); g.lineWidth = Math.max(1, 0.12 * cam.f / a[2]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  for (const r of [0.35, 0.7]) { const a = proj(xa, ground(za) + hgt * r, za), b = proj(xb, ground(zb) + hgt * r, zb); if (a[2] < 1 || b[2] < 1) continue; g.strokeStyle = mix(col, HAZE, fog(a[2])); g.lineWidth = Math.max(1, 0.07 * cam.f / a[2]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
}
function yardPart(g, H, T, part) {
  const [x0, z0, x1, z1] = H.lot, L = H.lvl || 1, c = proj(H.x, ground(H.z), H.z); if (c[2] > 160 || c[2] < 0.5) return;
  const hz0 = H.z, hz1 = H.z + H.d;
  if (part === 'back') {
    if (H.spec && H.spec.banya) banya(g, H, T);
    fenceRun(g, x0 + 0.4, z1 - 0.4, x1 - 0.4, z1 - 0.4, L);
    for (const x of [x0 + 0.4, x1 - 0.4]) fenceRun(g, x, hz0, x, z1 - 0.4, L);
    if (L >= 2 || H01(H.id * 1.7) < 0.65) tree(g, x0 + 3, z1 - 3.5, 0.75, T, H.id);
    if (L >= 3 || (H.spec && H.spec.pool)) { if (L >= 3) tree(g, x1 - 2.6, z1 - 2.6, 0.7, T, H.id + 3); const p = proj(H.x, ground(hz1 + 5) + 0.3, hz1 + 5); if (p[2] > 1 && ENV.lamps > 0.3) addLight(p[0], p[1], 7 * cam.f / p[2], '120,200,255', 0.35); }
  } else {
    if (L >= 2 || H01(H.id * 2.3) < 0.55) { flowers(g, H.x - H.w / 2 + 0.3, H.x - 1.4, hz0 - 0.85); flowers(g, H.x + 1.4, H.x + H.w / 2 - 0.3, hz0 - 0.85); }
    for (const x of [x0 + 0.4, x1 - 0.4]) fenceRun(g, x, z0 + 0.4, x, hz0, L);
    fenceRun(g, x0 + 0.4, z0 + 0.4, H.x - 1.2, z0 + 0.4, L); fenceRun(g, H.x + 1.2, z0 + 0.4, L >= 3 ? x1 - 4 : x1 - 0.4, z0 + 0.4, L);
    // почтовый ящик с ником
    { const mx = H.x + 1.7, mz = z0 + 0.9, a = proj(mx, ground(mz), mz), b = proj(mx, ground(mz) + 1.1, mz); if (a[2] > 1) { const s = cam.f / a[2]; g.strokeStyle = '#4a3428'; g.lineWidth = Math.max(1, 0.12 * s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.fillStyle = L >= 3 ? '#c9a24a' : '#c0392b'; g.fillRect(b[0] - 0.35 * s, b[1] - 0.28 * s, 0.7 * s, 0.32 * s); } }
    if (L >= 2) { const lx = H.x - 1.3, a = proj(lx, ground(z0 + 1), z0 + 1), b = proj(lx, ground(z0 + 1) + 1.6, z0 + 1); if (a[2] > 1) { const s = cam.f / a[2]; g.strokeStyle = '#2e2838'; g.lineWidth = Math.max(1, 0.1 * s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.fillStyle = ENV.lamps > 0.3 ? '#ffe2a0' : '#d8d0c0'; g.beginPath(); g.arc(b[0], b[1], 0.22 * s, 0, 7); g.fill(); if (ENV.lamps > 0.3) addLight(b[0], b[1], 4 * s, '255,210,140', 0.4); } }
    if (L >= 3 || (H.spec && H.spec.car)) drivewayCar(g, x1 - 2.1, z0 + 0.8, H.id);
  }
}
function banya(g, H, T, lit = ENV.lamps > 0.3 ? 1 : 0) { const bx = H.x - H.w / 2 + 0.6, bz = H.z + H.d + 2, y = ground(bz + 3) + 0.2; box(g, bx - 1.6, bx + 1.6, y, y + 2.4, bz, bz + 3, '#9a6a3a'); gableX(g, bx - 1.6, bx + 1.6, y + 2.4, bz, bz + 3, 1.2, '#5a4a3a', 0.3); windowAt(g, bx - 0.4, y + 1.1, 0.8, 0.6, bz, lit, T, 77); smoke(g, bx + 0.8, y + 3.6, bz + 1.5, T, 1); const p = proj(bx, y + 4.6, bz); g.font = `900 ${Math.max(12, 0.9 * cam.f / p[2])}px "Rubik"`; g.textAlign = 'center'; g.fillStyle = '#fff3dc'; g.strokeStyle = '#1e1628'; g.lineWidth = 4; g.strokeText('HAMMOM', p[0], p[1]); g.fillText('HAMMOM', p[0], p[1]); }
let DUMMY = null;
const ROUND = ['yurt', 'cucumber', 'pineapple', 'hut', 'apple', 'watermelon', 'tomato', 'strawberry', 'lemon', 'mushroom', 'burger', 'inferno'];
export function house(g, H, T, a = 1, lit = 0, door = 0) {
  if (!H.lot || a < 1) return houseCore(g, H, T, a, lit, door);
  const backFirst = cam.z < H.z + H.d / 2; yardPart(g, H, T, backFirst ? 'back' : 'front'); const inf = houseCore(g, H, T, a, lit, door); if (inf) yardPart(g, H, T, backFirst ? 'front' : 'back'); return inf;
}
function houseCore(g, H, T, a = 1, lit = 0, door = 0) {
  if (a < 1 || cam.z <= H.z + 0.3 || ROUND.includes(H.type)) return houseFront(g, H, T, a, lit, door);
  const pc = proj(H.x, ground(H.z) + 3, H.z + H.d / 2); if (pc[2] < 1) return null; if (pc[2] > LOD) return houseFront(g, H, T, a, lit, door);
  // камера за фасадом: фасад (табличка, дверь, окна) не рисуем — только размеры дома, затем вид сзади
  if (!DUMMY) DUMMY = (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(2, 2) : document.createElement('canvas')).getContext('2d');
  const nl = LIGHTS.length; let inf = null; try { inf = houseFront(DUMMY, H, T, a, lit, door); } catch (e) {} LIGHTS.length = nl;
  if (!inf) return null;
  return houseBack(g, H, T, lit, inf);
}
function prism(g, x0, x1, y0, y1, z0, z1, col, topCol) {  // коробка, видимая сзади/сбоку
  if (cam.x < x0) face(g, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], col, -0.28);
  if (cam.x > x1) face(g, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], col, -0.28);
  if (cam.z > z1) face(g, [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], col, -0.12);
  if (cam.y > y1 && topCol) face(g, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], topCol, 0.12);
}
function houseBack(g, H, T, lit, inf) {
  const x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z, z1 = H.z + H.d, fb = ground(z0), y0 = ground(z1) + 0.3;
  const top = Math.max(y0 + 2.2, inf.top), rt = Math.max(top, inf.roofTop || top), wall = H.wall || '#b8a99a', roof = H.roof || '#6a4a5a';
  LZ = proj(H.x, (y0 + top) / 2, z1)[2];
  prism(g, x0 - 0.3, x1 + 0.3, fb - 0.1, y0, z0 - 0.3, z1 + 0.3, '#7c7268', null);
  const flat = rt - top < 0.6;
  prism(g, x0, x1, y0, top, z0, z1, wall, flat ? (H.roof || '#d8d4cc') : null);
  // окна сзади и сбоку: по этажам
  const fl = Math.max(1, Math.round((top - y0) / 3)), fh = (top - y0) / fl, on = lit > 0 ? 0.85 + 0.15 * Math.sin(T * 2 + H.x) : 0;
  const win = (pts) => { const q = (o) => pts.map((p) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]]);
    face(g, pts, '#e8dcc8', 0.1, { lw: 1 }); };
  for (let f = 0; f < fl; f++) { const wy = y0 + f * fh + fh * 0.32, wh = Math.min(1.6, fh * 0.42);
    if (cam.z > z1) for (const u of [0.28, 0.72]) { const cx = lerp(x1, x0, u), ww = Math.min(1.5, H.w * 0.2);
      face(g, [[cx + ww / 2 + 0.12, wy - 0.12, z1 + 0.02], [cx - ww / 2 - 0.12, wy - 0.12, z1 + 0.02], [cx - ww / 2 - 0.12, wy + wh + 0.12, z1 + 0.02], [cx + ww / 2 + 0.12, wy + wh + 0.12, z1 + 0.02]], '#e8dcc8', 0.1, { lw: 1 });
      face(g, [[cx + ww / 2, wy, z1 + 0.03], [cx - ww / 2, wy, z1 + 0.03], [cx - ww / 2, wy + wh, z1 + 0.03], [cx + ww / 2, wy + wh, z1 + 0.03]], on > 0 ? mix('#3a4a6a', '#ffcf7a', on) : '#3a4a6a', 0.15, { lw: 1 });
      if (on > 0.2) { const c = proj(cx, wy + wh / 2, z1); if (c[2] > 1 && c[2] < 110) addLight(c[0], c[1], Math.max(14, 2.6 * cam.f / c[2]), '255,190,110', 0.3 * on * (0.4 + ENV.dusk)); } }
    for (const sx of [x0, x1]) { if ((sx === x0) !== (cam.x < x0) || (cam.x >= x0 && cam.x <= x1)) continue; const o = sx === x0 ? -0.02 : 0.02, zc = (z0 + z1) / 2, wd = Math.min(1.4, H.d * 0.25);
      face(g, [[sx + o, wy, zc - wd / 2], [sx + o, wy, zc + wd / 2], [sx + o, wy + wh, zc + wd / 2], [sx + o, wy + wh, zc - wd / 2]], on > 0 ? mix('#3a4a6a', '#ffcf7a', on * 0.8) : '#3a4a6a', 0.1, { lw: 1 }); } }
  // крыша: двускатная вдоль x, вид сзади
  if (!flat) { const oh = 0.5, a = x0 - oh, b = x1 + oh, f = z0 - oh, k = z1 + oh, zm = (z0 + z1) / 2;
    if (cam.y > rt) face(g, [[a, top - 0.15, f], [b, top - 0.15, f], [b, rt, zm], [a, rt, zm]], roof, 0.18);
    if (cam.x < x0) face(g, [[x0, top, z0], [x0, top, z1], [x0, rt, zm]], wall, -0.3);
    if (cam.x > x1) face(g, [[x1, top, z0], [x1, top, z1], [x1, rt, zm]], wall, -0.3);
    face(g, [[a, top - 0.15, k], [b, top - 0.15, k], [b, rt, zm], [a, rt, zm]], roof, -0.1); }
  else face(g, [[x0 - 0.3, top, z1 + 0.3], [x1 + 0.3, top, z1 + 0.3], [x1 + 0.3, top + 0.35, z1 + 0.3], [x0 - 0.3, top + 0.35, z1 + 0.3]], roof, -0.1);
  return { door: [H.x, y0, z0], roofTop: rt, top };
}
function houseFront(g, H, T, a = 1, lit = 0, door = 0) {
  if (a <= 0) return null;
  const k = clamp(a), pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.22 * (1 - k * 0.6) - (1 - k) * (1 - k) * 1.0 : 1;  // вырастает с перелётом
  const sq = k < 1 ? 1 + 0.12 * Math.sin(k * Math.PI) : 1;
  const hm = Math.max(0.02, pop), wm = 1 / Math.sqrt(sq);
  const w = H.w * wm, d = H.d, x0 = H.x - w / 2, x1 = H.x + w / 2, z0 = H.z, z1 = H.z + d;
  const base = ground(z1), fb = ground(z0);   // фундамент на склоне
  const hh = H.h * hm;
  { const y0q = base + 0.3, pc = proj(H.x, y0q + hh * 0.5, z0); if (pc[2] < 1) return null; LZ = pc[2];
    if (pc[2] > LOD && k >= 1) return houseFar(g, H, x0, x1, y0q, y0q + hh, z0, z1, pc, lit);
    if (NEW[H.type]) return NEW[H.type](g, H, { k, hm, w, d, x0, x1, z0, z1, y0: y0q, hh, top: y0q + hh, fb, base }, T, lit, door); }
  // одна жёсткая тень (солнце справа-сзади)
  if (k > 0.3) { const sh = hh * 0.55, pts = [[x1, z1], [x1, z0], [x0, z0], [x0 - sh * 0.9, z0 - sh * 0.5], [x1 - sh * 0.9, z0 - sh * 0.5]].map((q) => proj(q[0], ground(q[1]) + 0.03, q[1])); if (pts.every((q) => q[2] > 0.6)) { g.fillStyle = 'rgba(58,30,80,0.42)'; g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.fill(); } }
  // фундамент из камня
  box(g, x0 - 0.3, x1 + 0.3, fb - 0.1, base + 0.3, z0 - 0.3, z1 + 0.3, '#7c7268', { top: false });
  const y0 = base + 0.3, top = y0 + hh;
  let roofTop = top, chim = null, sign = { y: y0 + 2.6, w: Math.min(w * 0.82, 5.6), h: 0.95 };
  const t = H.type;
  if (t === 'cottage') {
    box(g, x0, x1, y0, top, z0, z1, H.wall);
    for (let i = 1; i < 6; i++) { const a2 = proj(x0, y0 + i * hh / 6, z0 - 0.02), b2 = proj(x1, y0 + i * hh / 6, z0 - 0.02); g.strokeStyle = 'rgba(70,40,25,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(b2[0], b2[1]); g.stroke(); }
    gableZ(g, x0, x1, top, z0, z1, 3.0 * hm, H.roof, H.wall); roofTop = top + 3 * hm; chim = [x1 - 1.4, top + 2.2 * hm, z0 + 4];
    if (k >= 1) { box(g, x1 - 1.9, x1 - 0.9, top + 0.5, top + 3.1, z0 + 3.5, z0 + 4.5, '#7a4a3a'); }
    windowAt(g, x0 + 0.8, y0 + 1.1, 1.4, 1.4, z0, lit, T, 1); windowAt(g, x1 - 2.2, y0 + 1.1, 1.4, 1.4, z0, lit, T, 2);
    sign.y = top - 0.05 + 0.5; sign.w = w * 0.6;
    // крыльцо
    box(g, H.x - 1.6, H.x + 1.6, fb - 0.1, y0 + 0.2, z0 - 1.6, z0, '#8a5a3a');
  } else if (t === 'modern') {
    box(g, x0, x1, y0, top, z0, z1, H.wall, { topCol: '#d8d4cc' });
    onFront(g, x0 + 0.5, y0 + 0.4, w * 0.62, hh * 0.78, z0, H.trim, 0);
    windowAt(g, x0 + 0.7, y0 + 0.6, w * 0.58, hh * 0.72, z0, lit, T, 3);
    for (let i = 0; i < 7; i++) onFront(g, x0 + w * 0.7 + i * 0.32, y0 + 0.4, 0.16, hh * 0.86, z0 - 0.01, H.accent, 0);
    box(g, x0 - 0.5, x1 + 0.5, top, top + 0.35, z0 - 0.5, z1 + 0.3, H.roof); roofTop = top + 0.35;
    sign.y = top - 1.25; sign.w = w * 0.62;
  } else if (t === 'japanese') {
    box(g, x0, x1, y0, top, z0, z1, H.wall);
    for (const u of [0, 0.33, 0.66, 1]) onFront(g, lerp(x0, x1, u) - 0.12, y0, 0.24, hh, z0 - 0.01, H.trim, -0.1);
    onFront(g, x0, y0 + hh * 0.48, w, 0.18, z0 - 0.01, H.trim, -0.1);
    windowAt(g, x0 + 0.5, y0 + 0.5, 1.6, 1.7, z0, lit, T, 4); windowAt(g, x1 - 2.1, y0 + 0.5, 1.6, 1.7, z0, lit, T, 5);
    hip(g, x0, x1, top, z0, z1, 2.6 * hm, H.roof); roofTop = top + 2.6 * hm;
    sign.y = y0 + hh * 0.6; sign.w = w * 0.62;
    // фонарь
    if (k >= 1) { const lp = proj(x1 + 1.1, y0 + 1.6, z0 - 0.8); const s = cam.f / lp[2]; g.fillStyle = '#c0392b'; g.beginPath(); g.ellipse(lp[0], lp[1], 0.35 * s, 0.5 * s, 0, 0, 7); g.fill(); if (lit > 0) { const gl = g.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], 1.6 * s); gl.addColorStop(0, `rgba(255,150,90,${0.5 * lit})`); gl.addColorStop(1, 'rgba(255,150,90,0)'); g.fillStyle = gl; g.fillRect(lp[0] - 2 * s, lp[1] - 2 * s, 4 * s, 4 * s); } }
  } else if (t === 'tower') {
    box(g, x0, x1, y0, top, z0, z1, H.wall);
    for (let f = 0; f < 3; f++) windowAt(g, H.x - 0.8, y0 + 0.8 + f * hh / 3, 1.6, 1.5, z0, lit, T, 6 + f);
    box(g, x0 - 0.8, x1 + 0.8, y0 + hh * 0.62, y0 + hh * 0.62 + 0.2, z0 - 1.2, z0, H.trim);   // балкон
    for (let i = 0; i <= 6; i++) { const xx = lerp(x0 - 0.8, x1 + 0.8, i / 6), a2 = proj(xx, y0 + hh * 0.62 + 0.2, z0 - 1.2), b2 = proj(xx, y0 + hh * 0.62 + 1.1, z0 - 1.2); g.strokeStyle = '#2a2230'; g.lineWidth = Math.max(1, 0.06 * cam.f / a2[2]); g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(b2[0], b2[1]); g.stroke(); }
    gableX(g, x0, x1, top, z0, z1, 2.2 * hm, H.roof, 0.6); roofTop = top + 2.2 * hm;
    if (k >= 1) { const a2 = proj(H.x + 1, roofTop - 0.6, z0 + 3), b2 = proj(H.x + 1, roofTop + 2.5, z0 + 3); g.strokeStyle = '#2a2230'; g.lineWidth = 2; g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(b2[0], b2[1]); g.stroke(); g.fillStyle = H.accent; g.beginPath(); g.arc(b2[0], b2[1], 3 + 0.5 * Math.sin(T * 4), 0, 7); g.fill(); }
    sign.y = y0 + 2.4 + 0; sign.w = w * 0.95; sign.y = y0 + hh * 0.33 + 1.6;
  } else if (t === 'workshop') {
    box(g, x0, x1, y0, top, z0, z1, H.wall);
    for (let i = 1; i < 8; i++) { const a2 = proj(x0, y0 + i * hh / 8, z0 - 0.02), b2 = proj(x1, y0 + i * hh / 8, z0 - 0.02); g.strokeStyle = 'rgba(60,25,15,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a2[0], a2[1]); g.lineTo(b2[0], b2[1]); g.stroke(); }
    onFront(g, x0 + 0.6, y0, w * 0.48, hh * 0.58, z0, '#5c636b', -0.05);   // ворота гаража
    for (let i = 1; i < 6; i++) onFront(g, x0 + 0.6, y0 + i * hh * 0.58 / 6, w * 0.48, 0.06, z0 - 0.01, '#3b4046', 0);
    windowAt(g, x1 - 2.6, y0 + 1.2, 1.8, 1.5, z0, lit, T, 9);
    for (let s2 = 0; s2 < 3; s2++) { const zz0 = z0 + s2 * d / 3, zz1 = zz0 + d / 3; face(g, [[x0 - 0.3, top, zz0], [x1 + 0.3, top, zz0], [x1 + 0.3, top + 1.6 * hm, zz1 - 0.2], [x0 - 0.3, top + 1.6 * hm, zz1 - 0.2]], H.roof, 0.1); face(g, [[x0 - 0.3, top, zz1], [x1 + 0.3, top, zz1], [x1 + 0.3, top + 1.6 * hm, zz1 - 0.2], [x0 - 0.3, top + 1.6 * hm, zz1 - 0.2]], '#bfe6ea', 0.2); }
    roofTop = top + 1.6 * hm; chim = [x0 + 1.2, top + 1.2, z0 + 5];
    sign.y = top - 1.3; sign.w = w * 0.7;
    if (lit > 0) { const c = proj(x1 - 1.7, top - 0.5, z0 - 0.1); g.fillStyle = `rgba(79,195,200,${0.8 * lit})`; g.font = `900 ${Math.max(8, 0.7 * cam.f / c[2])}px "Rubik"`; g.textAlign = 'center'; }
  } else if (t === 'garden') {
    const mid = y0 + hh * 0.5;
    box(g, x0, x1, y0, top, z0, z1, H.wall);
    windowAt(g, x0 + 0.7, y0 + 0.8, 1.5, 1.5, z0, lit, T, 10); windowAt(g, x1 - 2.2, y0 + 0.8, 1.5, 1.5, z0, lit, T, 11);
    windowAt(g, x0 + 0.7, mid + 0.7, 1.5, 1.5, z0, lit, T, 12); windowAt(g, x1 - 2.2, mid + 0.7, 1.5, 1.5, z0, lit, T, 13);
    box(g, x0 - 0.4, x1 + 0.4, mid, mid + 0.18, z0 - 1.3, z0, H.trim);
    box(g, x0 - 0.3, x1 + 0.3, top, top + 0.25, z0 - 0.3, z1 + 0.3, '#6a5a4a', { topCol: H.roof });
    roofTop = top + 0.25;
    // сад на крыше: кусты
    for (let i = 0; i < 5; i++) { const p = proj(lerp(x0 + 0.6, x1 - 0.6, i / 4), top + 0.5, z0 + 1.5 + (i % 2) * 2.5); const s = cam.f / p[2]; g.fillStyle = i % 2 ? '#6f8f4e' : '#88a85a'; g.beginPath(); g.ellipse(p[0], p[1], 0.8 * s * hm, 0.55 * s * hm, 0, 0, 7); g.fill(); g.fillStyle = H.accent; g.beginPath(); g.arc(p[0] + 0.2 * s, p[1] - 0.2 * s, 0.12 * s, 0, 7); g.fill(); }
    // вьюнок
    for (let i = 0; i < 8; i++) { const p = proj(x0 + 0.15, y0 + i * hh / 8, z0 - 0.05); const s = cam.f / p[2]; g.fillStyle = '#5e7f45'; g.beginPath(); g.arc(p[0] + Math.sin(i) * 0.2 * s, p[1], 0.32 * s * hm, 0, 7); g.fill(); }
    sign.y = mid - 1.15; sign.w = w * 0.62;
  }
  // дверь
  const dw = 1.2, dh = 2.1, dx = t === 'modern' ? x1 - 1.9 : (t === 'workshop' ? x1 - 2.6 + 0.3 : H.x - dw / 2), dyy = y0;
  if (t !== 'tower' || true) { onFront(g, dx, dyy, dw, dh, z0, '#2a1c20', 0); if (door < 1) onFront(g, dx + dw * door, dyy, dw * (1 - door), dh, z0 - 0.01, H.trim, 0.05); else if (lit > 0) onFront(g, dx + 0.1, dyy, dw - 0.2, dh - 0.1, z0 - 0.01, '#ffcf7a', 0.2); }
  if (k > 0.85) signBoard(g, H.x, sign.y, sign.w, sign.h, z0, H.nickname, '#f3e6c8');
  if (chim && k >= 1 && lit > 0) smoke(g, chim[0], chim[1] + 0.6, chim[2], T + H.id, lit);
  return { door: [dx + dw / 2, dyy, z0], roofTop, top };
}

// ---------- человечек (8 голов), машет ----------
export function resident(g, x, z, y, T, wave, col, hair, seed, face = 1) {
  const b = proj(x, y, z); if (b[2] < 1) return; const s = cam.f / b[2], hh = 2.4 * s, hd = hh / 8;
  const X = b[0], Y = b[1]; g.lineCap = 'round'; g.lineJoin = 'round';
  const leg = (dx) => { g.strokeStyle = '#2f3550'; g.lineWidth = hd * 0.75; g.beginPath(); g.moveTo(X + dx, Y - hh * 0.5); g.lineTo(X + dx, Y - hd * 0.3); g.stroke(); g.fillStyle = '#2a1c20'; g.beginPath(); g.ellipse(X + dx, Y - hd * 0.15, hd * 0.4, hd * 0.2, 0, 0, 7); g.fill(); };
  leg(-hd * 0.4); leg(hd * 0.4);
  g.fillStyle = col; g.beginPath(); g.moveTo(X - hd * 0.95, Y - hh * 0.8); g.lineTo(X + hd * 0.95, Y - hh * 0.8); g.lineTo(X + hd * 0.8, Y - hh * 0.47); g.lineTo(X - hd * 0.8, Y - hh * 0.47); g.closePath(); g.fill();
  const sh = [X + hd * 0.85, Y - hh * 0.78];
  g.strokeStyle = '#f0c8a0'; g.lineWidth = hd * 0.45;
  g.beginPath(); g.moveTo(X - hd * 0.85, Y - hh * 0.78); g.lineTo(X - hd * 1.0, Y - hh * 0.5); g.stroke();   // левая рука вниз
  const ang = -2.4 + (wave ? Math.sin(T * 9 + seed) * 0.45 : 1.9); const el = [sh[0] + Math.cos(-1.2) * hd * 1.3, sh[1] + Math.sin(-1.2) * hd * 1.3 * (wave ? 1 : -1)];
  if (wave) { g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(el[0], el[1]); g.lineTo(el[0] + Math.cos(ang + 0.6) * hd * 1.2, el[1] + Math.sin(ang + 0.6) * hd * 1.2); g.stroke(); g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(el[0] + Math.cos(ang + 0.6) * hd * 1.35, el[1] + Math.sin(ang + 0.6) * hd * 1.35, hd * 0.32, 0, 7); g.fill(); }
  else { g.beginPath(); g.moveTo(sh[0], sh[1]); g.lineTo(X + hd * 1.0, Y - hh * 0.5); g.stroke(); }
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(X, Y - hh + hd * 0.5, hd * 0.52, 0, 7); g.fill();
  g.fillStyle = hair; g.beginPath(); g.arc(X, Y - hh + hd * 0.38, hd * 0.55, Math.PI, 0); g.fill();
  if (s > 18) { g.fillStyle = '#1a1420'; g.beginPath(); g.arc(X - hd * 0.18, Y - hh + hd * 0.55, hd * 0.07, 0, 7); g.arc(X + hd * 0.18, Y - hh + hd * 0.55, hd * 0.07, 0, 7); g.fill(); }
}

export { ruin, RUINS };

// ---------- выпуск 2: дальние дома (LOD) ----------
let LOD = 150; export function setLOD(v) { LOD = v; }
function houseFar(g, H, x0, x1, y0, top, z0, z1, pc, lit) {
  if (pc[2] > 650) { const r = Math.max(1.2, 900 / pc[2]); g.fillStyle = H.status === 'dark' ? '#2a2438' : (lit > 0 ? '#ffc878' : '#8a7a90'); g.fillRect(pc[0] - r, pc[1] - r * 0.6, r * 2, r * 1.2);  return { door: [H.x, y0, z0], roofTop: top, top }; }
  const t = H.type, tall = t === 'tower' ? 1 : 0;
  if (cam.x < x0) face(g, [[x0, y0, z0], [x0, y0, z1], [x0, top, z1], [x0, top, z0]], H.wall, -0.28, { lw: 0.8 });
  if (cam.x > x1) face(g, [[x1, y0, z0], [x1, y0, z1], [x1, top, z1], [x1, top, z0]], H.wall, -0.28, { lw: 0.8 });
  face(g, [[x0, y0, z0], [x1, y0, z0], [x1, top, z0], [x0, top, z0]], H.wall, 0.05, { lw: 0.8 });
  const rh = (t === 'modern' || t === 'garden' || t === 'workshop') ? 0.4 : 2.4, zm = (z0 + z1) / 2;
  if (rh > 1) face(g, [[x0 - 0.4, top, z0 - 0.4], [x1 + 0.4, top, z0 - 0.4], [x1 + 0.4, top + rh, zm], [x0 - 0.4, top + rh, zm]], H.roof, 0.15, { lw: 0.8 });
  else if (cam.y > top) face(g, [[x0, top, z0], [x1, top, z0], [x1, top, z1], [x0, top, z1]], H.roof, 0.12, { lw: 0.8 });
  const on = H.status === 'dark' ? 0 : lit; const wq = P([[H.x - 1.2, y0 + 1.2, z0 - 0.02], [H.x + 1.2, y0 + 1.2, z0 - 0.02], [H.x + 1.2, y0 + 2.4, z0 - 0.02], [H.x - 1.2, y0 + 2.4, z0 - 0.02]]);
  poly(g, wq, on > 0 ? '#ffcf7a' : '#3a4a6a'); 
  return { door: [H.x, y0, z0], roofTop: top + rh, top };
}
// ---------- выпуск 2: новые типы домов ----------
function sc(c) { return { b: c, s: cam.f / c[2] }; }
function yurt(g, H, q, T, lit) {
  const c = proj(H.x, q.y0, q.z0 + 3), s = cam.f / c[2], r = 3.6 * s * (1 / Math.sqrt(1 + 0.12 * Math.sin(q.k * Math.PI))), wh = 2.6 * s * q.hm, dh = 2.2 * s * q.hm;
  g.lineWidth = Math.max(1.2, 0.08 * s); g.strokeStyle = '#5a2266';
  g.fillStyle = '#efe6d6'; g.beginPath(); g.ellipse(c[0], c[1], r, r * 0.32, 0, 0, Math.PI); g.lineTo(c[0] - r, c[1] - wh); g.ellipse(c[0], c[1] - wh, r, r * 0.32, 0, Math.PI, 0, true); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#c0392b'; g.fillRect(c[0] - r, c[1] - wh * 0.62, r * 2, wh * 0.16);
  g.fillStyle = '#d8cbb4'; g.beginPath(); g.moveTo(c[0] - r * 1.04, c[1] - wh); g.quadraticCurveTo(c[0], c[1] - wh - dh * 1.5, c[0] + r * 1.04, c[1] - wh); g.closePath(); g.fill(); g.stroke();
  for (let i = -3; i <= 3; i++) { g.strokeStyle = 'rgba(120,60,40,0.6)'; g.beginPath(); g.moveTo(c[0] + i * r * 0.3, c[1] - wh); g.lineTo(c[0] + i * r * 0.06, c[1] - wh - dh * 0.72); g.stroke(); }
  g.fillStyle = '#c0392b'; g.beginPath(); g.ellipse(c[0], c[1] - wh - dh * 0.72, r * 0.18, r * 0.06, 0, 0, 7); g.fill();
  g.fillStyle = lit > 0 ? '#ffcf7a' : '#7a4a2a'; g.fillRect(c[0] - 0.55 * s, c[1] - 1.9 * s, 1.1 * s, 1.9 * s); g.strokeStyle = '#5a2266'; g.strokeRect(c[0] - 0.55 * s, c[1] - 1.9 * s, 1.1 * s, 1.9 * s);
  if (lit > 0) addLight(c[0], c[1] - s, 3 * s, '255,190,110', 0.3 * lit);
  if (q.k > 0.85) signBoard(g, H.x, q.y0 + 2.3, 4.6, 0.85, q.z0 - 0.5, H.nickname, '#f3e6c8');
  return { door: [H.x, q.y0, q.z0], roofTop: q.y0 + 4.8, top: q.y0 + 2.6 };
}
const FRUIT = { apple: { col: '#d8433a', top: 'leaf' }, watermelon: { col: '#3f8a3a', stripe: '#1f5a2a', wide: 1.1 }, tomato: { col: '#e0503a', top: 'star', wide: 1.12 }, strawberry: { col: '#e0405a', seeds: '#f6e08a' }, lemon: { col: '#f2d23a', wide: 1.2, top: 'leaf' }, mushroom: { col: '#d8433a' }, burger: { col: '#e0a050' }, inferno: { col: '#d8401c', wide: 1.15 } };
function blob(g, H, q, T, lit, kind) {   // огурец / ананас / хижина — объёмные формы в экранных координатах
  const c = proj(H.x, q.y0, q.z0 + 3), s = cam.f / c[2], hh = (kind === 'cucumber' ? 10 : kind === 'pineapple' ? 7.5 : FRUIT[kind] ? 7.8 : 4.2) * s * q.hm, ww = (kind === 'cucumber' ? 5.2 : kind === 'pineapple' ? 6.6 : FRUIT[kind] ? 7.4 : 6.4) * s;
  g.lineWidth = Math.max(1.2, 0.08 * s); g.strokeStyle = '#3a1a3a';
  if (kind === 'cucumber') { g.fillStyle = '#4f8a3a'; g.beginPath(); g.roundRect(c[0] - ww / 2, c[1] - hh, ww, hh, ww / 2); g.fill(); g.stroke(); g.fillStyle = '#7fb85a'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(c[0] + Math.sin(i * 2.3) * ww * 0.32, c[1] - hh * (0.1 + 0.8 * ((i * 0.37) % 1)), 0.18 * s, 0, 7); g.fill(); } g.fillStyle = '#3f6a2e'; g.fillRect(c[0] - ww * 0.06, c[1] - hh - 0.5 * s, ww * 0.12, 0.6 * s); }
  else if (kind === 'pineapple') { g.fillStyle = '#e8a83a'; g.beginPath(); g.ellipse(c[0], c[1] - hh / 2, ww / 2, hh / 2, 0, 0, 7); g.fill(); g.stroke(); g.save(); g.clip(); g.strokeStyle = 'rgba(140,80,20,0.7)'; for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(c[0] + i * 0.9 * s - hh, c[1]); g.lineTo(c[0] + i * 0.9 * s + hh, c[1] - hh); g.stroke(); g.beginPath(); g.moveTo(c[0] + i * 0.9 * s + hh, c[1]); g.lineTo(c[0] + i * 0.9 * s - hh, c[1] - hh); g.stroke(); } g.restore();
    g.fillStyle = '#4f8a3a'; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(c[0] + i * 0.35 * s, c[1] - hh * 0.95); g.quadraticCurveTo(c[0] + i * 0.9 * s, c[1] - hh - 1.4 * s, c[0] + i * 1.1 * s, c[1] - hh - (2.6 - Math.abs(i) * 0.4) * s); g.lineTo(c[0] + i * 0.15 * s, c[1] - hh * 0.92); g.fill(); g.stroke(); } }
  else if (FRUIT[kind]) { const F = FRUIT[kind];
    if (kind === 'burger') { const L = (y, h, col, r) => { g.fillStyle = col; g.beginPath(); g.roundRect(c[0] - ww * 0.56, c[1] - hh * y - hh * h, ww * 1.12, hh * h, r * s); g.fill(); g.stroke(); };
      L(0, 0.22, '#d89a4a', 0.9); L(0.22, 0.17, '#6a3a1e', 0.6);
      g.fillStyle = '#f6c63a'; g.beginPath(); g.moveTo(c[0] - ww * 0.58, c[1] - hh * 0.41); for (let i = 0; i <= 8; i++) { const x = c[0] - ww * 0.58 + ww * 1.16 * i / 8; g.lineTo(x, c[1] - hh * 0.41); g.lineTo(x + ww * 0.07, c[1] - hh * (i % 2 ? 0.33 : 0.36)); } g.lineTo(c[0] + ww * 0.58, c[1] - hh * 0.41); g.lineTo(c[0] + ww * 0.58, c[1] - hh * 0.45); g.lineTo(c[0] - ww * 0.58, c[1] - hh * 0.45); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#5fb84a'; g.beginPath(); g.moveTo(c[0] - ww * 0.6, c[1] - hh * 0.45); for (let i = 0; i <= 12; i++) g.quadraticCurveTo(c[0] - ww * 0.6 + ww * 1.2 * (i - 0.5) / 12, c[1] - hh * (i % 2 ? 0.43 : 0.47), c[0] - ww * 0.6 + ww * 1.2 * i / 12, c[1] - hh * 0.45); g.lineTo(c[0] + ww * 0.6, c[1] - hh * 0.51); g.lineTo(c[0] - ww * 0.6, c[1] - hh * 0.51); g.closePath(); g.fill(); g.stroke();
      L(0.51, 0.06, '#e0503a', 0.3);
      g.fillStyle = F.col; g.beginPath(); g.ellipse(c[0], c[1] - hh * 0.57, ww * 0.58, hh * 0.43, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff4d0'; for (let i = 0; i < 14; i++) { const ang = Math.PI + (0.15 + 0.7 * H01(i * 5.3)) * Math.PI, rr = 0.3 + 0.55 * H01(i * 9.1); g.beginPath(); g.ellipse(c[0] + Math.cos(ang) * ww * 0.5 * rr, c[1] - hh * 0.57 + Math.sin(ang) * hh * 0.38 * rr, 0.22 * s, 0.12 * s, ang, 0, 7); g.fill(); } }
    else if (kind === 'inferno') { g.fillStyle = '#c8341a'; g.beginPath(); g.ellipse(c[0], c[1] - hh * 0.5, ww * 0.6, hh * 0.52, 0, 0, 7); g.fill(); g.stroke();
      const fl = ['#ffd23f', '#ff8a1c', '#ff5a1c']; for (let i = 0; i < 7; i++) { const fx = c[0] - ww * 0.45 + ww * 0.9 * i / 6, fh = hh * (0.32 + 0.12 * Math.sin(T * 6 + i * 1.7)); g.fillStyle = fl[i % 3]; g.beginPath(); g.moveTo(fx - ww * 0.09, c[1] - hh * 0.62); g.quadraticCurveTo(fx - ww * 0.02, c[1] - hh * 0.62 - fh * 0.6, fx, c[1] - hh * 0.62 - fh); g.quadraticCurveTo(fx + ww * 0.02, c[1] - hh * 0.62 - fh * 0.6, fx + ww * 0.09, c[1] - hh * 0.62); g.closePath(); g.fill(); }
      g.fillStyle = '#1a1214'; g.beginPath(); g.ellipse(c[0], c[1] - hh * 0.6, ww * 0.5, hh * 0.13, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,160,60,0.85)'; g.beginPath(); g.ellipse(c[0] - ww * 0.2, c[1] - hh * 0.62, ww * 0.12, hh * 0.035, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(c[0] + ww * 0.2, c[1] - hh * 0.62, ww * 0.12, hh * 0.035, 0, 0, 7); g.fill(); }
    else if (kind === 'mushroom') { g.fillStyle = '#f2ead8'; g.beginPath(); g.roundRect(c[0] - ww * 0.3, c[1] - hh * 0.62, ww * 0.6, hh * 0.62, 0.4 * s); g.fill(); g.stroke();
      g.fillStyle = F.col; g.beginPath(); g.ellipse(c[0], c[1] - hh * 0.6, ww * 0.62, hh * 0.45, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff6e4'; for (const [dx, dy, r] of [[-0.3, 0.75, 0.5], [0.15, 0.85, 0.42], [0.38, 0.68, 0.35], [-0.05, 0.68, 0.3]]) { g.beginPath(); g.arc(c[0] + dx * ww, c[1] - hh * dy, r * s, 0, 7); g.fill(); } }
    else { g.fillStyle = F.col; g.beginPath(); if (kind === 'strawberry') { g.moveTo(c[0], c[1]); g.bezierCurveTo(c[0] - ww * 0.75, c[1] - hh * 0.4, c[0] - ww * 0.6, c[1] - hh, c[0], c[1] - hh * 0.95); g.bezierCurveTo(c[0] + ww * 0.6, c[1] - hh, c[0] + ww * 0.75, c[1] - hh * 0.4, c[0], c[1]); } else g.ellipse(c[0], c[1] - hh / 2, ww / 2 * (F.wide || 1), hh / 2, 0, 0, 7); g.fill(); g.stroke();
      g.save(); g.clip(); if (F.stripe) { g.strokeStyle = F.stripe; g.lineWidth = 0.7 * s; for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(c[0], c[1] - hh / 2, Math.abs(i) * ww * 0.15 + 0.1, hh / 2, 0, 0, 7); g.stroke(); } }
      if (F.seeds) { g.fillStyle = F.seeds; for (let i = 0; i < 22; i++) { g.beginPath(); g.ellipse(c[0] + (H01(i * 3.1) - 0.5) * ww * 0.9, c[1] - hh * (0.1 + 0.8 * H01(i * 7.7)), 0.12 * s, 0.2 * s, 0, 0, 7); g.fill(); } }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(c[0] - ww * 0.18, c[1] - hh * 0.7, ww * 0.12, hh * 0.18, -0.4, 0, 7); g.fill(); g.restore(); g.strokeStyle = '#3a1a3a';
      g.fillStyle = '#4f8a3a'; if (F.top === 'star' || kind === 'strawberry') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.moveTo(c[0], c[1] - hh * 0.97); g.lineTo(c[0] + Math.cos(a) * 1.4 * s, c[1] - hh * 0.97 + Math.sin(a) * 0.5 * s - 0.2 * s); g.lineTo(c[0] + Math.cos(a + 0.4) * 0.5 * s, c[1] - hh * 0.97); g.fill(); g.stroke(); } }
      else if (F.top === 'leaf') { g.strokeStyle = '#5a3a2a'; g.lineWidth = 0.3 * s; g.beginPath(); g.moveTo(c[0], c[1] - hh * 0.95); g.lineTo(c[0] + 0.3 * s, c[1] - hh - 1.2 * s); g.stroke(); g.strokeStyle = '#3a1a3a'; g.lineWidth = Math.max(1.2, 0.08 * s); g.beginPath(); g.ellipse(c[0] + 1.1 * s, c[1] - hh - 0.8 * s, 1.0 * s, 0.45 * s, -0.4, 0, 7); g.fill(); g.stroke(); } } }
  else { g.fillStyle = '#9a9088'; g.beginPath(); g.roundRect(c[0] - ww / 2, c[1] - hh, ww, hh, 0.6 * s); g.fill(); g.stroke(); g.strokeStyle = 'rgba(60,50,50,0.5)'; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(c[0] - ww / 2, c[1] - hh * i / 5); g.lineTo(c[0] + ww / 2, c[1] - hh * i / 5); g.stroke(); }
    g.fillStyle = '#8a6a3a'; g.strokeStyle = '#3a1a3a'; g.beginPath(); g.moveTo(c[0] - ww * 0.62, c[1] - hh); g.lineTo(c[0], c[1] - hh - 3.6 * s * q.hm); g.lineTo(c[0] + ww * 0.62, c[1] - hh); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#6a5a4a'; g.fillRect(c[0] + ww * 0.2, c[1] - hh - 2.6 * s, 0.6 * s, 1.6 * s); if (lit > 0) smoke(g, H.x + ww / s * 0.25, q.y0 + 6.2, q.z0 + 3, T, lit); }
  const dw = 1.2 * s, dh = 2.0 * s; g.fillStyle = lit > 0 ? '#ffcf7a' : '#5a3a2a'; g.beginPath(); g.roundRect(c[0] - dw / 2, c[1] - dh, dw, dh, [dw / 2, dw / 2, 0, 0]); g.fill(); g.strokeStyle = '#3a1a3a'; g.stroke();
  const wy = kind === 'hut' ? [0.55] : kind === 'pineapple' ? [0.45, 0.72] : [0.3, 0.55, 0.8];
  for (const f of wy) for (const sd of (kind === 'cucumber' ? [0] : [-1, 1])) { const x = c[0] + sd * ww * 0.25, y = c[1] - hh * f - (kind === 'hut' ? 0 : 0.2 * s); if (f < 0.35 && sd === 0) continue; g.fillStyle = lit > 0 ? '#ffcf7a' : '#3a4a6a'; g.beginPath(); g.arc(x, y, 0.55 * s, 0, 7); g.fill(); g.stroke(); if (lit > 0) addLight(x, y, 2.4 * s, '255,190,110', 0.28 * lit); }
  if (q.k > 0.85) signBoard(g, H.x, q.y0 + 2.4, 4.6, 0.85, q.z0 + 3 - 3.4, H.nickname, '#f3e6c8');
  return { door: [H.x, q.y0, q.z0 + 0.5], roofTop: q.y0 + (kind === 'cucumber' ? 10.5 : kind === 'pineapple' ? 10 : FRUIT[kind] ? 9.4 : 8), top: q.y0 + 4 };
}
function penthouse(g, H, q, T, lit) {
  const { x0, x1, z0, z1, y0 } = q, hh = 9.6 * q.hm, top = y0 + hh;
  box(g, x0, x1, q.fb - 0.1, y0, z0 - 0.3, z1 + 0.3, '#7c7268', { top: false }); box(g, x0, x1, y0, top, z0, z1, '#d9d4cc', { topCol: '#b9b2a8' });
  for (let f = 0; f < 3; f++) for (let i = 0; i < 3; i++) windowAt(g, x0 + 0.7 + i * (q.w - 1.4) / 3, y0 + 0.8 + f * 3.1, (q.w - 2.6) / 3, 1.6, z0, lit, T, f * 3 + i);
  box(g, x0 + 1.5, x1 - 1.0, top, top + 2.4, z0 + 2.5, z1 - 0.5, '#bfe6ea', { topCol: '#2f343b' });
  for (let i = 0; i <= 10; i++) { const xx = lerp(x0, x1, i / 10), a = proj(xx, top, z0), b = proj(xx, top + 1, z0); g.strokeStyle = '#2a2230'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  const rr = P([[x0, top + 1, z0], [x1, top + 1, z0]]); g.beginPath(); g.moveTo(rr[0][0], rr[0][1]); g.lineTo(rr[1][0], rr[1][1]); g.stroke();
  const u = proj(x0 + 1.5, top + 2.6, z0 + 1.2), s = cam.f / u[2]; g.fillStyle = '#e8b04a'; g.beginPath(); g.ellipse(u[0], u[1], 1.6 * s, 0.5 * s, 0, Math.PI, 0); g.fill(); g.strokeStyle = '#2a2230'; g.beginPath(); g.moveTo(u[0], u[1]); g.lineTo(u[0], u[1] + 1.6 * s); g.stroke();
  if (lit > 0) addLight(u[0], u[1] + s, 4 * s, '255,210,140', 0.3 * lit);
  if (q.k > 0.85) signBoard(g, H.x, y0 + 2.5, Math.min(q.w * 0.8, 6), 0.95, z0, H.nickname, '#f3e6c8');
  return { door: [H.x, y0, z0], roofTop: top + 3, top };
}
function mansion(g, H, q, T, lit) {
  const w = 12.5, x0 = H.x - w / 2, x1 = H.x + w / 2, z0 = q.z0, z1 = q.z0 + 8.5, y0 = ground(z1) + 0.3, hh = 7 * q.hm, top = y0 + hh;
  box(g, x0, x1, ground(z0) - 0.1, y0, z0 - 0.3, z1 + 0.3, '#8a8070', { top: false }); box(g, x0, x1, y0, top, z0, z1, '#efe4cc');
  for (let f = 0; f < 2; f++) for (let i = 0; i < 4; i++) windowAt(g, x0 + 0.9 + i * 3, y0 + 1.0 + f * 3.3, 1.5, 1.9, z0, lit, T, 20 + f * 4 + i);
  box(g, H.x - 3.2, H.x + 3.2, top - 0.6, top, z0 - 2.4, z0, '#f5efe0');
  for (const cx of [-2.8, -0.95, 0.95, 2.8]) box(g, H.x + cx - 0.25, H.x + cx + 0.25, y0, top - 0.6, z0 - 2.2, z0 - 1.7, '#fbf7ee');
  hip(g, x0, x1, top, z0, z1, 3.0 * q.hm, '#5a3a3a', 0.6);
  if (q.k > 0.85) signBoard(g, H.x, top - 1.5, 5.4, 0.9, z0 - 2.45, H.nickname, '#f3e6c8');
  return { door: [H.x, y0, z0 - 2], roofTop: top + 3, top };
}
function villa(g, H, q, T, lit) {
  const w = 11.5, x0 = H.x - w / 2, x1 = H.x + w / 2, z0 = q.z0, z1 = q.z0 + 8, y0 = ground(z1) + 0.3, h1 = 3.6 * q.hm, h2 = 3.2 * q.hm;
  box(g, x0, x1, ground(z0) - 0.1, y0, z0 - 0.3, z1 + 0.3, '#c9b89a', { top: false }); box(g, x0, x1, y0, y0 + h1, z0, z1, '#fbf6ec', { topCol: '#e9e2d4' });
  for (let i = 0; i < 4; i++) { const ax = x0 + 1 + i * 2.7; onFront(g, ax, y0, 1.8, 2.6, z0, '#3a4a6a', 0); const a = proj(ax + 0.9, y0 + 2.6, z0 - 0.03), s = cam.f / a[2]; g.fillStyle = lit > 0 ? '#ffcf7a' : '#3a4a6a'; g.beginPath(); g.arc(a[0], a[1], 0.9 * s, Math.PI, 0); g.fill(); }
  box(g, x0 + 2, x1 - 2.5, y0 + h1, y0 + h1 + h2, z0 + 2, z1, '#fbf6ec', { topCol: '#d86a4a' });
  windowAt(g, x0 + 3, y0 + h1 + 0.8, 4.5, 1.7, z0 + 2, lit, T, 31);
  const p = proj(x1 + 2, ground(z0 + 1), z0 + 1), s = cam.f / p[2]; g.strokeStyle = '#7a5a3a'; g.lineWidth = 0.45 * s; g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + 0.8 * s, p[1] - 4 * s, p[0] + 0.4 * s, p[1] - 7 * s); g.stroke();
  g.fillStyle = '#4f8a3a'; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.ellipse(p[0] + 0.4 * s + Math.cos(a) * 1.6 * s, p[1] - 7 * s + Math.sin(a) * 0.5 * s, 1.8 * s, 0.45 * s, a, 0, 7); g.fill(); }
  if (q.k > 0.85) signBoard(g, H.x, y0 + 2.9, 5.6, 0.9, z0, H.nickname, '#f3e6c8');
  return { door: [H.x, y0, z0], roofTop: y0 + h1 + h2, top: y0 + h1 };
}
const NEW = { yurt, penthouse, mansion, villa, cucumber: (g, H, q, T, l) => blob(g, H, q, T, l, 'cucumber'), pineapple: (g, H, q, T, l) => blob(g, H, q, T, l, 'pineapple'), hut: (g, H, q, T, l) => blob(g, H, q, T, l, 'hut') };
for (const k of Object.keys(FRUIT)) NEW[k] = (g, H, q, T, l) => blob(g, H, q, T, l, k);

// пожелания поверх дома: кот, бассейн, баня, почтовый ящик, цветы
export function extras(g, H, inf, T, lit) {
  const S = H.spec || {}; if (!inf) return;
  const near = proj(H.x, ground(H.z), H.z); if (near[2] > 150) return;
  const cat = (x, y, z, sit) => { const p = proj(x, y, z), s = cam.f / p[2]; g.fillStyle = '#e08a3a'; g.strokeStyle = '#3a1a2a'; g.lineWidth = Math.max(1, 0.05 * s);
    g.beginPath(); g.ellipse(p[0], p[1] - 0.3 * s, 0.38 * s, 0.32 * s, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(p[0], p[1] - 0.75 * s, 0.24 * s, 0, 7); g.fill(); g.stroke();
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(p[0] + sd * 0.2 * s, p[1] - 0.88 * s); g.lineTo(p[0] + sd * 0.16 * s, p[1] - 1.12 * s); g.lineTo(p[0] + sd * 0.05 * s, p[1] - 0.95 * s); g.fill(); g.stroke(); }
    g.beginPath(); g.moveTo(p[0] + 0.35 * s, p[1] - 0.2 * s); g.quadraticCurveTo(p[0] + 0.8 * s, p[1] - 0.2 * s + Math.sin(T * 4) * 0.2 * s, p[0] + 0.7 * s, p[1] - 0.7 * s); g.stroke();
    g.fillStyle = '#1a1420'; g.beginPath(); g.arc(p[0] - 0.08 * s, p[1] - 0.78 * s, 0.035 * s, 0, 7); g.arc(p[0] + 0.08 * s, p[1] - 0.78 * s, 0.035 * s, 0, 7); g.fill(); };
  if (S.dog) { const p = proj(inf.door[0] - 1.8, ground(H.z - 1.2), H.z - 1.2), s = cam.f / p[2]; if (p[2] > 1) { g.fillStyle = '#c8924a'; g.strokeStyle = '#3a1a2a'; g.lineWidth = Math.max(1, 0.05 * s);
    g.beginPath(); g.ellipse(p[0], p[1] - 0.55 * s, 0.6 * s, 0.32 * s, 0, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(p[0] - 0.62 * s, p[1] - 0.95 * s, 0.3 * s, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#8a5a2a'; g.beginPath(); g.ellipse(p[0] - 0.82 * s, p[1] - 0.92 * s, 0.1 * s, 0.22 * s, 0.3, 0, 7); g.fill(); g.strokeStyle = '#3a1a2a';
    for (const lx of [-0.4, -0.2, 0.25, 0.45]) { g.beginPath(); g.moveTo(p[0] + lx * s, p[1] - 0.35 * s); g.lineTo(p[0] + lx * s, p[1]); g.stroke(); }
    g.beginPath(); g.moveTo(p[0] + 0.55 * s, p[1] - 0.6 * s); g.lineTo(p[0] + 0.85 * s, p[1] - 0.95 * s + Math.sin(T * 8) * 0.1 * s); g.stroke(); } }
  if (S.cat === 'porch') cat(inf.door[0] + 1.4, ground(H.z - 0.8), H.z - 0.8);
  if (S.cat === 'roof') cat(H.x + 1, inf.roofTop + 0.1, H.z + 2);
  // бассейн и машина по заказу рисуются во дворе (lotGround / yardPart)
  // баня рисуется в заднем дворе (yardPart)
  if (S.mailbox) { const mx = H.x - H.w / 2 - 1.2, mz = H.z - 1.2, y = ground(mz); const a = proj(mx, y, mz), b = proj(mx, y + 1.1, mz), s = cam.f / a[2]; g.strokeStyle = '#3a2a20'; g.lineWidth = 0.12 * s; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.fillStyle = '#2f6f9f'; g.beginPath(); g.roundRect(b[0] - 0.45 * s, b[1] - 0.5 * s, 0.9 * s, 0.55 * s, 0.2 * s); g.fill(); g.strokeStyle = '#1e1628'; g.lineWidth = 2; g.stroke();
    const fs = Math.max(11, 0.42 * s); g.font = `900 ${fs}px "Rubik"`; const tw = g.measureText(S.mailbox).width; g.fillStyle = '#fff6e4'; g.fillRect(b[0] - tw / 2 - 6, b[1] - 0.5 * s - fs - 8, tw + 12, fs + 6); g.fillStyle = '#1e1628'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.mailbox, b[0], b[1] - 0.5 * s - fs / 2 - 5); }
  if (S.flowers) for (let i = 0; i < 12; i++) { const p = proj(H.x - H.w / 2 + i * H.w / 11, ground(H.z - 0.6) + 0.3, H.z - 0.6), s = cam.f / p[2]; g.fillStyle = ['#e85a8a', '#f0c040', '#ffffff', '#d86ad8'][i % 4]; g.beginPath(); g.arc(p[0], p[1], 0.22 * s, 0, 7); g.fill(); }

  // ---------- жизнь во дворе ----------
  { const R = (m) => H01(H.id * m + 0.37), dr = inf.door, L = H.lvl || 1, lot = H.lot;
    if (lot && R(2.9) < 0.38 && !(S.car || L >= 3)) { const [lx0, lz0, lx1] = lot, xa = lx1 - 3.6, xb = lx1 - 1.0, za = H.z - 4.8, zb = H.z - 3.0, y0 = ground(za);
      box(g, xa, xb, y0, y0 + 0.55, za, zb, '#b87a3e'); box(g, xa + 0.1, xb - 0.1, y0 + 0.55, y0 + 0.72, za + 0.1, zb - 0.1, '#d8433a'); box(g, (xa + xb) / 2 - 0.5, (xa + xb) / 2 + 0.5, y0 + 0.72, y0 + 0.98, (za + zb) / 2 - 0.4, (za + zb) / 2 + 0.4, '#8a5a2e');
      const tp = proj((xa + xb) / 2, y0 + 1.05, (za + zb) / 2); if (tp[2] > 1) { const s = cam.f / tp[2]; g.fillStyle = '#f4f0e8'; g.beginPath(); g.ellipse(tp[0] - 0.2 * s, tp[1], 0.16 * s, 0.1 * s, 0, 0, 7); g.fill(); g.fillStyle = '#e0a040'; g.beginPath(); g.ellipse(tp[0] + 0.22 * s, tp[1], 0.2 * s, 0.11 * s, 0, 0, 7); g.fill(); } }
    if (lot && R(3.7) < 0.3) { const [lx0] = lot, xa = lx0 + 0.7, xb = lx0 + 3.6, z = H.z - 3.8, y0 = ground(z), A = proj(xa, y0, z), B = proj(xb, y0, z), A2 = proj(xa, y0 + 1.9, z), B2 = proj(xb, y0 + 1.9, z);
      if (A[2] > 1 && B[2] > 1) { const s = cam.f / A[2]; g.strokeStyle = '#6a4a2e'; g.lineWidth = Math.max(1.5, 0.09 * s); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(A2[0], A2[1]); g.moveTo(B[0], B[1]); g.lineTo(B2[0], B2[1]); g.stroke();
        g.strokeStyle = '#e8e0d0'; g.lineWidth = Math.max(1, 0.03 * s); g.beginPath(); g.moveTo(A2[0], A2[1]); g.quadraticCurveTo((A2[0] + B2[0]) / 2, (A2[1] + B2[1]) / 2 + 0.25 * s, B2[0], B2[1]); g.stroke();
        const cl = ['#e85a8a', '#4a9ae0', '#f0c040', '#5ac08a', '#ffffff']; for (let j = 0; j < 4; j++) { const f = (j + 0.8) / 5, x = lerp(A2[0], B2[0], f), y = lerp(A2[1], B2[1], f) + Math.sin(f * Math.PI) * 0.22 * s, sw = Math.sin(T * 2.2 + j + H.id) * 0.06 * s; g.fillStyle = cl[(j + H.id) % 5]; g.save(); g.translate(x, y); g.rotate(sw / s); g.fillRect(-0.24 * s, 0, 0.48 * s, (0.5 + 0.2 * (j % 2)) * s); g.restore(); } } }
    if (!S.cat && R(4.3) < 0.22) cat(dr[0] + 1.4, ground(H.z - 0.9), H.z - 0.9);
    if (R(3.1) < 0.5) { const cols = ['#e85a5a', '#4a9ae0', '#f0b030', '#5ac08a', '#d86ad8', '#ff8a4a'], hairs = ['#2a1a10', '#5a3a20', '#1a1a1a', '#8a5a30'];
      const rz = H.z - 1.4 - R(7.7) * 1.8; resident(g, dr[0] + (R(6.1) < 0.5 ? -1.7 : 1.7), rz, ground(rz), T, R(5.7) < 0.55, cols[Math.floor(R(8.3) * 6)], hairs[Math.floor(R(9.1) * 4)], H.id); } }
}
// ---------- дачи у озера ----------
export const LAKE = { x: -640, z: 140, rx: 110, rz: 70 };
export function lake(g, T, bugs = 0) {
  const pts = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; const x = LAKE.x + Math.cos(a) * LAKE.rx * (1 + 0.08 * Math.sin(a * 3)), z = LAKE.z + Math.sin(a) * LAKE.rz; pts.push(proj(x, ground(LAKE.z) + 0.05, z)); }
  if (pts.some((p) => p[2] < 1)) return; poly(g, pts, '#2c3f6a', '#1e1628', 2);
  const m = proj(LAKE.x + 30, ground(LAKE.z) + 0.06, LAKE.z + 40); g.fillStyle = 'rgba(255,230,180,0.35)'; g.beginPath(); g.ellipse(m[0], m[1], 60, 6, 0, 0, 7); g.fill();
  for (let i = 0; i < 8; i++) { const p = proj(LAKE.x - 60 + i * 15 + Math.sin(T + i) * 3, ground(LAKE.z) + 0.07, LAKE.z - 20 + (i % 3) * 18); g.strokeStyle = 'rgba(200,220,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p[0] - 14, p[1]); g.lineTo(p[0] + 14, p[1]); g.stroke(); }
  // лодка
  const b = proj(LAKE.x + 20 + Math.sin(T * 0.6) * 2, ground(LAKE.z) + 0.1, LAKE.z - 45), s = cam.f / b[2]; g.fillStyle = '#8a5a3a'; g.beginPath(); g.moveTo(b[0] - 2.2 * s, b[1] - 0.4 * s); g.lineTo(b[0] + 2.2 * s, b[1] - 0.4 * s); g.lineTo(b[0] + 1.5 * s, b[1] + 0.2 * s); g.lineTo(b[0] - 1.5 * s, b[1] + 0.2 * s); g.closePath(); g.fill(); g.strokeStyle = '#1e1628'; g.lineWidth = 2; g.stroke();
}
export const DACHAS = [0, 1, 2].map((i) => ({ id: 9000 + i, nickname: '', type: 'cottage', x: LAKE.x - 21 + i * 11, z: LAKE.z - LAKE.rz - 20 + (i % 2) * 3, w: 5.2, d: 5, h: 3.0, wall: ['#9a8a7a', '#8a7a6a', '#a89a88'][i], trim: '#4a3a2a', roof: ['#5a4a5a', '#4a5a5a', '#6a4a3a'][i], accent: '#c0392b', status: 'dark', spec: {} }));
export function mosquitoes(g, cx, cy, n, T) { g.fillStyle = '#1e1628'; for (let i = 0; i < n; i++) { const x = cx + Math.sin(T * (5 + i % 3) + i * 1.7) * (30 + i * 3), y = cy + Math.cos(T * (6 + i % 4) + i) * (18 + i * 2); g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); g.strokeStyle = 'rgba(30,22,40,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 4, y - 2 + Math.sin(T * 40 + i) * 2); g.lineTo(x + 4, y - 2 - Math.sin(T * 40 + i) * 2); g.stroke(); } }
// ---------- площадь с участками под голосование ----------
export const PLAZA = { x0: -32.5, x1: 32.5, z0: -64, z1: -18 };
export const VOTE = [['MASJID', -19.5, -58], ['CHOYXONA', 0, -58], ['BOZOR', 19.5, -58], ['STADION', -9.75, -38], ['SENING VARIANTING?', 9.75, -38]];
// мечеть — победитель голосования выпуска 2
export function mosque(g, x, z, T) {
  const c = proj(x, ground(z), z); if (c[2] < 1 || c[2] > 900) return; LZ = c[2];
  const y0 = ground(z + 9) + 0.2, w = 11, d = 9, x0 = x - w / 2, x1 = x + w / 2, z0 = z, z1 = z + d, top = y0 + 5.2;
  box(g, x0 - 0.5, x1 + 0.5, ground(z0) - 0.1, y0, z0 - 0.6, z1 + 0.5, '#d8cfc0', { top: true, topCol: '#e8e0d0' });
  box(g, x0, x1, y0, top, z0, z1, '#f2ead8', { topCol: '#e6dcc8' });
  for (let i = 0; i < 4; i++) { const ax = x0 + 1.1 + i * 2.4; onFront(g, ax, y0 + 0.4, 1.5, 3.2, z0, '#1f6f78', 0.1); const p = proj(ax + 0.75, y0 + 3.6, z0 - 0.03), s = cam.f / p[2]; if (p[2] > 1) { g.fillStyle = mix('#1f6f78', HAZE, fog(p[2])); g.beginPath(); g.arc(p[0], p[1], 0.75 * s, Math.PI, 0); g.fill(); }
    if (ENV.lamps > 0.3) { const q = proj(ax + 0.75, y0 + 2, z0); if (q[2] > 1) addLight(q[0], q[1], 3 * cam.f / q[2], '255,214,140', 0.35); } }
  onFront(g, x0, top - 0.7, w, 0.35, z0, '#3aa6a0', 0.1);
  // купол
  const dc = proj(x, top + 0.6, z0 + d / 2), s = cam.f / dc[2], R = 3.6 * s;
  if (dc[2] > 1) { g.fillStyle = mix('#e6dcc8', HAZE, fog(dc[2])); g.fillRect(dc[0] - R * 0.82, dc[1] - 0.6 * s, R * 1.64, 1.2 * s);
    const gr = g.createRadialGradient(dc[0] - R * 0.35, dc[1] - R * 0.7, R * 0.1, dc[0], dc[1] - R * 0.3, R * 1.1); gr.addColorStop(0, mix('#7fd8cc', HAZE, fog(dc[2]))); gr.addColorStop(1, mix('#1f8a86', HAZE, fog(dc[2])));
    g.fillStyle = gr; g.beginPath(); g.ellipse(dc[0], dc[1] - 0.6 * s, R * 0.82, R * 1.05, 0, Math.PI, 0); g.fill(); g.strokeStyle = '#1a3a40'; g.lineWidth = Math.max(1, 0.12 * s); g.stroke();
    const tp = dc[1] - 0.6 * s - R * 1.05; g.strokeStyle = '#d9b25a'; g.lineWidth = Math.max(1.5, 0.15 * s); g.beginPath(); g.moveTo(dc[0], tp); g.lineTo(dc[0], tp - 1.2 * s); g.stroke();
    g.beginPath(); g.arc(dc[0], tp - 1.6 * s, 0.45 * s, 0.6, 5.7); g.stroke(); }
  // минарет
  const mx = x1 + 2.2, mz = z0 + 1.5; box(g, mx - 0.8, mx + 0.8, ground(mz), ground(mz) + 15, mz - 0.8, mz + 0.8, '#f2ead8', { topCol: '#e6dcc8' });
  box(g, mx - 1.3, mx + 1.3, ground(mz) + 11, ground(mz) + 11.5, mz - 1.3, mz + 1.3, '#3aa6a0');
  const mt = proj(mx, ground(mz) + 15, mz); if (mt[2] > 1) { const ms = cam.f / mt[2]; g.fillStyle = mix('#2a9a94', HAZE, fog(mt[2])); g.beginPath(); g.moveTo(mt[0] - 0.9 * ms, mt[1]); g.lineTo(mt[0], mt[1] - 2.6 * ms); g.lineTo(mt[0] + 0.9 * ms, mt[1]); g.closePath(); g.fill();
    if (ENV.lamps > 0.3) addLight(mt[0], mt[1] + 3.5 * ms, 3 * ms, '255,230,160', 0.5); }
}
export function plaza(g, T, k = [1, 1, 1, 1, 1]) {
  const q = P([[PLAZA.x0, ground(PLAZA.z0) + 0.04, PLAZA.z0], [PLAZA.x1, ground(PLAZA.z0) + 0.04, PLAZA.z0], [PLAZA.x1, ground(PLAZA.z1) + 0.04, PLAZA.z1], [PLAZA.x0, ground(PLAZA.z1) + 0.04, PLAZA.z1]]);
  if (q.some((p) => p[2] < 1)) return []; poly(g, q, '#8a7f7a', '#4a3a4a', 2);
  const out = [];
  VOTE.forEach(([name, x, z], i) => { const a = clamp(k[i]); const pq = P([[x - 6, ground(z) + 0.06, z], [x + 6, ground(z) + 0.06, z], [x + 6, ground(z + 10) + 0.06, z + 10], [x - 6, ground(z + 10) + 0.06, z + 10]]); g.setLineDash([8, 6]); poly(g, pq, 'rgba(255,214,140,0.12)', `rgba(255,224,150,${0.4 + 0.5 * a})`, 3); g.setLineDash([]);
    const p = proj(x, ground(z + 5) + 3.2, z + 5); if (p[2] > 1 && a > 0) out.push([name, p[0], p[1], a]); });
  return out;
}


// ---------- улицы Ташкента, машины, прохожие ----------
// районы Ташкента по сторонам света (+z — север, +x — восток) и их настоящие улицы
const DIST = {
  'Shayxontohur': ['Navoiy', 'Beruniy', 'Qorasaroy', 'Zarqaynar', 'Gʻafur Gʻulom', 'Chorsu', 'Samarqand Darvoza', 'Labzak', 'Oʻrda', 'Gulbozor'],
  'Mirobod': ['Mustaqillik', 'Afrosiyob', 'Oybek', 'Mirobod', 'Sayilgoh', 'Nukus', 'Taras Shevchenko', 'Movarounnahr', 'Istiqbol', 'Ashxobod'],
  'Yakkasaroy': ['Shota Rustaveli', 'Bobur', 'Qushbegi', 'Bogʻibuston', 'Yakkasaroy', 'Abdulla Qahhor', 'Usmon Nosir', 'Kichik Beshyogʻoch', 'Mukimiy', 'Gʻaniy Arabov'],
  'Yunusobod': ['Bogʻishamol', 'Yunusobod', 'Shahriston', 'Bodomzor', 'Ahmad Donish', 'Posira', 'Minor', 'Kichik Halqa', 'Iftixor', 'Navroʻz'],
  'Mirzo Ulugʻbek': ['Mirzo Ulugʻbek', 'Universitet', 'Qorasu', 'Feruza', 'Sayram', 'Olimlar', 'Tolariq', 'Darxon', 'Buyuk Turon', 'Muminov'],
  'Yashnobod': ['Parkent', 'Mashinasozlar', 'Aviasozlar', 'Fargʻona yoʻli', 'Toʻytepa', 'Elbek', 'Qoʻyliq', 'Tuzel', 'Yashnobod', 'Shifokorlar'],
  'Bektemir': ['Bektemir', 'Husayn Boyqaro', 'Rohat', 'Suvsoz', 'Yangiobod', 'Doʻstlik', 'Bogʻzor', 'Xumo', 'Mehnat', 'Gulobod'],
  'Sergeli': ['Sergeli', 'Yangi Sergeli', 'Qumariq', 'Choshtepa', 'Xonobod', 'Sputnik', 'Quyosh', 'Nilufar', 'Yangi hayot', 'Oqtepa'],
  'Chilonzor': ['Bunyodkor', 'Muqimiy', 'Qatortol', 'Lutfiy', 'Gavhar', 'Chilonzor', 'Novza', 'Diydor', 'Choʻponota', 'Arnasoy'],
  'Uchtepa': ['Uchtepa', 'Farhod', 'Nurafshon', 'Bogʻbon', 'Gulsanam', 'Shiroq', 'Lolazor', 'Kuyluk', 'Qoraqamish', 'Mevazor'],
  'Olmazor': ['Farobiy', 'Sebzor', 'Olmazor', 'Talabalar', 'Sagʻbon', 'Kamolon', 'Qoraqamish', 'Shifobaxsh', 'Beshqayragʻoch', 'Oqqoʻrgʻon'] };
export const DISTRICTS = Object.keys(DIST);
export function districtOf(x, z) {
  const r = Math.hypot(x, z + 40), th = Math.atan2(x, z + 40) * 180 / Math.PI;   // 0° — север, 90° — восток
  if (r < 175) return z < -110 ? 'Yakkasaroy' : x < 0 ? 'Shayxontohur' : 'Mirobod';
  if (th >= -30 && th < 30) return 'Yunusobod'; if (th >= 30 && th < 75) return 'Mirzo Ulugʻbek'; if (th >= 75 && th < 120) return 'Yashnobod'; if (th >= 120 && th < 160) return 'Bektemir';
  if (th >= 160 || th < -160) return 'Sergeli'; if (th >= -160 && th < -115) return 'Chilonzor'; if (th >= -115 && th < -70) return 'Uchtepa'; return 'Olmazor';
}
const VN = { 0: 'Amir Temur shoh koʻchasi', 1: 'Buyuk Ipak yoʻli', '-1': 'Beruniy shoh koʻchasi', 2: 'Mustaqillik shoh koʻchasi', '-2': 'Bunyodkor shoh koʻchasi', 3: 'Fargʻona yoʻli', '-3': 'Farobiy koʻchasi', 4: 'Parkent koʻchasi', '-4': 'Qoraqamish koʻchasi' };
export const rowOf = (z) => Math.round((z - 15) / 32);
export function rowName(j, x = 0) { const d = districtOf(x, j * 32 + 15), L = DIST[d]; return L[((j % L.length) + L.length) % L.length] + ' koʻchasi'; }
export function colName(b) { return VN[b] || 'Yangi koʻcha'; }
export function addresses(houses) {   // адрес: район + улица перед домом + номер по порядку вдоль улицы
  const by = new Map(); for (const h of houses) { const j = rowOf(h.z), d = districtOf(h.x, h.z), k = j + '|' + d; if (!by.has(k)) by.set(k, []); by.get(k).push(h); h.row = j; h.dist = d; }
  for (const L of by.values()) { L.sort((a, b) => a.x - b.x); L.forEach((h, i) => { h.sname = rowName(h.row, h.x); h.snum = i + 1; h.addr = `${h.dist} t., ${h.sname}, ${i + 1}-uy`; }); }
}
export const TEMUR = { x: 0, z: -75, r: 13.5 };
const inPlaza = (x, z) => x > PLAZA.x0 - 1 && x < PLAZA.x1 + 1 && z > PLAZA.z0 - 1 && z < PLAZA.z1 + 1;
const fadeX = (x, z) => (z > PLAZA.z0 - 1 && z < PLAZA.z1 + 1 ? clamp(Math.min(Math.abs(x - PLAZA.x0), Math.abs(x - PLAZA.x1)) / 6) : 1);
const fadeZ = (x, z) => (x > PLAZA.x0 && x < PLAZA.x1 ? clamp(Math.min(Math.abs(z - PLAZA.z0), Math.abs(z - PLAZA.z1)) / 6) : 1);
const HC = ['#f4f4f4', '#f4f4f4', '#e8e4dc', '#c8ccd2', '#1e1e24', '#f4f4f4', '#2e86c1', '#c0392b', '#f4f4f4', '#9aa0a8', '#3a4a5a', '#f4f4f4'];   // в Ташкенте почти все машины белые
const carType = (sd, bus) => { const t = Math.floor(sd * 997) % 20; return bus && t < 3 ? 4 : t < 4 ? 3 : t < 7 ? 2 : t < 10 ? 1 : 0; };   // 3 — жёлтое такси, 2 — белый минивэн, 4 — автобус
// всё, что двигается рядом с камерой: машины по полосам и люди по тротуарам — позиция = функция времени
export function movers(T, R = 150) {
  const out = [], jz = Math.round(cam.z / 32), bx = Math.round((cam.x + 5) / 138);
  const lane = (key, a, b, P, v, ph, mk) => { const off = ph + v * T; for (let k = Math.floor((a - off) / P) - 1; k <= Math.ceil((b - off) / P) + 1; k++) { const s = off + k * P; if (s < a || s > b) continue; const sd = H01(key * 13.7 + k * 7.31); if (sd < 0.35) continue; mk(s, sd, k); } };
  for (let j = jz - 8; j <= jz + 8; j++) { const z = j * 32; if (z < -560 || z > 520 || Math.abs(z + 5 - cam.z - 60) > R) continue; const a = Math.max(-560, cam.x - R), b = Math.min(560, cam.x + R);
    const bus = j % 4 === 0;
    lane(j * 3 + 1, a, b, 46, 9 + H01(j) * 4, H01(j * 1.3) * 46, (x, sd) => { const zz = z + 2.9; if (!inPlaza(x, zz)) out.push({ k: 'cx', x, z: zz, dir: 1, c: HC[Math.floor(sd * 97) % HC.length], ty: carType(sd, bus), a: fadeX(x, zz) }); });
    lane(j * 3 + 2, a, b, 52, -(8 + H01(j + 9) * 4), H01(j * 2.1) * 52, (x, sd) => { const zz = z + 5.2; if (!inPlaza(x, zz)) out.push({ k: 'cx', x, z: zz, dir: -1, c: HC[Math.floor(sd * 97) % HC.length], ty: carType(sd, bus), a: fadeX(x, zz) }); });
    for (const [sz, dir, key] of [[z + 0.75, 1, 5], [z + 9.1, -1, 6], [z + 0.9, -1, 7], [z + 8.95, 1, 8]]) lane(j * 11 + key, a, b, 21, dir * (1.1 + H01(j + key) * 0.5), H01(j * 3 + key) * 21, (x, sd, k) => { if (!inPlaza(x, sz) && sd > 0.5) out.push({ k: 'p', x, z: sz, dir, sd, ph: k * 1.7, a: fadeX(x, sz) }); }); }
  for (let b = bx - 3; b <= bx + 3; b++) { const x = -5 + b * 138; if (x < -560 || x > 560 || Math.abs(x - cam.x) > R) continue; const a = Math.max(-560, cam.z - 40), e = Math.min(520, cam.z + R + 60);
    const ring = (lx, z) => { const dz = z + 2 - TEMUR.z, R = TEMUR.r - 2; return b === 0 && Math.abs(dz) < R ? Math.sign(lx) * Math.max(Math.abs(lx), Math.sqrt(R * R - dz * dz)) : lx; };   // объезд сквера Амира Темура
    lane(b * 5 + 101, a, e, 40, 10, H01(b * 1.7) * 40, (z, sd) => { if (!inPlaza(x + 6, z)) out.push({ k: 'cz', x: x + 5 + ring(1.6, z), z, dir: 1, c: HC[Math.floor(sd * 97) % HC.length], ty: carType(sd, b === 0), a: fadeZ(x + 6, z) }); });
    lane(b * 5 + 102, a, e, 44, -9.5, H01(b * 2.9) * 44, (z, sd) => { if (!inPlaza(x + 3, z)) out.push({ k: 'cz', x: x + 5 + ring(-1.6, z), z, dir: -1, c: HC[Math.floor(sd * 97) % HC.length], ty: carType(sd, b === 0), a: fadeZ(x + 3, z) }); });
    for (const [px, dir, key] of [[x + 0.75, 1, 3], [x + 9.25, -1, 4]]) lane(b * 7 + key + 200, a, e, 19, dir * 1.3, H01(b + key) * 19, (z, sd, k) => { if (!inPlaza(px, z) && sd > 0.55 && !(b === 0 && Math.abs(z - TEMUR.z) < TEMUR.r + 1)) out.push({ k: 'p', x: px, z, dir: dir * 2, sd, ph: k * 2.3, a: fadeZ(px, z) }); }); }
  return out;
}
function wheels(g, xs, y, z) { for (const wx of xs) { const q = proj(wx, y, z); if (q[2] > 1) { const r = 0.4 * cam.f / q[2]; g.fillStyle = '#1e1a24'; g.beginPath(); g.arc(q[0], q[1], r, 0, 7); g.fill(); g.fillStyle = '#9a9aa4'; g.beginPath(); g.arc(q[0], q[1], r * 0.42, 0, 7); g.fill(); } } }
function carX(g, x, z, dir, c, ty) {   // машина вдоль x
  const y0 = ground(z);
  if (ty === 4) {   // городской автобус: белый с синей полосой
    const L = 5.6; box(g, x - L, x + L, y0 + 0.45, y0 + 3.3, z - 1.25, z + 1.25, '#f2f2f2', { topCol: '#e4e8ee' });
    onFront(g, x - L + 0.4, y0 + 1.9, 2 * L - 0.8, 1.0, z - 1.26, '#3a4a6a', 0.15); onFront(g, x - L, y0 + 1.15, 2 * L, 0.35, z - 1.27, '#1f5fae', 0);
    for (let i = 1; i < 6; i++) onFront(g, x - L + 0.4 + i * (2 * L - 0.8) / 6 - 0.05, y0 + 1.9, 0.1, 1.0, z - 1.27, '#f2f2f2', 0);
    wheels(g, [x - L * 0.7, x + L * 0.7], y0 + 0.45, z - 1.27); return; }
  const L = ty === 2 ? 2.2 : 2.15, col = ty === 3 ? '#f2c230' : ty === 2 ? '#f4f4f4' : c;
  box(g, x - L, x + L, y0 + 0.35, y0 + 1.15, z - 0.9, z + 0.9, col, { topCol: shade(col, 0.08) });
  if (ty === 2) { const fx = dir * 0.5; box(g, x - L + 0.1 + Math.max(0, fx), x + L - 0.1 + Math.min(0, fx), y0 + 1.15, y0 + 2.35, z - 0.85, z + 0.85, col, { topCol: shade(col, 0.12) }); onFront(g, x - L + 0.5, y0 + 1.45, 2 * L - 1.0, 0.6, z - 0.86, '#3a4a6a', 0.15); }
  else { const fx = dir > 0 ? 0.25 : -0.25, top = ty === 1 ? 2.05 : 1.8; box(g, x - 1.1 - fx, x + 1.0 - fx, y0 + 1.15, y0 + top, z - 0.8, z + 0.8, col, { topCol: shade(col, 0.12) }); onFront(g, x - 1.0 - fx, y0 + 1.2, 1.9, top - 1.3, z - 0.81, '#3a4a6a', 0.15);
    if (ty === 3) { box(g, x - 0.35 - fx, x + 0.35 - fx, y0 + top, y0 + top + 0.35, z - 0.25, z + 0.25, '#ffffff'); onFront(g, x - 0.35 - fx, y0 + top + 0.05, 0.7, 0.25, z - 0.26, '#1e1e24', 0); } }
  const hx = x + dir * (L - 0.05), p = proj(hx, y0 + 0.75, z - 0.6); if (p[2] > 1) { const s = cam.f / p[2]; g.fillStyle = dir > 0 ? '#fff4c0' : '#e83a3a'; g.beginPath(); g.arc(p[0], p[1], 0.2 * s, 0, 7); g.fill(); }
  wheels(g, [x - L * 0.62, x + L * 0.62], y0 + 0.35, z - 0.92);
}
function carZ(g, x, z, dir, c, ty) {   // машина вдоль z: к нам — фары, от нас — красные стопы
  const y0 = ground(z + 2), lc = dir < 0 ? '#fff4c0' : '#e83a3a';
  if (ty === 4) { box(g, x - 1.25, x + 1.25, y0 + 0.45, y0 + 3.3, z, z + 11, '#f2f2f2', { topCol: '#e4e8ee' }); onFront(g, x - 1.05, y0 + 1.6, 2.1, 1.3, z, '#3a4a6a', 0.15); onFront(g, x - 1.25, y0 + 1.15, 2.5, 0.3, z - 0.01, '#1f5fae', 0); onFront(g, x - 1.1, y0 + 0.65, 0.4, 0.25, z - 0.01, lc, 0.2); onFront(g, x + 0.7, y0 + 0.65, 0.4, 0.25, z - 0.01, lc, 0.2); return; }
  const col = ty === 3 ? '#f2c230' : ty === 2 ? '#f4f4f4' : c, L = 4.2, top = ty === 2 ? 2.35 : ty === 1 ? 2.05 : 1.8, c0 = ty === 2 ? 0.5 : 1.1, c1 = ty === 2 ? L - 0.1 : 3.1;
  box(g, x - 0.95, x + 0.95, y0 + 0.35, y0 + 1.15, z, z + L, col, { topCol: shade(col, 0.08) }); box(g, x - 0.85, x + 0.85, y0 + 1.15, y0 + top, z + c0, z + c1, col, { topCol: shade(col, 0.12) });
  if (ty === 3) box(g, x - 0.3, x + 0.3, y0 + top, y0 + top + 0.35, z + 1.8, z + 2.3, '#ffffff');
  onFront(g, x - 0.75, y0 + 1.2, 1.5, top - 1.4, z + c0, '#3a4a6a', 0.15);
  onFront(g, x - 0.8, y0 + 0.6, 0.35, 0.22, z, lc, 0.2); onFront(g, x + 0.45, y0 + 0.6, 0.35, 0.22, z, lc, 0.2);
}
const SHIRT = ['#e0503a', '#3a7bd5', '#f2c94c', '#27ae60', '#8e44ad', '#ffffff', '#e67e22', '#1abc9c', '#ec6fa0', '#34495e'];
function walker(g, q, T) {
  const b = proj(q.x, ground(q.z), q.z); if (b[2] < 2 || b[2] > 160) return; const kid = q.sd > 0.93, s = cam.f / b[2] * (kid ? 0.68 : 1), hh = 2.3 * s, hd = hh / 8, X = b[0], Y = b[1];
  const ph = T * 7.5 + q.ph, sw = Math.sin(ph), side = Math.abs(q.dir) === 1, d = Math.sign(q.dir);
  const col = SHIRT[Math.floor(q.sd * 977) % SHIRT.length], scarf = q.sd * 31 % 1 < 0.3, dop = !scarf && q.sd * 53 % 1 < 0.3;
  g.lineCap = 'round'; g.lineJoin = 'round'; g.fillStyle = 'rgba(30,20,40,0.18)'; g.beginPath(); g.ellipse(X, Y, hd * 1.4, hd * 0.4, 0, 0, 7); g.fill();
  const leg = (k) => { const dx = side ? sw * k * hd * 1.1 * d : hd * 0.4 * k, lift = side ? 0 : Math.max(0, sw * k) * hd * 0.5; g.strokeStyle = '#2f3550'; g.lineWidth = hd * 0.75; g.beginPath(); g.moveTo(X + (side ? 0 : hd * 0.4 * k), Y - hh * 0.5); g.lineTo(X + dx, Y - hd * 0.3 - lift); g.stroke(); };
  leg(1); leg(-1);
  if (scarf) { g.fillStyle = col; g.beginPath(); g.moveTo(X - hd * 0.95, Y - hh * 0.8); g.lineTo(X + hd * 0.95, Y - hh * 0.8); g.lineTo(X + hd * 1.15, Y - hh * 0.32); g.lineTo(X - hd * 1.15, Y - hh * 0.32); g.closePath(); g.fill(); }
  else { g.fillStyle = col; g.beginPath(); g.moveTo(X - hd * 0.95, Y - hh * 0.8); g.lineTo(X + hd * 0.95, Y - hh * 0.8); g.lineTo(X + hd * 0.8, Y - hh * 0.47); g.lineTo(X - hd * 0.8, Y - hh * 0.47); g.closePath(); g.fill(); }
  g.strokeStyle = '#f0c8a0'; g.lineWidth = hd * 0.42; for (const k of [1, -1]) { const ax = side ? -sw * k * hd * 0.8 * d : 0; g.beginPath(); g.moveTo(X + hd * 0.85 * k, Y - hh * 0.78); g.lineTo(X + hd * 0.95 * k + ax, Y - hh * 0.5); g.stroke(); }
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(X, Y - hh + hd * 0.5, hd * 0.52, 0, 7); g.fill();
  if (scarf) { g.fillStyle = ['#ffffff', '#e05a7a', '#3a7bd5', '#f2c94c'][Math.floor(q.sd * 401) % 4]; g.beginPath(); g.arc(X, Y - hh + hd * 0.45, hd * 0.68, Math.PI * 0.95, Math.PI * 2.05); g.lineTo(X + hd * 0.6, Y - hh + hd * 1.15); g.lineTo(X - hd * 0.6, Y - hh + hd * 1.15); g.closePath(); g.fill(); }
  else { g.fillStyle = ['#2a1c18', '#4a3020', '#1a1418'][Math.floor(q.sd * 211) % 3]; g.beginPath(); g.arc(X, Y - hh + hd * 0.38, hd * 0.55, Math.PI, 0); g.fill();
    if (dop) { g.fillStyle = '#1a1a22'; g.fillRect(X - hd * 0.55, Y - hh - hd * 0.15, hd * 1.1, hd * 0.5); g.strokeStyle = '#f0f0f0'; g.lineWidth = Math.max(1, hd * 0.08); g.beginPath(); g.moveTo(X - hd * 0.3, Y - hh + hd * 0.05); g.lineTo(X - hd * 0.1, Y - hh - hd * 0.1); g.moveTo(X + hd * 0.1, Y - hh + hd * 0.05); g.lineTo(X + hd * 0.3, Y - hh - hd * 0.1); g.stroke(); } }
}
export function mover(g, q, T) { if ((q.a ?? 1) < 0.02) return; const ga = g.globalAlpha; g.globalAlpha = ga * (q.a ?? 1); moverIn(g, q, T); g.globalAlpha = ga; }
function moverIn(g, q, T) { if (q.k === 'cx') carX(g, q.x, q.z, q.dir, q.c, q.ty); else if (q.k === 'cz') carZ(g, q.x, q.z, q.dir, q.c, q.ty); else walker(g, q, T); }
// таблички на перекрёстках: синие, как в Ташкенте
export function signs(R = 150) {
  const out = [], jz = Math.round(cam.z / 32), bx = Math.round((cam.x + 5) / 138);
  for (let j = jz - 2; j <= jz + 6; j++) for (let b = bx - 2; b <= bx + 2; b++) { const x = -5 + b * 138, z = j * 32; if (x < -560 || x > 560 || z < -540 || z > 500) continue; for (const sx of [x - 1.0, x + 11.0]) if (!inPlaza(sx, z - 1) && Math.hypot(sx - TEMUR.x, z - 1 - TEMUR.z) > TEMUR.r + 2) out.push({ x: sx, z: z - 1.0, h: rowName(j, sx), v: colName(b), metro: ((j % 5) + 5) % 5 === 0 && b % 2 === 0 && sx > x }); }
  return out;
}
export function streetSign(g, q) {
  const y0 = ground(q.z), a = proj(q.x, y0, q.z); if (a[2] < 3 || a[2] > 150) return; const s = cam.f / a[2], top = proj(q.x, y0 + 4.2, q.z);
  g.strokeStyle = '#3a3e48'; g.lineWidth = Math.max(1.2, 0.14 * s); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(top[0], top[1]); g.stroke();
  const fs = Math.max(7, 0.42 * s); g.font = `800 ${fs}px Rubik`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (q.metro) { const m = proj(q.x + 1.6, y0 + 3.6, q.z), mt = proj(q.x + 1.6, y0, q.z), r = 0.75 * cam.f / m[2]; g.strokeStyle = '#3a3e48'; g.lineWidth = Math.max(1.2, 0.14 * s); g.beginPath(); g.moveTo(mt[0], mt[1]); g.lineTo(m[0], m[1]); g.stroke();
    g.fillStyle = '#1f5fae'; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, r * 0.12); g.beginPath(); g.arc(m[0], m[1] - r, r, 0, 7); g.fill(); g.stroke(); g.font = `900 ${r * 1.3}px Rubik`; g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', m[0], m[1] - r * 0.92); g.font = `800 ${fs}px Rubik`; }
  [[q.h, 0], [q.v, 1]].forEach(([t, i]) => { const w = g.measureText(t).width + fs * 1.0, hgt = fs * 1.55, cy = top[1] + i * (hgt + fs * 0.25) + hgt / 2;
    g.fillStyle = '#1f5fae'; g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, fs * 0.12); g.beginPath(); g.roundRect(top[0] - w / 2, cy - hgt / 2, w, hgt, fs * 0.25); g.fill(); g.stroke(); g.fillStyle = '#ffffff'; g.fillText(t, top[0], cy + fs * 0.05); });
}

// ---------- ташкентские детали: чинары вдоль арыков, автобусные остановки ----------
(() => { let n = 50000; for (let j = -17; j <= 15; j++) { const z = j * 32; for (let b = -4; b <= 3; b++) { const x0 = -5 + b * 138 + 10;
  for (let k = 0; k <= 8; k++) { const x = x0 + k * 16; if (Math.abs(x) < 40 && z > -100 && z < -10) continue; if (H01(x * 0.71 + j * 1.3) < 0.18) continue; PROPS.push({ kind: 'chinar', x, z: z + 9.9, seed: n++, s: 0.85 + H01(x + j) * 0.35 }); }
  if (((j % 2) + 2) % 2 === 0 && !(Math.abs(x0 + 64) < 40 && z > -100 && z < -10)) PROPS.push({ kind: 'stop', x: x0 + 64, z: z + 9.3, seed: n++ }); } } })();
function chinar(g, x, z, sc, T, seed) {   // чинара: светлый пятнистый ствол, широкая пышная крона
  const y0 = ground(z), b = proj(x, y0, z); if (b[2] < 2 || b[2] > 300) return; const s = cam.f / b[2] * sc, fz = fog(b[2]);
  if (b[2] > 130) { g.fillStyle = mix('#4a7c34', HAZE, fz); g.fillRect(b[0] - 0.2 * s, b[1] - 5 * s, 0.4 * s, 5 * s); g.beginPath(); g.arc(b[0], b[1] - 7 * s, 2.8 * s, 0, 7); g.fill(); return; }
  if (b[2] < 140) { g.fillStyle = 'rgba(30,40,20,0.18)'; g.beginPath(); g.ellipse(b[0], b[1], 2.6 * s, 0.7 * s, 0, 0, 7); g.fill(); }
  g.fillStyle = mix('#cdbfa4', HAZE, fz); g.beginPath(); g.moveTo(b[0] - 0.35 * s, b[1]); g.lineTo(b[0] - 0.22 * s, b[1] - 5 * s); g.lineTo(b[0] + 0.22 * s, b[1] - 5 * s); g.lineTo(b[0] + 0.35 * s, b[1]); g.closePath(); g.fill();
  if (b[2] < 120) { g.fillStyle = mix('#8a7a60', HAZE, fz); for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(b[0] + (H01(seed + i) - 0.5) * 0.4 * s, b[1] - (0.8 + i * 1.1) * s, 0.12 * s, 0.22 * s, 0, 0, 7); g.fill(); } }
  const sw = Math.sin(T * 1.1 + seed) * 0.12 * s;
  for (const [dx, dy, r, c] of [[-1.7, -5.6, 2.2, '#3d6a2e'], [1.7, -5.8, 2.2, '#3d6a2e'], [0, -7.4, 2.6, '#4a7c34'], [-1.0, -6.4, 2.0, '#558a3a'], [1.1, -7.0, 1.9, '#5e9640'], [0.2, -8.6, 1.7, '#6aa446']]) { g.fillStyle = mix(c, HAZE, fz); g.beginPath(); g.arc(b[0] + dx * s + sw * (-dy / 8), b[1] + dy * s, r * s, 0, 7); g.fill(); }
  g.fillStyle = mix('#9ccc62', HAZE, fz); g.globalAlpha *= 0.5; g.beginPath(); g.arc(b[0] + 0.9 * s + sw, b[1] - 8.2 * s, 0.9 * s, 0, 7); g.fill(); g.globalAlpha /= 0.5;
}
function busStop(g, x, z) {   // остановка «Bekat»: навес, скамейка, синяя табличка
  const y0 = ground(z), a = proj(x, y0, z); if (a[2] < 3 || a[2] > 200) return;
  for (const px of [x - 1.6, x + 1.6]) { const p0 = proj(px, y0, z + 0.4), p1 = proj(px, y0 + 2.5, z + 0.4); g.strokeStyle = '#4a4e58'; g.lineWidth = Math.max(1, 0.12 * cam.f / a[2]); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
  face(g, [[x - 1.7, y0 + 0.2, z + 0.7], [x + 1.7, y0 + 0.2, z + 0.7], [x + 1.7, y0 + 2.4, z + 0.7], [x - 1.7, y0 + 2.4, z + 0.7]], '#9fc4dc', 0.1, { lw: 1 });
  box(g, x - 1.2, x + 1.2, y0 + 0.5, y0 + 0.65, z + 0.2, z + 0.6, '#8a5a3a');
  box(g, x - 1.9, x + 1.9, y0 + 2.5, y0 + 2.7, z - 0.2, z + 0.9, '#1f5fae', { topCol: '#2e74c8' });
  const t = proj(x, y0 + 2.6, z - 0.21); if (t[2] > 1 && t[2] < 90) { const fs = Math.max(6, 0.35 * cam.f / t[2]); g.font = `800 ${fs}px Rubik`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText('BEKAT', t[0], t[1]); }
}
export function propX(g, q, T) { if (q.kind === 'chinar') return chinar(g, q.x, q.z, q.s, T, q.seed); if (q.kind === 'stop') return busStop(g, q.x, q.z); prop(g, q, T); }
// арыки вдоль тротуаров — только рядом с камерой
export function aryks(g, T) {
  const jz = Math.round(cam.z / 32); for (let j = jz - 2; j <= jz + 6; j++) { const z = j * 32 + 9.55; if (z < -540 || z > 500) continue; const xa = Math.max(-560, cam.x - 140), xb = Math.min(560, cam.x + 140);
    for (let b = Math.floor((xa + 5) / 138); b <= Math.ceil((xb + 5) / 138); b++) { const x0 = Math.max(xa, -5 + b * 138 + 10), x1 = Math.min(xb, -5 + (b + 1) * 138); if (x1 <= x0) continue; if (z > -100 && z < -10 && x0 < 40 && x1 > -40) continue;
      groundQuad(g, x0, x1, z - 0.05, z + 0.45, '#4a5a5a', 0); groundQuad(g, x0, x1, z + 0.02, z + 0.38, '#5aa7c8', 0.15); } }
}
// ---------- сквер Амира Темура: круглая площадь, кольцо, памятник-всадник ----------
function disk(g, cx, cz, r, col, line, n = 40) { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pts.push([x, ground(z) + 0.03, z]); } let pr = P(pts); if (pr.every((p) => p[2] < NEAR)) return; if (pr.some((p) => p[2] < NEAR)) { pr = clipNear(pr); if (!pr) return; } poly(g, pr, mix(col, HAZE_FAR, fog(avgZ(pr))), line, 1.5); }
export function temurGround(g) {
  const { x, z, r } = TEMUR; if (Math.abs(z - cam.z) > 700) return;
  disk(g, x, z, r + 1.2, '#9a8e88'); disk(g, x, z, r, '#5a5058'); disk(g, x, z, r - 4.2, '#9a8e88'); disk(g, x, z, r - 5, '#5f9a40');
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), sn = Math.sin(a); const pts = [[x + c * 1.6 - sn * 0.6, z + sn * 1.6 + c * 0.6], [x + c * (r - 5) - sn * 0.6, z + sn * (r - 5) + c * 0.6], [x + c * (r - 5) + sn * 0.6, z + sn * (r - 5) - c * 0.6], [x + c * 1.6 + sn * 0.6, z + sn * 1.6 - c * 0.6]].map(([px, pz]) => [px, ground(pz) + 0.05, pz]); const pr = P(pts); if (pr.every((p) => p[2] > NEAR)) poly(g, pr, '#d8ccb0'); }
  disk(g, x, z, 2.2, '#d8ccb0'); disk(g, x, z, 3.0, 'rgba(0,0,0,0)', null);
}
export function temurMonument(g, T) {
  const { x, z } = TEMUR, y0 = ground(z), b = proj(x, y0, z); if (b[2] < 2 || b[2] > 700) return;
  const TR = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3; TR.push([x + Math.cos(a) * 7.3, z + Math.sin(a) * 7.3, i]); } const cd = (q) => Math.hypot(q[0] - cam.x, q[1] - cam.z), md = Math.hypot(x - cam.x, z - cam.z);
  TR.filter((q) => cd(q) > md).sort((a, b) => cd(b) - cd(a)).forEach((q) => chinar(g, q[0], q[1], 0.48, T, 900 + q[2]));
  box(g, x - 1.5, x + 1.5, y0, y0 + 0.5, z - 1.5, z + 1.5, '#8a8078'); box(g, x - 1.1, x + 1.1, y0 + 0.5, y0 + 3.6, z - 1.1, z + 1.1, '#6a6070', { topCol: '#7a7080' });
  const p = proj(x, y0 + 3.6, z), s = cam.f / p[2], X = p[0], Y = p[1], br = mix('#6b5530', HAZE_FAR, fog(p[2])), hi = mix('#9a8048', HAZE_FAR, fog(p[2]));
  g.fillStyle = br; g.strokeStyle = br; g.lineCap = 'round';
  g.beginPath(); g.ellipse(X, Y - 1.7 * s, 1.5 * s, 0.75 * s, -0.05, 0, 7); g.fill();   // корпус коня
  g.lineWidth = 0.32 * s; for (const [lx, k] of [[-1.0, 0], [-0.6, 0.3], [0.8, -0.5], [1.15, 0]]) { g.beginPath(); g.moveTo(X + lx * s, Y - 1.4 * s); g.lineTo(X + (lx + k) * s, Y - (k < 0 ? 0.6 : 0) * s - 0.05 * s); if (k < 0) g.lineTo(X + (lx + k - 0.2) * s, Y - 0.25 * s); g.stroke(); }   // ноги, одна поднята
  g.lineWidth = 0.55 * s; g.beginPath(); g.moveTo(X + 1.2 * s, Y - 2.0 * s); g.lineTo(X + 1.75 * s, Y - 2.9 * s); g.stroke(); g.beginPath(); g.ellipse(X + 2.0 * s, Y - 3.0 * s, 0.5 * s, 0.25 * s, 0.4, 0, 7); g.fill();   // шея и голова
  g.lineWidth = 0.18 * s; g.beginPath(); g.moveTo(X - 1.45 * s, Y - 1.8 * s); g.quadraticCurveTo(X - 2.1 * s, Y - 1.3 * s, X - 1.9 * s, Y - 0.6 * s); g.stroke();   // хвост
  g.beginPath(); g.moveTo(X - 0.4 * s, Y - 2.3 * s); g.lineTo(X - 0.1 * s, Y - 3.6 * s); g.lineTo(X + 0.4 * s, Y - 3.6 * s); g.lineTo(X + 0.45 * s, Y - 2.3 * s); g.closePath(); g.fill();   // всадник
  g.lineWidth = 0.22 * s; g.beginPath(); g.moveTo(X + 0.3 * s, Y - 3.4 * s); g.lineTo(X + 1.1 * s, Y - 3.9 * s); g.stroke();   // вытянутая рука
  g.beginPath(); g.arc(X + 0.15 * s, Y - 3.95 * s, 0.32 * s, 0, 7); g.fill(); g.fillStyle = hi; g.beginPath(); g.arc(X + 0.15 * s, Y - 4.2 * s, 0.3 * s, Math.PI, 0); g.fill();   // голова в шлеме
  TR.filter((q) => cd(q) <= md).sort((a, b) => cd(b) - cd(a)).forEach((q) => chinar(g, q[0], q[1], 0.48, T, 900 + q[2]));
  const t = proj(x, y0 + 9.5, z); if (t[2] < 260) { const fs = clamp(0.8 * cam.f / t[2], 9, 30); g.font = `900 ${fs}px Rubik`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = fs / 5; g.strokeStyle = 'rgba(30,22,40,0.85)'; g.strokeText('Amir Temur xiyoboni', t[0], t[1]); g.fillStyle = '#fff3dc'; g.fillText('Amir Temur xiyoboni', t[0], t[1]); }
}
// ---------- горизонт: Ташкентская телебашня и высотки Tashkent City ----------
export function tashkentSkyline(g, T) {
  const fz = 0.55; const tw = [[150, 680, 46, 9], [168, 690, 64, 10], [190, 675, 52, 8], [210, 700, 80, 11], [232, 685, 58, 9], [118, 700, 38, 10], [255, 695, 44, 8]];
  for (const [x, z, h, w] of tw) { const a = proj(x - w / 2, ground(z), z), b2 = proj(x + w / 2, ground(z) + h, z); if (a[2] < 1) continue; g.fillStyle = mix('#7a9ac0', HAZE_FAR, fz); g.fillRect(a[0], b2[1], b2[0] - a[0], a[1] - b2[1]); g.fillStyle = mix('#b8d0ea', HAZE_FAR, fz); g.fillRect(a[0], b2[1], (b2[0] - a[0]) * 0.3, a[1] - b2[1]);
    g.fillStyle = mix('#5a7aa0', HAZE_FAR, fz); for (let k = 1; k < h / 6; k++) { const yy = lerp(a[1], b2[1], k / (h / 6)); g.fillRect(a[0], yy, b2[0] - a[0], 1); } }
  // телебашня: три расставленные опоры, ствол, две «тарелки», шпиль
  const X = -60, Z = 600, y0 = ground(Z), H = 92, p0 = proj(X, y0, Z); if (p0[2] < 1) return; const P2 = (dx, y) => proj(X + dx, y0 + y, Z);
  const col = mix('#e8ecf2', HAZE_FAR, 0.35), dk = mix('#9aa4b4', HAZE_FAR, 0.35); g.strokeStyle = col; g.lineCap = 'round';
  const top = P2(0, H); g.lineWidth = 2.5; for (const dx of [-9, 0, 9]) { const a = P2(dx, 0), c = P2(dx * 0.15, 22); g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(P2(dx * 0.55, 6)[0], P2(dx * 0.55, 6)[1], c[0], c[1]); g.stroke(); }
  const s0 = P2(0, 22); g.lineWidth = 4; g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(top[0], top[1]); g.stroke();
  g.strokeStyle = dk; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const a = P2(-1.6 + i * 0.05, 22 + i * 6), c = P2(1.6 - i * 0.05, 25 + i * 6); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(c[0], c[1]); g.stroke(); }
  for (const [y, w, hh] of [[58, 5, 2.2], [66, 3.2, 1.6]]) { const c = P2(0, y), r = P2(w, y); g.fillStyle = col; g.beginPath(); g.ellipse(c[0], c[1], r[0] - c[0], (r[0] - c[0]) * 0.4, 0, 0, 7); g.fill(); g.fillStyle = dk; g.fillRect(c[0] - (r[0] - c[0]), c[1], 2 * (r[0] - c[0]), hh); }
  const sp = P2(0, H + 14); g.strokeStyle = '#d04040'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(sp[0], sp[1]); g.stroke();
  if (Math.floor(T * 1.6) % 2) { g.fillStyle = 'rgba(255,80,80,0.35)'; g.beginPath(); g.arc(sp[0], sp[1], 12, 0, 7); g.fill(); g.fillStyle = '#ff6a6a'; g.beginPath(); g.arc(sp[0], sp[1], 3, 0, 7); g.fill(); }
}

// ---------- панельные пятиэтажки (Юнусабад на севере, Чиланзор за Анхором), Чорсу, Анхор, ворота махалли ----------
export const CHORSU = { x: -43, z: -43, r: 8.5 };
export const ANHOR = { x0: -577, x1: -569 };
export const BLOCKS = [];
(() => { const PC = ['#e8dcc0', '#eef0ee', '#d6e4ec', '#ecd6c8', '#e4e0cc'], add = (x, z, w, i) => BLOCKS.push({ x, z, w, d: 11, h: 5, col: PC[i % PC.length], seed: i, kind: 'panel' }); let i = 0;
  for (let j = 18; j <= 20; j++) for (let b = -3; b <= 2; b++) { const x0 = -5 + b * 138 + 10, z = j * 32 + 12; add(x0 + 30, z, 44, i++); add(x0 + 96, z, 44, i++); }
  for (let j = -14; j <= -2; j += 2) { const z = j * 32 + 12; add(-658, z, 40, i++); add(-612, z, 38, i++); } })();
function panelBlock(g, B, T, lit) {
  const { x, z, w, d, col, seed } = B, y0 = ground(z), fh = 2.9, H = fh * B.h + 0.6, x0 = x - w / 2, x1 = x + w / 2, c = proj(x, y0 + H / 2, z); if (c[2] < 2 || c[2] > 900) return;
  box(g, x0, x1, y0, y0 + H, z, z + d, col, { topCol: shade(col, -0.25) });
  box(g, x0 - 0.2, x1 + 0.2, y0 + H, y0 + H + 0.35, z - 0.2, z + d + 0.2, shade(col, -0.35));
  if (c[2] > 230) { for (let f = 1; f < B.h; f++) onFront(g, x0, y0 + f * fh, w, 0.12, z - 0.01, shade(col, -0.15), 0); return; }
  const nw = Math.round(w / 3.3), cw = w / nw;
  for (let f = 0; f < B.h; f++) for (let k = 0; k < nw; k++) { const wx = x0 + k * cw, wy = y0 + 0.6 + f * fh, on = lit > 0.3 && H01(seed * 31 + f * 7 + k) < 0.55;
    onFront(g, wx + cw * 0.2, wy + 0.8, cw * 0.6, 1.3, z - 0.02, on ? '#ffd890' : '#4a5a74', on ? 0.1 : 0.12);
    if (f > 0 && k % 2 === 1 && H01(seed + f * 3 + k * 5) < 0.75) { const bc = H01(seed * 5 + f + k) < 0.4 ? '#cfe4f0' : shade(col, -0.08); box(g, wx + cw * 0.05, wx + cw * 0.95, wy + 0.2, wy + 1.15, z - 1.0, z, bc, { topCol: shade(bc, 0.1) });
      if (H01(seed + k + f * 9) < 0.3) { const q = proj(wx + cw * 0.3, wy + 1.0, z - 1.02); if (q[2] > 1 && q[2] < 160) { const s = cam.f / q[2]; g.fillStyle = ['#e05a5a', '#5aa0e0', '#f0d060', '#ffffff'][(seed + k + f) % 4]; g.fillRect(q[0], q[1] - 0.15 * s, 0.6 * s, 0.4 * s); } } }
    if (f > 0 && k % 3 === 0 && H01(seed * 9 + f + k) < 0.3) box(g, wx + cw * 0.75, wx + cw * 0.95, wy + 1.6, wy + 2.0, z - 0.35, z, '#f4f4f4'); }   // кондиционеры
  for (let e = 0; e < 3; e++) { const ex = x0 + w * (e + 0.5) / 3; onFront(g, ex - 0.8, y0, 1.6, 2.1, z - 0.03, '#5a4038', 0); box(g, ex - 1.2, ex + 1.2, y0 + 2.2, y0 + 2.4, z - 1.0, z, shade(col, -0.3)); }
  const dish = proj(x1 - 2, y0 + H + 0.35, z + 2); if (dish[2] < 200) { const s = cam.f / dish[2]; g.fillStyle = '#d8d8d8'; g.beginPath(); g.ellipse(dish[0], dish[1] - 0.6 * s, 0.6 * s, 0.45 * s, -0.4, 0, 7); g.fill(); }
}
function chorsu(g, T) {
  const { x, z, r } = CHORSU, y0 = ground(z), c = proj(x, y0, z); if (c[2] < 3 || c[2] > 900) return;
  box(g, x - r - 2, x + r + 2, y0, y0 + 0.4, z - r - 2, z + r + 2, '#c8b89a');
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.42, sx = x + Math.cos(a) * (r + 0.6), sz = z + Math.sin(a) * (r + 0.6) + 1, p = proj(sx, y0 + 4.3, sz), q = proj(sx, y0 + 0.4, sz); if (p[2] < 1) continue; const s = cam.f / p[2];   // малые купола-лавки по кругу
    g.fillStyle = mix('#d8c8a8', HAZE_FAR, fog(p[2])); g.fillRect(p[0] - 1.6 * s, p[1], 3.2 * s, q[1] - p[1]); g.fillStyle = mix('#2a8fb0', HAZE_FAR, fog(p[2])); g.beginPath(); g.ellipse(p[0], p[1], 1.6 * s, 1.3 * s, 0, Math.PI, 0); g.fill();
    g.fillStyle = mix('#4a3a30', HAZE_FAR, fog(p[2])); g.beginPath(); g.ellipse(p[0], q[1] - 1.2 * s, 0.7 * s, 1.2 * s, 0, Math.PI, 0); g.fill(); }
  const base = proj(x, y0 + 0.4, z - r * 0.15), top = proj(x, y0 + 6, z - r * 0.15), s = cam.f / base[2], R = r * s, f = fog(base[2]);
  g.fillStyle = mix('#e6d8b8', HAZE_FAR, f); g.fillRect(base[0] - R, top[1], 2 * R, base[1] - top[1]);   // барабан
  g.fillStyle = mix('#3a2e2a', HAZE_FAR, f); for (let k = 0; k < 7; k++) { const ax = base[0] - R + (k + 0.5) * 2 * R / 7; g.beginPath(); g.moveTo(ax - R * 0.08, base[1]); g.lineTo(ax - R * 0.08, base[1] - (base[1] - top[1]) * 0.55); g.quadraticCurveTo(ax, base[1] - (base[1] - top[1]) * 0.8, ax + R * 0.08, base[1] - (base[1] - top[1]) * 0.55); g.lineTo(ax + R * 0.08, base[1]); g.closePath(); g.fill(); }
  g.fillStyle = mix('#2a6fa8', HAZE_FAR, f); g.fillRect(base[0] - R, top[1] - 0.25 * s, 2 * R, 0.5 * s);
  const dh = R * 0.95; g.fillStyle = mix('#1f86b8', HAZE_FAR, f); g.beginPath(); g.ellipse(top[0], top[1], R * 0.98, dh, 0, Math.PI, 0); g.fill();   // большой голубой купол
  g.save(); g.beginPath(); g.ellipse(top[0], top[1], R * 0.98, dh, 0, Math.PI, 0); g.clip(); g.strokeStyle = mix('#7fd0ec', HAZE_FAR, f); g.lineWidth = Math.max(1, 0.12 * s);
  for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(top[0], top[1], R * 0.98, dh * k / 5, 0, Math.PI, 0); g.stroke(); } for (let k = -4; k <= 4; k++) { g.beginPath(); g.ellipse(top[0], top[1], Math.abs(R * 0.98 * k / 4.5), dh, 0, Math.PI, 0); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(top[0] - R * 0.35, top[1] - dh * 0.55, R * 0.25, dh * 0.3, -0.5, 0, 7); g.fill(); g.restore();
  g.fillStyle = mix('#e6d8b8', HAZE_FAR, f); g.beginPath(); g.ellipse(top[0], top[1] - dh, R * 0.12, R * 0.06, 0, 0, 7); g.fill();
  const t = proj(x, y0 + 6 + r + 2.5, z); if (t[2] < 320) { const fs = clamp(0.8 * cam.f / t[2], 9, 30); g.font = `900 ${fs}px Rubik`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = fs / 5; g.strokeStyle = 'rgba(30,22,40,0.85)'; g.strokeText('Chorsu bozori', t[0], t[1]); g.fillStyle = '#fff3dc'; g.fillText('Chorsu bozori', t[0], t[1]); }
}
// канал Анхор с мостиками на перекрёстках
export function anhor(g, T) {
  if (Math.abs(cam.x - ANHOR.x0) > 900) return; const za = Math.max(-560, cam.z - 40), zb = Math.min(560, cam.z + 760);
  for (let j = Math.floor(za / 32); j <= Math.ceil(zb / 32); j++) { const z0 = j * 32 + 10, z1 = j * 32 + 32; if (z1 < za || z0 > zb) continue;
    if (z0 > 60 && z1 < 220) continue;   // в озеро
    groundQuad(g, ANHOR.x0 - 1.2, ANHOR.x1 + 1.2, z0, z1, '#b4a890', 0); groundQuad(g, ANHOR.x0, ANHOR.x1, z0, z1, '#3f8fb4', 0.1);
    if (Math.abs(z0 - cam.z) < 200) for (let k = 0; k < 3; k++) { const zz = z0 + 3 + ((k * 7 + T * 2.5) % 19), a = proj(ANHOR.x0 + 2 + k * 1.5, ground(zz) + 0.06, zz), b = proj(ANHOR.x0 + 3 + k * 1.5, ground(zz + 1) + 0.06, zz + 1); if (a[2] > 1) { g.strokeStyle = 'rgba(220,240,255,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    for (const rz of [j * 32 + 0.2, j * 32 + 9.8]) { const a = proj(ANHOR.x0 - 1, ground(rz) + 1, rz), b = proj(ANHOR.x1 + 1, ground(rz) + 1, rz), a0 = proj(ANHOR.x0 - 1, ground(rz), rz), b0 = proj(ANHOR.x1 + 1, ground(rz), rz); if (a[2] < 2 || a[2] > 300) continue; g.strokeStyle = '#e8e0d0'; g.lineWidth = Math.max(1, 0.15 * cam.f / a[2]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(a0[0], a0[1]); g.lineTo(a[0], a[1]); g.moveTo(b0[0], b0[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
  const t = proj((ANHOR.x0 + ANHOR.x1) / 2, ground(cam.z + 90) + 2, cam.z + 90); if (t[2] > 5 && t[2] < 300) { const fs = clamp(0.9 * cam.f / t[2], 10, 26); g.font = `900 ${fs}px Rubik`; g.textAlign = 'center'; g.lineWidth = fs / 5; g.strokeStyle = 'rgba(30,22,40,0.8)'; g.strokeText('Anhor', t[0], t[1]); g.fillStyle = '#cfefff'; g.fillText('Anhor', t[0], t[1]); }
}
// ворота махалли над поперечными улицами
export function gates() {
  const out = [], jz = Math.round(cam.z / 32), bx = Math.round((cam.x + 5) / 138);
  for (let j = jz - 1; j <= jz + 8; j++) for (let b = bx - 2; b <= bx + 2; b++) { if (b === 0 || ((j * 7 + b * 3) % 3 + 3) % 3 !== 0) continue; const x = -5 + b * 138, z = j * 32 + 21; if (x < -560 || x > 560 || z < -500 || z > 470) continue;
    const nm = rowName(j, x + 20).replace(' koʻchasi', '') + ' mahallasi'; out.push({ x: x + 5, z, nm }); }
  return out;
}
export function gate(g, q) {
  const { x, z } = q, y0 = ground(z), c = proj(x, y0, z); if (c[2] < 3 || c[2] > 260) return; const H = 6.2;
  for (const px of [x - 5.6, x + 5.6]) { box(g, px - 0.5, px + 0.5, y0, y0 + H, z - 0.5, z + 0.5, '#e8dcc4'); for (let k = 0; k < 3; k++) onFront(g, px - 0.4, y0 + 1 + k * 1.6, 0.8, 0.9, z - 0.51, '#2a7ab8', 0.1); box(g, px - 0.65, px + 0.65, y0 + H, y0 + H + 0.5, z - 0.65, z + 0.65, '#2a7ab8'); }
  box(g, x - 6.2, x + 6.2, y0 + H - 1.4, y0 + H - 0.1, z - 0.4, z + 0.4, '#2a7ab8', { topCol: '#3a8ac8' });
  for (let k = 0; k < 12; k++) onFront(g, x - 5.9 + k, y0 + H - 1.25, 0.5, 0.25, z - 0.41, k % 2 ? '#f2c94c' : '#ffffff', 0);
  const t = proj(x, y0 + H - 0.65, z - 0.42); if (t[2] < 160) { const fs = clamp(0.55 * cam.f / t[2], 6, 30); g.font = `900 ${fs}px Rubik`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText(q.nm, t[0], t[1] + fs * 0.35); }
}
export function landmark(g, q, T, lit) { if (q.kind === 'panel') panelBlock(g, q, T, lit); else if (q.kind === 'chorsu') chorsu(g, T); else if (q.kind === 'gate') gate(g, q); }
