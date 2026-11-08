// room.js — интерьер дома: уютная узбекская комната. Набор вещей зависит от уровня дома и заказа.
import { mix } from './world.js';

const H01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const hash = (str) => { let h = 7; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 100003; return h; };
const VP = [540, 870], BW = { x0: 170, x1: 910, y0: 520, y1: 1220 };
const F = (u, y) => [VP[0] + u * 370 * (y - VP[1]) / 350, y];   // точка на полу: u — поперёк (-1..1 у задней стены), y — экран
const quad = (g, P, fill, stroke, lw = 3) => { g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
const INK = '#2a1e2a';

export function roomItems(h) {
  const L = h.lvl || 1, sd = H01(hash(h.nickname)), it = ['Kurpacha va yostiqlar', 'Xontaxta', 'Choynak va piyolalar', 'Non va mevalar', 'Televizor', 'Devor gilami'];
  if (L >= 2) it.push('Konditsioner', 'Akvarium'); if (L >= 3) it.push('Oltin qandil', 'Oʻyin pristavkasi');
  if ((h.spec && h.spec.cat) || sd < 0.3) it.push('Mushuk'); return it;
}

export function drawRoom(g, h, T, night, dark) {
  const L = h.lvl || 1, seed = hash(h.nickname), sd = H01(seed), cat = (h.spec && h.spec.cat) || sd < 0.3;
  const wall = mix(h.wall || '#e8d8c0', '#fff6e8', 0.62), wallSide = mix(wall, '#6a5060', 0.12), acc = h.accent || '#c0392b';
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  // стены, потолок, пол
  quad(g, [[-120, -20], [1200, -20], [1200, 265], [910, 520], [170, 520], [-120, 265]], mix(wall, '#ffffff', 0.4));
  quad(g, [[170, 520], [170, 1220], [-120, 1495], [-120, 245]], wallSide); quad(g, [[910, 520], [910, 1220], [1200, 1495], [1200, 245]], wallSide);
  quad(g, [[BW.x0, BW.y0], [BW.x1, BW.y0], [BW.x1, BW.y1], [BW.x0, BW.y1]], wall);
  quad(g, [[170, 1220], [910, 1220], [1200, 1495], [1200, 2000], [-120, 2000], [-120, 1495]], '#b77a48');
  g.strokeStyle = 'rgba(80,40,20,0.35)'; g.lineWidth = 3; for (let k = -12; k <= 12; k++) { const u = k / 6, a = F(u, 1220), b = F(u, 2000); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
  for (const y of [1290, 1390, 1530, 1720]) { g.beginPath(); g.moveTo(-120, y); g.lineTo(1200, y); g.stroke(); }
  quad(g, [[170, 1205], [910, 1205], [910, 1220], [170, 1220]], mix(wall, INK, 0.25));   // плинтус
  g.strokeStyle = mix(wall, INK, 0.15); g.lineWidth = 2; for (const [a, b] of [[[170, 520], [-120, 265]], [[910, 520], [1200, 265]], [[170, 1220], [-120, 1495]], [[910, 1220], [1200, 1495]]]) { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  // окно с видом на улицу и атласные шторы
  const wx0 = 380, wx1 = 610, wy0 = 610, wy1 = 960, sky = g.createLinearGradient(0, wy0, 0, wy1);
  if (night) { sky.addColorStop(0, '#141a3e'); sky.addColorStop(1, '#3a3266'); } else { sky.addColorStop(0, '#5f9ad6'); sky.addColorStop(1, '#d6e8f4'); }
  quad(g, [[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1]], sky);
  if (night) { g.fillStyle = '#fff6d8'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(wx0 + 15 + H01(i + 3) * 200, wy0 + 15 + H01(i * 7) * 150, 2.5, 0, 7); g.fill(); } g.beginPath(); g.arc(wx1 - 50, wy0 + 60, 22, 0, 7); g.fill(); }
  else { g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(wx1 - 55, wy0 + 70, 26, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(wx0 + 70 + Math.sin(T * 0.2) * 20, wy0 + 90, 50, 14, 0, 0, 7); g.fill(); }
  g.fillStyle = night ? '#2a2a4a' : '#8a9ab8'; g.beginPath(); g.moveTo(wx0, wy1); for (let x = wx0; x <= wx1; x += 23) { const hh = 40 + H01(x) * 110; g.lineTo(x, wy1 - hh); g.lineTo(x + 20, wy1 - hh); } g.lineTo(wx1, wy1); g.closePath(); g.fill();
  if (night) { g.fillStyle = '#ffd890'; for (let i = 0; i < 14; i++) g.fillRect(wx0 + 8 + H01(i * 3.3) * 210, wy1 - 20 - H01(i * 5.1) * 100, 6, 8); }
  const tw = wx0 + 140; g.strokeStyle = '#c8b8a0'; g.lineWidth = 3; g.beginPath(); g.moveTo(tw, wy0 + 8); g.lineTo(tw, wy1 - 10); g.stroke();   // силуэт телебашни в окне
  const sp = [tw, wy0 + 40]; g.fillStyle = night ? '#4a4a6a' : '#9aa8c0'; g.beginPath(); g.ellipse(sp[0], sp[1] + 40, 14, 6, 0, 0, 7); g.fill();
  quad(g, [[wx0 - 12, wy0 - 12], [wx1 + 12, wy0 - 12], [wx1 + 12, wy1 + 12], [wx0 - 12, wy1 + 12]], null, '#f4ece0', 16);
  g.strokeStyle = '#f4ece0'; g.lineWidth = 8; g.beginPath(); g.moveTo((wx0 + wx1) / 2, wy0); g.lineTo((wx0 + wx1) / 2, wy1); g.moveTo(wx0, (wy0 + wy1) / 2 - 40); g.lineTo(wx1, (wy0 + wy1) / 2 - 40); g.stroke();
  quad(g, [[wx0 - 30, wy1 + 10], [wx1 + 30, wy1 + 10], [wx1 + 40, wy1 + 28], [wx0 - 40, wy1 + 28]], '#f4ece0', INK, 2);   // подоконник
  g.fillStyle = '#c0582c'; g.fillRect(wx1 - 70, wy1 - 18, 34, 30); g.fillStyle = '#4c8a3a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(wx1 - 53 + (k - 2) * 9, wy1 - 34 - (k % 2) * 10, 7, 18, (k - 2) * 0.3, 0, 7); g.fill(); }   // цветок на подоконнике
  for (const side of [-1, 1]) { const x = side < 0 ? wx0 - 30 : wx1 + 30, sw = Math.sin(T * 0.9 + side) * 8; g.save(); g.beginPath(); g.moveTo(x, wy0 - 40); g.lineTo(x - side * 70, wy0 - 40); g.quadraticCurveTo(x - side * 40 + sw, (wy0 + wy1) / 2, x - side * 30 + sw * 1.4, wy1 + 40); g.lineTo(x + side * 10, wy1 + 40); g.closePath(); g.clip();
    const cols = ['#d83a5a', '#f2c94c', '#2a7ab8', '#ffffff', '#3aa06a']; for (let i = 0; i < 26; i++) { g.fillStyle = cols[(i + (side > 0 ? 2 : 0)) % cols.length]; g.beginPath(); const y = wy0 - 40 + i * 18; g.moveTo(x - 90, y); g.lineTo(x - 50, y - 10); g.lineTo(x, y + 6); g.lineTo(x + 40, y - 8); g.lineTo(x + 40, y + 18); g.lineTo(x - 90, y + 18); g.fill(); } g.restore(); }   // атлас-икат
  g.strokeStyle = '#8a6a3a'; g.lineWidth = 7; g.beginPath(); g.moveTo(wx0 - 110, wy0 - 40); g.lineTo(wx1 + 110, wy0 - 40); g.stroke();
  if (!night && !dark) { g.fillStyle = 'rgba(255,240,200,0.16)'; g.beginPath(); g.moveTo(wx0, wy1 + 28); g.lineTo(wx1, wy1 + 28); g.lineTo(wx1 + 220, 1700); g.lineTo(wx0 + 60, 1700); g.closePath(); g.fill(); }
  // настенный гилам
  { const x0 = 655, x1 = 885, y0 = 610, y1 = 1010; quad(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], '#9a2a2e', INK, 3); quad(g, [[x0 + 14, y0 + 14], [x1 - 14, y0 + 14], [x1 - 14, y1 - 14], [x0 + 14, y1 - 14]], null, '#f2c94c', 6);
    quad(g, [[x0 + 26, y0 + 26], [x1 - 26, y0 + 26], [x1 - 26, y1 - 26], [x0 + 26, y1 - 26]], '#b8343a'); const cx = (x0 + x1) / 2;
    for (const [cy, r] of [[y0 + 110, 46], [(y0 + y1) / 2, 62], [y1 - 110, 46]]) { quad(g, [[cx, cy - r], [cx + r * 0.8, cy], [cx, cy + r], [cx - r * 0.8, cy]], '#1f3a6a', '#f2c94c', 3); quad(g, [[cx, cy - r * 0.45], [cx + r * 0.36, cy], [cx, cy + r * 0.45], [cx - r * 0.36, cy]], '#f4ece0'); }
    g.strokeStyle = '#f4ece0'; g.lineWidth = 2; for (let x = x0 + 4; x < x1; x += 10) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y1 + 12); g.stroke(); } }
  // часы с настоящим временем
  { const cx = 495, cy = 565 + 0, r = 30, d = new Date(); g.fillStyle = '#f4ece0'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
    const hand = (a, l, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); g.stroke(); }; hand((d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, 15, 4); hand(d.getMinutes() / 60 * Math.PI * 2, 23, 3); g.strokeStyle = '#c0392b'; hand((d.getSeconds() + d.getMilliseconds() / 1000) / 60 * Math.PI * 2, 25, 1.5); }
  // фото в рамке: свой дом и ник
  { const x0 = 205, y0 = 640, w = 130, hh = 110; quad(g, [[x0, y0], [x0 + w, y0], [x0 + w, y0 + hh], [x0, y0 + hh]], '#fff8ec', '#8a6a3a', 8); g.fillStyle = '#9ad0ea'; g.fillRect(x0 + 10, y0 + 10, w - 20, hh - 40); g.fillStyle = h.wall || '#e8d8c0'; g.fillRect(x0 + 40, y0 + 42, 50, 28); g.fillStyle = h.roof || '#753d92'; g.beginPath(); g.moveTo(x0 + 34, y0 + 44); g.lineTo(x0 + 65, y0 + 22); g.lineTo(x0 + 96, y0 + 44); g.fill(); g.fillStyle = INK; g.font = '800 15px Rubik, sans-serif'; g.textAlign = 'center'; g.fillText(h.nickname.length > 14 ? h.nickname.slice(0, 13) + '…' : h.nickname, x0 + w / 2, y0 + hh - 10); }
  // кондиционер
  if (L >= 2) { quad(g, [[640, 545], [900, 545], [900, 598], [640, 598]], '#f4f6f8', INK, 3); g.strokeStyle = '#b8c0c8'; g.lineWidth = 2; g.beginPath(); g.moveTo(655, 586); g.lineTo(885, 586); g.stroke(); g.fillStyle = '#3ac06a'; g.beginPath(); g.arc(880, 560, 4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(170,220,255,0.6)'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { const ph = (T * 0.8 + k * 0.25) % 1; g.globalAlpha = 1 - ph; g.beginPath(); g.moveTo(680 + k * 55, 605 + ph * 60); g.quadraticCurveTo(695 + k * 55, 615 + ph * 60, 680 + k * 55, 630 + ph * 60); g.stroke(); } g.globalAlpha = 1; }
  // люстра / лампа
  g.save(); g.translate(0, 150); g.scale(1, 1);
  if (L >= 3) { g.strokeStyle = '#c9961e'; g.lineWidth = 4; g.beginPath(); g.moveTo(540, -100); g.lineTo(540, 230); g.stroke(); g.fillStyle = '#e8b931'; g.beginPath(); g.ellipse(540, 250, 120, 26, 0, 0, 7); g.fill(); g.strokeStyle = '#8a6410'; g.lineWidth = 3; g.stroke();
    for (let k = 0; k < 9; k++) { const x = 440 + k * 25, y = 285 + Math.abs(k - 4) * -4; g.strokeStyle = '#f2e6b0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 262); g.lineTo(x, y); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.moveTo(x, y + 18); g.lineTo(x - 6, y + 6); g.lineTo(x, y - 2); g.lineTo(x + 6, y + 6); g.fill(); }
    for (let k = 0; k < 5; k++) { g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(470 + k * 35, 236, 9, 0, 7); g.fill(); } }
  else { g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(540, -100); g.lineTo(540, 250); g.stroke(); g.fillStyle = acc; g.beginPath(); g.moveTo(490, 300); g.lineTo(590, 300); g.lineTo(565, 250); g.lineTo(515, 250); g.closePath(); g.fill(); g.strokeStyle = INK; g.stroke(); g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(540, 302, 13, 0, Math.PI); g.fill(); }
  g.restore();
  // тумба и телевизор (на 3 уровне — большой и с приставкой)
  { const big = L >= 3, x0 = big ? 150 : 175, x1 = big ? 380 : 345, ty0 = big ? 960 : 1010, ty1 = 1125;
    quad(g, [[150, 1150], [380, 1150], [380, 1260], [150, 1260]], '#6a4428', INK, 3); quad(g, [[150, 1140], [380, 1140], [380, 1155], [150, 1155]], '#8a5a34', INK, 2); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(265, 1160); g.lineTo(265, 1255); g.stroke();
    quad(g, [[250, ty1], [280, ty1], [290, 1140], [240, 1140]], '#2a2a32'); quad(g, [[x0, ty0], [x1, ty0], [x1, ty1], [x0, ty1]], '#141418', INK, 3);
    const ch = Math.floor(T / 3) % 3, scr = [[x0 + 8, ty0 + 8], [x1 - 8, ty0 + 8], [x1 - 8, ty1 - 8], [x0 + 8, ty1 - 8]], gr = g.createLinearGradient(0, ty0, 0, ty1);
    if (dark) gr.addColorStop(0, '#202028'), gr.addColorStop(1, '#101014'); else if (ch === 0) { gr.addColorStop(0, '#5ab0e8'); gr.addColorStop(0.6, '#a8dcf0'); gr.addColorStop(0.61, '#4caa4c'); gr.addColorStop(1, '#3a8a3a'); } else if (ch === 1) { gr.addColorStop(0, '#f28a3a'); gr.addColorStop(1, '#c03a5a'); } else { gr.addColorStop(0, '#2a2a6a'); gr.addColorStop(1, '#6a3a9a'); }
    quad(g, scr, gr); if (!dark) { if (ch === 0) { const bx = x0 + 30 + ((T * 60) % (x1 - x0 - 60)); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, ty1 - 30 - Math.abs(Math.sin(T * 4)) * 25, 7, 0, 7); g.fill(); } else if (ch === 1) { g.fillStyle = '#fff3c8'; g.font = `900 ${big ? 34 : 26}px Rubik, sans-serif`; g.textAlign = 'center'; g.fillText('UYLA TV', (x0 + x1) / 2, (ty0 + ty1) / 2 + 10); } else { g.fillStyle = '#f2c94c'; for (let k = 0; k < 5; k++) { const hh = (H01(k + Math.floor(T * 3)) * 0.8 + 0.2) * (ty1 - ty0 - 40); g.fillRect(x0 + 20 + k * (x1 - x0 - 40) / 5, ty1 - 14 - hh, 14, hh); } } }
    if (big) { quad(g, [[290, 1170], [360, 1170], [360, 1196], [290, 1196]], '#f4f4f6', INK, 2); g.fillStyle = '#3a8ae0'; g.fillRect(296, 1181, 20, 3); } }
  // курпачи вдоль стены и подушки
  { const x0 = 420, x1 = L >= 2 ? 770 : 900; quad(g, [[x0 - 10, 1185], [x1 + 10, 1185], [x1 + 30, 1262], [x0 - 30, 1262]], '#7a2a3a', INK, 3);
    const cols = ['#d83a5a', '#f2c94c', '#2a7ab8', '#3aa06a', '#ffffff']; g.save(); g.beginPath(); g.moveTo(x0 - 10, 1185); g.lineTo(x1 + 10, 1185); g.lineTo(x1 + 30, 1262); g.lineTo(x0 - 30, 1262); g.closePath(); g.clip();
    for (let k = 0; k < 28; k++) { g.fillStyle = cols[k % cols.length]; const x = x0 - 40 + k * 20; g.beginPath(); g.moveTo(x, 1185); g.lineTo(x + 10, 1222); g.lineTo(x, 1262); g.lineTo(x + 12, 1262); g.lineTo(x + 22, 1222); g.lineTo(x + 12, 1185); g.fill(); } g.restore();
    quad(g, [[x0 - 10, 1185], [x1 + 10, 1185], [x1 + 30, 1262], [x0 - 30, 1262]], null, INK, 3);
    for (let k = 0; k < (L >= 2 ? 3 : 4); k++) { const cx = x0 + 50 + k * 125; g.fillStyle = ['#2a7ab8', '#f2c94c', '#d83a5a', '#3aa06a'][(k + seed) % 4]; g.beginPath(); g.roundRect(cx - 48, 1110, 96, 82, 26); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 30, 1150); g.lineTo(cx + 30, 1150); g.stroke(); } }
  // кот на курпаче
  if (cat) { const cx = L >= 2 ? 680 : 790, cy = 1192, tail = Math.sin(T * 2.2) * 0.5; g.fillStyle = ['#e08a3a', '#3a3a42', '#f4f0e8', '#9a8a7a'][seed % 4]; g.beginPath(); g.ellipse(cx, cy, 46, 26, 0, 0, 7); g.fill(); g.beginPath(); g.arc(cx - 46, cy - 14, 22, 0, 7); g.fill();
    g.beginPath(); g.moveTo(cx - 62, cy - 26); g.lineTo(cx - 60, cy - 50); g.lineTo(cx - 46, cy - 34); g.moveTo(cx - 40, cy - 34); g.lineTo(cx - 30, cy - 50); g.lineTo(cx - 28, cy - 26); g.fill();
    g.strokeStyle = g.fillStyle; g.lineWidth = 11; g.beginPath(); g.moveTo(cx + 40, cy + 6); g.quadraticCurveTo(cx + 85, cy - 10 + tail * 30, cx + 70 + tail * 30, cy - 40); g.stroke();
    g.strokeStyle = INK; g.lineWidth = 2.5; const bl = (T % 4) < 0.15; g.beginPath(); if (bl) { g.moveTo(cx - 56, cy - 14); g.lineTo(cx - 48, cy - 14); g.moveTo(cx - 42, cy - 14); g.lineTo(cx - 34, cy - 14); } else { g.arc(cx - 52, cy - 15, 3, 0, 7); g.moveTo(cx - 35, cy - 15); g.arc(cx - 38, cy - 15, 3, 0, 7); } g.stroke(); }
  // хозяин машет из-за стола
  if (!dark) { const px = 610, py = 1300, s = 1.45, shirt = ['#e0503a', '#3a7bd5', '#f2c94c', '#27ae60', '#8e44ad', '#ec6fa0'][seed % 6], skin = '#f0c8a0', wv = Math.sin(T * 6) * 0.45;
    g.fillStyle = shirt; g.beginPath(); g.roundRect(px - 52 * s, py - 190 * s, 104 * s, 120 * s, 30 * s); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    g.strokeStyle = skin; g.lineWidth = 22 * s; g.beginPath(); g.moveTo(px + 44 * s, py - 172 * s); g.lineTo(px + 82 * s, py - 215 * s); g.lineTo(px + 82 * s + Math.sin(wv) * 40 * s, py - 265 * s); g.stroke(); g.fillStyle = skin; g.beginPath(); g.arc(px + 82 * s + Math.sin(wv) * 44 * s, py - 272 * s, 15 * s, 0, 7); g.fill();
    g.beginPath(); g.arc(px, py - 228 * s, 40 * s, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = ['#2a1c18', '#4a3020', '#1a1418'][seed % 3]; g.beginPath(); g.arc(px, py - 238 * s, 41 * s, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    if (seed % 2) { g.fillStyle = '#1a1a22'; g.fillRect(px - 32 * s, py - 282 * s, 64 * s, 22 * s); g.strokeStyle = '#f0f0f0'; g.lineWidth = 3; for (const d of [-14, 6]) { g.beginPath(); g.moveTo(px + d * s, py - 263 * s); g.lineTo(px + (d + 8) * s, py - 278 * s); g.stroke(); } }
    g.fillStyle = INK; g.beginPath(); g.arc(px - 14 * s, py - 228 * s, 4 * s, 0, 7); g.arc(px + 14 * s, py - 228 * s, 4 * s, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(px, py - 216 * s, 13 * s, 0.2, Math.PI - 0.2); g.stroke(); }
  // большой ковёр на полу
  { const P = [F(-0.95, 1300), F(0.95, 1300), F(0.95, 1780), F(-0.95, 1780)]; quad(g, P, '#a8282e', INK, 3); const P2 = [F(-0.82, 1325), F(0.82, 1325), F(0.82, 1745), F(-0.82, 1745)]; quad(g, P2, null, '#f2c94c', 8); const P3 = [F(-0.74, 1345), F(0.74, 1345), F(0.74, 1720), F(-0.74, 1720)]; quad(g, P3, '#c03a3e');
    for (const [u, y] of [[-0.45, 1420], [0.45, 1420], [-0.45, 1650], [0.45, 1650], [0, 1535]]) { const c = F(u, y), sc = (y - VP[1]) / 350, r = 34 * sc; quad(g, [[c[0], c[1] - r * 0.6], [c[0] + r, c[1]], [c[0], c[1] + r * 0.6], [c[0] - r, c[1]]], '#1f3a6a', '#f2c94c', 3); } }
  // хонтахта с дастарханом: чайник, пиалы, нон, фрукты
  { const ty = 1400, P = [F(-0.5, 1360), F(0.5, 1360), F(0.52, 1460), F(-0.52, 1460)].map(([x, y]) => [x, y - 70]);
    for (const [u, y] of [[-0.45, 1450], [0.45, 1450], [-0.42, 1375], [0.42, 1375]]) { const a = F(u, y); g.fillStyle = '#5a3420'; g.fillRect(a[0] - 9, a[1] - 72, 18, 72); }
    quad(g, P, '#7a4a2a', INK, 3); quad(g, [P[3], P[2], [P[2][0], P[2][1] + 16], [P[3][0], P[3][1] + 16]], '#5a3420', INK, 3);
    const D = [[P[0][0] + 30, P[0][1] + 6], [P[1][0] - 30, P[1][1] + 6], [P[2][0] - 20, P[2][1] + 4], [P[3][0] + 20, P[3][1] + 4]]; quad(g, D, '#fff8ec', '#d83a5a', 4);
    const tp = [P[0][0] + 120, ty - 10]; g.fillStyle = '#f4f6fa'; g.beginPath(); g.ellipse(tp[0], tp[1], 38, 30, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = '#2a6ab8'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(tp[0] - 22 + k * 11, tp[1] + (k % 2) * 8 - 2, 5, 0, 7); g.fill(); }
    g.strokeStyle = '#f4f6fa'; g.lineWidth = 8; g.beginPath(); g.moveTo(tp[0] + 34, tp[1] - 2); g.quadraticCurveTo(tp[0] + 60, tp[1] - 12, tp[0] + 64, tp[1] - 30); g.stroke(); g.fillStyle = '#f4f6fa'; g.beginPath(); g.ellipse(tp[0], tp[1] - 32, 14, 6, 0, 0, 7); g.fill();
    for (const [dx, dy] of [[-70, 24], [115, 28], [190, 6]]) { const c = [tp[0] + dx, tp[1] + dy]; g.fillStyle = '#f4f6fa'; g.beginPath(); g.moveTo(c[0] - 18, c[1] - 10); g.lineTo(c[0] + 18, c[1] - 10); g.quadraticCurveTo(c[0] + 14, c[1] + 12, c[0], c[1] + 12); g.quadraticCurveTo(c[0] - 14, c[1] + 12, c[0] - 18, c[1] - 10); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.fillStyle = '#b8682a'; g.beginPath(); g.ellipse(c[0], c[1] - 9, 16, 4, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 3; for (let k = 0; k < 2; k++) { const ph = (T * 0.6 + k * 0.5 + dx * 0.01) % 1; g.globalAlpha = 1 - ph; g.beginPath(); g.moveTo(c[0] - 4 + k * 8, c[1] - 14 - ph * 50); g.quadraticCurveTo(c[0] + 6 + k * 8 + Math.sin(T * 3 + k) * 6, c[1] - 30 - ph * 50, c[0] - 2 + k * 8, c[1] - 46 - ph * 50); g.stroke(); } g.globalAlpha = 1; }
    const nb = [P[1][0] - 120, ty + 18]; g.fillStyle = '#d89a4a'; g.beginPath(); g.ellipse(nb[0], nb[1], 62, 30, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); g.fillStyle = '#f0c27a'; g.beginPath(); g.ellipse(nb[0], nb[1], 34, 16, 0, 0, 7); g.fill(); g.fillStyle = '#8a5a2a'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.beginPath(); g.arc(nb[0] + Math.cos(a) * 22, nb[1] + Math.sin(a) * 10, 2.5, 0, 7); g.fill(); }   // нон с узором
    const fr = [540, ty + 30]; g.fillStyle = '#e8e0d0'; g.beginPath(); g.ellipse(fr[0], fr[1] + 8, 58, 18, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.fillStyle = '#c03a4a'; g.beginPath(); g.arc(fr[0] + 18, fr[1] - 8, 20, 0, 7); g.fill(); g.fillStyle = '#7a1a2a'; g.fillRect(fr[0] + 14, fr[1] - 32, 8, 8);
    g.fillStyle = '#7ab048'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(fr[0] - 26 + (k % 3) * 11 + (Math.floor(k / 3) % 2) * 5, fr[1] - 2 - Math.floor(k / 3) * 9, 7, 0, 7); g.fill(); } }
  // аквариум с рыбками
  if (L >= 2) { const x0 = 790, x1 = 905, y0 = 1060, y1 = 1170; quad(g, [[x0 - 6, y1], [x1 + 6, y1], [x1 + 6, 1262], [x0 - 6, 1262]], '#5a3420', INK, 3); const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#9ad8f0'); gr.addColorStop(1, '#3a8ab8'); quad(g, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], gr, INK, 4);
    g.fillStyle = '#e8d098'; g.fillRect(x0 + 3, y1 - 16, x1 - x0 - 6, 13); g.fillStyle = '#3a9a4a'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x0 + 25 + k * 45, y1 - 40, 6, 28 + Math.sin(T * 2 + k) * 4, Math.sin(T + k) * 0.15, 0, 7); g.fill(); }
    for (let k = 0; k < 4; k++) { const ph = (T * (0.12 + k * 0.03) + k * 0.3) % 2, dir = ph < 1 ? 1 : -1, fx = x0 + 18 + (ph < 1 ? ph : 2 - ph) * (x1 - x0 - 36), fy = y0 + 35 + k * 22 + Math.sin(T * 2 + k) * 6; g.fillStyle = ['#f28a3a', '#f2c94c', '#e05a7a', '#5ad0e0'][k]; g.beginPath(); g.ellipse(fx, fy, 12, 7, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(fx - dir * 10, fy); g.lineTo(fx - dir * 20, fy - 7); g.lineTo(fx - dir * 20, fy + 7); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < 4; k++) { const ph = (T * 0.5 + k * 0.25) % 1; g.beginPath(); g.arc(x1 - 25 + Math.sin(T * 3 + k) * 3, y1 - 20 - ph * (y1 - y0 - 30), 3 + k % 2, 0, 7); g.fill(); } }
  else { const c = [905, 1290]; quad(g, [[c[0] - 48, c[1] - 70], [c[0] + 48, c[1] - 70], [c[0] + 36, c[1]], [c[0] - 36, c[1]]], '#c0582c', INK, 3); g.fillStyle = '#4c8a3a'; for (let k = 0; k < 9; k++) { g.beginPath(); g.ellipse(c[0] + (k - 4) * 14 + Math.sin(T + k) * 3, c[1] - 120 - (k % 3) * 40, 16, 50, (k - 4) * 0.22, 0, 7); g.fill(); } }   // фикус
  if (L >= 3) { const c = [700, 1640]; g.fillStyle = '#1e1e26'; g.beginPath(); g.roundRect(c[0] - 46, c[1] - 22, 92, 44, 20); g.fill(); g.fillStyle = '#e05a5a'; g.beginPath(); g.arc(c[0] + 22, c[1] - 4, 6, 0, 7); g.fill(); g.fillStyle = '#5ad0e0'; g.beginPath(); g.arc(c[0] - 22, c[1] - 4, 7, 0, 7); g.fill(); }   // геймпад на ковре
  // свет: ночью тёплый круг от лампы, тёмный дом — темнота
  if (dark) { g.fillStyle = 'rgba(10,8,24,0.78)'; g.fillRect(-200, -100, 1500, 2200); }
  else if (night) { g.fillStyle = 'rgba(30,26,70,0.28)'; g.fillRect(-200, -100, 1500, 2200); const gr = g.createRadialGradient(540, 450, 20, 540, 800, 1100); gr.addColorStop(0, 'rgba(255,214,140,0.45)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.fillRect(-200, -100, 1500, 2200); }
  g.restore();
}
