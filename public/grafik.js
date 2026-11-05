'use strict';
/* =========================================================================
   Taddelvillage – 3D-Grafik mit Three.js.
   Alle Modelle sind aus einfachen Formen gebaut (keine Modelldateien).
   Spielfeld: Feld (x, y) liegt in der Welt bei (x, 0, y), 1 Einheit = 1 Feld.
   ========================================================================= */
window.TVG = (() => {
const T3 = window.THREE;
const SPIELER = '#2f7bf6', GEGNER = '#d63c2f';
let N = 36, renderer, szene, kamera, sonne, cv, ov, o2, W = 1, H = 1, zeit = 0;
const ziel = new T3.Vector3(18, 0, 18);
const THETA = Math.PI / 4, PHI = 0.9, FOV = 34;
let abstand = 30;
const ray = new T3.Raycaster(), boden0 = new T3.Plane(new T3.Vector3(0, 1, 0), 0), tmpV = new T3.Vector3(), tmpV2 = new T3.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function zufall(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------------------------------------------------------- Bausteine */
const matCache = new Map(), geoCache = new Map();
function mat(farbe, o) {
  o = o || {};
  const k = farbe + '|' + (o.r ?? '') + (o.m ?? '') + (o.e ?? '') + (o.ei ?? '') + (o.a ?? '') + (o.glatt ? 'g' : '');
  let m = matCache.get(k);
  if (!m) {
    m = new T3.MeshStandardMaterial({ color: farbe, roughness: o.r ?? 0.85, metalness: o.m ?? 0, flatShading: !o.glatt,
      emissive: o.e || '#000000', emissiveIntensity: o.ei ?? 1, transparent: o.a != null, opacity: o.a ?? 1 });
    matCache.set(k, m);
  }
  return m;
}
const GOLD = { m: 0.75, r: 0.32 }, METALL = { m: 0.6, r: 0.4 };
function geo(art, ...p) {
  const k = art + p.join(',');
  let g = geoCache.get(k);
  if (!g) { g = new T3[art](...p); geoCache.set(k, g); }
  return g;
}
function prisma(b, h, l) {   // Satteldach: Grundbreite b (z), Höhe h, Länge l (x)
  const k = 'prisma' + b + ',' + h + ',' + l;
  let g = geoCache.get(k);
  if (!g) {
    const s = new T3.Shape(); s.moveTo(-b / 2, 0); s.lineTo(b / 2, 0); s.lineTo(0, h); s.closePath();
    g = new T3.ExtrudeGeometry(s, { depth: l, bevelEnabled: false });
    g.translate(0, 0, -l / 2); g.rotateY(Math.PI / 2); geoCache.set(k, g);
  }
  return g;
}
function teil(gr, g, m, x, y, z, rx, ry, rz) {
  const me = new T3.Mesh(g, m);
  me.position.set(x || 0, y || 0, z || 0);
  if (rx || ry || rz) me.rotation.set(rx || 0, ry || 0, rz || 0);
  me.castShadow = true; me.receiveShadow = true;
  gr.add(me); return me;
}
// Quader mit Unterkante auf y
const kiste = (gr, w, h, d, f, x, y, z, o, ry) => teil(gr, geo('BoxGeometry', w, h, d), mat(f, o), x, (y || 0) + h / 2, z, 0, ry || 0, 0);
// Zylinder mit Unterkante auf y
const walze = (gr, rt, rb, h, seg, f, x, y, z, o) => teil(gr, geo('CylinderGeometry', rt, rb, h, seg), mat(f, o), x, (y || 0) + h / 2, z);
const kegel = (gr, r, h, seg, f, x, y, z, ry, o) => teil(gr, geo('ConeGeometry', r, h, seg), mat(f, o), x, (y || 0) + h / 2, z, 0, ry || 0, 0);
const kugel = (gr, r, f, x, y, z, o, seg) => teil(gr, geo('SphereGeometry', r, seg || 10, Math.max(6, (seg || 10) - 3)), mat(f, o), x, y, z);
const brocken = (gr, r, f, x, y, z, o) => teil(gr, geo('DodecahedronGeometry', r, 0), mat(f, o), x, y, z);
const walmdach = (gr, seite, h, f, y, o) => teil(gr, geo('ConeGeometry', seite / Math.SQRT2, h, 4), mat(f, o), 0, y + h / 2, 0, 0, Math.PI / 4, 0);
const satteldach = (gr, b, h, l, f, x, y, z) => teil(gr, prisma(b, h, l), mat(f), x, y, z);
function fenster(gr, x, y, z, seite) {   // seite: 'z' = Vorderseite (+z), 'x' = rechte Seite (+x)
  const glas = { e: '#ffcf5a', ei: 0.55 };
  if (seite === 'z') { kiste(gr, 0.3, 0.34, 0.05, '#ffe9a0', x, y, z, glas); kiste(gr, 0.4, 0.06, 0.08, '#5a3a1d', x, y - 0.04, z + 0.01); }
  else { kiste(gr, 0.05, 0.34, 0.3, '#ffe9a0', x, y, z, glas); kiste(gr, 0.08, 0.06, 0.4, '#5a3a1d', x + 0.01, y - 0.04, z); }
}
function stil(lvl) {
  return { sockel: lvl >= 7 ? '#5f646b' : lvl >= 3 ? '#a2a7ad' : '#93653a', dunkel: '#5a3a1d', putz: lvl >= 5 ? '#f4ead2' : '#e3cfa6', gold: lvl >= 5, edel: lvl >= 7 };
}
function fahne(gr, x, y, z, farbe, h) {
  walze(gr, 0.03, 0.03, h, 5, '#4a3020', x, y, z);
  const f = kiste(gr, 0.45, 0.28, 0.03, farbe, x + 0.23, y + h - 0.3, z);
  gr.userData.fahnen = gr.userData.fahnen || []; gr.userData.fahnen.push(f);
}

/* ---------------------------------------------------------------- Gebäude-Modelle */
const MODELL = {
  rathaus(g, lvl, team) {
    const st = stil(lvl), wH = 1.45 + Math.min(lvl, 8) * 0.07, dH = 1.45 + lvl * 0.05;
    kiste(g, 3.5, 0.32, 3.5, st.sockel, 0, 0, 0);
    kiste(g, 1.1, 0.16, 0.45, '#8a8f94', 0, 0, 1.9);
    kiste(g, 2.7, wH, 2.7, st.putz, 0, 0.32, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kiste(g, 0.18, wH, 0.18, st.dunkel, x * 1.33, 0.32, z * 1.33);
    kiste(g, 2.78, 0.12, 2.78, st.dunkel, 0, 0.32 + wH * 0.5, 0);
    kiste(g, 2.84, 0.14, 2.84, st.gold ? '#f2c230' : st.dunkel, 0, 0.32 + wH - 0.08, 0, st.gold ? GOLD : null);
    kiste(g, 0.62, 0.9, 0.06, '#4a2c14', 0, 0.32, 1.36);
    kiste(g, 0.8, 0.1, 0.1, st.dunkel, 0, 0.32 + 0.9, 1.38);
    for (const x of [-0.85, 0.85]) { fenster(g, x, 0.32 + wH * 0.25, 1.37, 'z'); fenster(g, 1.37, 0.32 + wH * 0.25, x, 'x'); fenster(g, x, 0.32 + wH * 0.68, 1.37, 'z'); fenster(g, 1.37, 0.32 + wH * 0.68, x, 'x'); }
    fenster(g, 1.37, 0.32 + wH * 0.68, 0, 'x');
    const dach = st.edel ? '#3d3f8f' : '#c0392b';
    walmdach(g, 3.3, dH, dach, 0.32 + wH);
    kiste(g, 0.32, 0.9, 0.32, '#8a8f94', 0.65, 0.32 + wH + 0.2, -0.6);
    const top = 0.32 + wH + dH;
    if (st.gold) kugel(g, 0.13, '#f2c230', 0, top, 0, GOLD);
    fahne(g, 0, top - 0.05, 0, team, 1.0);
    // Laternen und Fässer
    for (const x of [-0.5, 0.5]) { walze(g, 0.03, 0.03, 0.7, 5, '#333', x, 0.32, 1.6); kiste(g, 0.12, 0.14, 0.12, '#ffd86b', x, 1.0, 1.6, { e: '#ffb52e', ei: 0.9 }); }
    walze(g, 0.16, 0.18, 0.35, 8, '#7a5230', -1.55, 0.32, 1.4); walze(g, 0.16, 0.18, 0.35, 8, '#7a5230', -1.55, 0.32, 1.0);
    g.userData.hoehe = top + 0.5;
  },
  goldmine(g, lvl) {
    walze(g, 1.4, 1.45, 0.08, 12, '#8a6b45', 0, 0, 0);
    const f = brocken(g, 1.0, '#8d7f72', -0.35, 0.5, -0.35); f.scale.set(1.2, 0.9, 1.2);
    const f2 = brocken(g, 0.6, '#7d7064', 0.55, 0.3, -0.75); f2.scale.set(1, 0.8, 1);
    const r = zufall(7);
    for (let i = 0; i < 6 + lvl; i++) { const a = r() * 2.5 + 0.2, h = 0.35 + r() * 0.7; brocken(g, 0.08 + r() * 0.06, '#f2c230', -0.35 + Math.cos(a) * 1.0, h, -0.35 + Math.sin(a) * 1.0, GOLD); }
    const e = new T3.Group(); e.position.set(0.2, 0, 0.2); e.rotation.y = Math.PI / 4; g.add(e);
    kiste(e, 0.6, 0.78, 0.12, '#1b120b', 0, 0.08, 0.0);
    kiste(e, 0.14, 0.95, 0.16, '#6b4423', -0.37, 0.08, 0.04); kiste(e, 0.14, 0.95, 0.16, '#6b4423', 0.37, 0.08, 0.04);
    kiste(e, 0.95, 0.15, 0.2, '#6b4423', 0, 0.98, 0.04);
    for (const x of [-0.16, 0.16]) kiste(e, 0.05, 0.04, 1.2, '#555', x, 0.08, 0.65, METALL);
    const w = new T3.Group(); w.position.set(0, 0.12, 0.85); e.add(w);
    kiste(w, 0.42, 0.26, 0.5, '#7a5230', 0, 0.06, 0);
    for (const [x, z] of [[-0.22, -0.15], [0.22, -0.15], [-0.22, 0.15], [0.22, 0.15]]) teil(w, geo('CylinderGeometry', 0.07, 0.07, 0.04, 8), mat('#333'), x, 0.06, z, 0, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) brocken(w, 0.07, '#f2c230', (i % 3 - 1) * 0.11, 0.36, (i < 3 ? -0.08 : 0.1), GOLD);
    walze(g, 0.03, 0.03, 0.9, 5, '#4a3020', 1.1, 0.08, 0.3); kiste(g, 0.12, 0.15, 0.12, '#ffd86b', 1.1, 0.95, 0.3, { e: '#ffb52e', ei: 0.9 });
    g.userData.hoehe = 1.8;
  },
  saegewerk(g, lvl) {
    kiste(g, 2.5, 0.18, 2.5, '#a0703f', 0, 0, 0);
    for (const [x, z] of [[-1.05, -0.8], [1.05, -0.8], [-1.05, 0.8], [1.05, 0.8]]) kiste(g, 0.14, 1.25, 0.14, '#6b4423', x, 0.18, z);
    satteldach(g, 2.0, 0.75, 2.6, lvl >= 5 ? '#2f6f9f' : '#4f7a2a', 0, 1.43, 0);
    kiste(g, 1.5, 0.45, 0.5, '#7a5230', 0, 0.18, 0.1);
    const blatt = teil(g, geo('CylinderGeometry', 0.42, 0.42, 0.04, 20), mat('#d5dade', METALL), 0, 0.8, 0.1, 0, 0, Math.PI / 2);
    g.userData.dreh = [{ m: blatt, achse: 'y', v: 7 }];
    teil(g, geo('CylinderGeometry', 0.17, 0.17, 1.3, 9), mat('#8b5a2b'), -0.35, 0.8, 0.45, 0, 0, Math.PI / 2);
    let n = 0;
    for (let reihe = 0; reihe < 3; reihe++) for (let i = 0; i < 3 - reihe; i++) { n++; teil(g, geo('CylinderGeometry', 0.17, 0.17, 1.8, 9), mat(n % 2 ? '#8b5a2b' : '#7b4f25'), 0, 0.35 + reihe * 0.3, -0.75 + (i - (2 - reihe) / 2) * 0.35 + 0.0, 0, 0, Math.PI / 2); }
    kegel(g, 0.35, 0.25, 7, '#e3c48f', 0.85, 0.18, 0.85);
    g.userData.hoehe = 2.3;
  },
  goldtruhe(g, lvl) {
    const st = stil(lvl);
    kiste(g, 2.5, 0.28, 2.5, st.sockel, 0, 0, 0);
    kiste(g, 1.9, 1.05, 1.9, '#a39a8a', 0, 0.28, 0);
    kiste(g, 1.96, 0.1, 1.96, '#f2c230', 0, 0.28 + 0.85, 0, GOLD);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kiste(g, 0.22, 1.2, 0.22, '#8a8378', x * 0.92, 0.28, z * 0.92);
    walmdach(g, 2.2, 0.9, '#e8b923', 1.33, GOLD);
    kiste(g, 0.62, 0.75, 0.06, '#5a3a1d', 0, 0.28, 0.96);
    for (const y of [0.45, 0.78]) kiste(g, 0.64, 0.05, 0.07, '#f2c230', 0, 0.28 + y, 0.97, GOLD);
    for (const [x, z, h] of [[1.05, 1.05, 0.3], [-1.05, 1.05, 0.2], [1.05, -0.4, 0.25]]) { walze(g, 0.14, 0.14, h, 10, '#f2c230', x, 0.28, z, GOLD); }
    g.userData.hoehe = 2.6;
  },
  holzlager(g, lvl) {
    kiste(g, 2.5, 0.15, 2.5, '#7a5230', 0, 0, 0);
    for (const [x, z] of [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]]) kiste(g, 0.15, 1.35, 0.15, '#6b4423', x, 0.15, z);
    satteldach(g, 2.6, 0.75, 2.6, lvl >= 5 ? '#2e5f8a' : '#6d8f3a', 0, 1.5, 0);
    for (let reihe = 0; reihe < 3; reihe++) for (let i = 0; i < 5 - reihe; i++)
      teil(g, geo('CylinderGeometry', 0.18, 0.18, 1.9, 9), mat((i + reihe) % 2 ? '#8b5a2b' : '#9c6835'), 0, 0.33 + reihe * 0.31, (i - (4 - reihe) / 2) * 0.37, 0, 0, Math.PI / 2);
    g.userData.hoehe = 2.4;
  },
  baumeister(g) {
    kiste(g, 1.25, 0.8, 1.1, '#c49a6c', 0, 0, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kiste(g, 0.1, 0.8, 0.1, '#6b4423', x * 0.6, 0, z * 0.53);
    walmdach(g, 1.55, 0.8, '#3d7bd9', 0.8);
    kiste(g, 0.36, 0.55, 0.05, '#4a2c14', 0, 0, 0.56);
    fenster(g, 0.63, 0.45, 0, 'x');
    for (let i = 0; i < 3; i++) kiste(g, 0.7, 0.07, 0.18, '#c8a06a', 0.55, i * 0.07, -0.62 + (i % 2) * 0.05, null, 0.1 * i);
    kiste(g, 0.25, 0.25, 0.25, '#8b5a2b', -0.7, 0, 0.55);
    g.userData.hoehe = 1.9;
  },
  kaserne(g, lvl, team) {
    const st = stil(lvl);
    kiste(g, 2.6, 0.22, 2.6, st.sockel, 0, 0, 0);
    kiste(g, 2.1, 1.0, 1.6, st.putz, 0, 0.22, -0.2);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kiste(g, 0.15, 1.0, 0.15, st.dunkel, x * 1.02, 0.22, -0.2 + z * 0.78);
    satteldach(g, 1.95, 0.8, 2.35, '#8e2f2f', 0, 1.22, -0.2);
    kiste(g, 0.55, 0.75, 0.06, '#4a2c14', 0, 0.22, 0.62);
    fenster(g, -0.65, 0.6, 0.62, 'z'); fenster(g, 0.65, 0.6, 0.62, 'z'); fenster(g, 1.06, 0.6, -0.2, 'x');
    for (const x of [-1.1, 1.1]) { walze(g, 0.04, 0.04, 1.5, 5, '#4a3020', x, 0.22, 1.05); kiste(g, 0.32, 0.55, 0.03, team, x, 1.05, 1.07); kegel(g, 0.06, 0.12, 4, '#f2c230', x, 1.72, 1.05, 0, GOLD); }
    walze(g, 0.05, 0.05, 0.75, 5, '#6b4423', 0.75, 0.22, 1.0); kugel(g, 0.17, '#d9b45a', 0.75, 1.1, 1.0); kiste(g, 0.5, 0.06, 0.06, '#d9b45a', 0.75, 0.85, 1.0);
    for (let i = 0; i < 3; i++) teil(g, geo('BoxGeometry', 0.04, 1.2, 0.04), mat('#7a5230'), -0.55 + i * 0.12, 0.8, 1.0, 0.25, 0, 0);
    g.userData.hoehe = 2.3;
  },
  heerlager(g, lvl, team) {
    walze(g, 1.9, 1.95, 0.05, 28, '#c4a06a', 0, 0, 0);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; brocken(g, 0.1, '#8a8a8a', Math.cos(a) * 0.38, 0.08, Math.sin(a) * 0.38); }
    teil(g, geo('CylinderGeometry', 0.06, 0.06, 0.55, 6), mat('#5a3a1d'), 0, 0.1, 0, 0, 0.6, Math.PI / 2);
    teil(g, geo('CylinderGeometry', 0.06, 0.06, 0.55, 6), mat('#5a3a1d'), 0, 0.12, 0, 0, -0.6, Math.PI / 2);
    const f1 = kegel(g, 0.2, 0.5, 6, '#ff8a1f', 0, 0.08, 0, 0, { e: '#ff6a00', ei: 1.6 });
    const f2 = kegel(g, 0.11, 0.34, 6, '#ffd34d', 0, 0.12, 0, 0, { e: '#ffc400', ei: 2 });
    f1.castShadow = f2.castShadow = false;
    g.userData.flammen = [f1, f2];
    const zelte = Math.min(4, 1 + Math.ceil(lvl / 2));
    [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]].slice(0, zelte).forEach(([x, z]) => {
      kegel(g, 0.62, 0.95, 4, '#efe2c4', x, 0, z, Math.PI / 4);
      kegel(g, 0.2, 0.3, 4, team, x, 0.78, z, Math.PI / 4);
      kiste(g, 0.22, 0.4, 0.04, '#5a3a1d', x + (x < 0 ? 0.25 : -0.25) * 0, 0, z + (z < 0 ? 0.44 : -0.44), null, z < 0 ? 0 : Math.PI);
    });
    for (const a of [0.6, 2.2, 3.8, 5.3]) teil(g, geo('CylinderGeometry', 0.09, 0.09, 0.4, 7), mat('#7a5230'), Math.cos(a) * 0.85, 0.09, Math.sin(a) * 0.85, 0, -a, Math.PI / 2);
    g.userData.hoehe = 1.3;
  },
  schmiede(g, lvl) {
    kiste(g, 2.5, 0.2, 2.5, '#7d8288', 0, 0, 0);
    kiste(g, 1.85, 1.0, 1.6, '#66666f', 0, 0.2, -0.2);
    satteldach(g, 1.9, 0.7, 2.1, '#5a3a1d', 0, 1.2, -0.2);
    kiste(g, 0.45, 1.45, 0.45, '#55555c', -0.55, 0.2 + 0.9, -0.55);
    kiste(g, 0.36, 0.08, 0.36, '#ff8a1f', -0.55, 2.55, -0.55, { e: '#ff5a00', ei: 1.4 });
    kiste(g, 0.7, 0.42, 0.06, '#ff9a3c', 0.25, 0.3, 0.61, { e: '#ff5a00', ei: 1.5 });
    kiste(g, 0.4, 0.18, 0.2, '#3a3a40', 0.75, 0.42, 1.0, METALL); kiste(g, 0.18, 0.22, 0.14, '#3a3a40', 0.75, 0.2, 1.0);
    walze(g, 0.2, 0.22, 0.35, 10, '#5b6b78', -0.6, 0.2, 0.95, METALL);
    if (lvl >= 3) kiste(g, 1.9, 0.08, 1.65, '#f2c230', 0, 1.15, -0.2, GOLD);
    g.userData.rauch = [-0.55, 2.7, -0.55];
    g.userData.hoehe = 2.8;
  },
  schleuder(g, lvl) {
    const st = stil(lvl);
    walze(g, 1.15, 1.3, 0.5, 8, st.sockel, 0, 0, 0);
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; kiste(g, 0.28, 0.2, 0.22, st.sockel, Math.cos(a) * 1.05, 0.5, Math.sin(a) * 1.05, null, -a); }
    const turm = new T3.Group(); turm.position.y = 0.5; g.add(turm);
    kiste(turm, 0.95, 0.22, 0.95, '#6b4423', 0, 0, 0);
    for (const x of [-0.38, 0.38]) kiste(turm, 0.12, 0.6, 0.18, '#7a5230', x, 0.22, -0.1);
    const arm = new T3.Group(); arm.position.set(0, 0.72, -0.1); turm.add(arm);
    kiste(arm, 0.12, 0.12, 1.4, '#8b5a2b', 0, -0.06, 0.25);
    walze(arm, 0.17, 0.12, 0.14, 8, '#5a3a1d', 0, 0, 0.95);
    kugel(arm, 0.13, '#8d8d8d', 0, 0.16, 0.95);
    arm.rotation.x = -0.25;
    kiste(turm, 0.9, 0.08, 0.08, '#5a3a1d', 0, 0.75, -0.1);
    if (lvl >= 5) kiste(g, 0.6, 0.05, 0.05, '#f2c230', 0, 0.45, 1.29, GOLD);
    g.userData.turm = turm; g.userData.arm = arm; g.userData.armRuhe = -0.25; g.userData.armSchuss = -1.4;
    g.userData.hoehe = 2.0;
  },
  bogenturm(g, lvl, team) {
    const st = stil(lvl), h = 2.1 + lvl * 0.07;
    if (lvl >= 3) kiste(g, 1.6, 0.3, 1.6, st.sockel, 0, 0, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kiste(g, 0.17, h, 0.17, '#7a5230', x * 0.62, 0, z * 0.62);
    for (const y of [h * 0.35, h * 0.7]) { kiste(g, 1.3, 0.08, 0.08, '#6b4423', 0, y, 0.62); kiste(g, 0.08, 0.08, 1.3, '#6b4423', 0.62, y, 0); kiste(g, 1.3, 0.08, 0.08, '#6b4423', 0, y, -0.62); kiste(g, 0.08, 0.08, 1.3, '#6b4423', -0.62, y, 0); }
    kiste(g, 1.75, 0.16, 1.75, '#8b5a2b', 0, h, 0);
    for (const [w, d, x, z] of [[1.75, 0.08, 0, 0.84], [1.75, 0.08, 0, -0.84], [0.08, 1.75, 0.84, 0], [0.08, 1.75, -0.84, 0]]) kiste(g, w, 0.3, d, '#7a5230', x, h + 0.16, z);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kiste(g, 0.08, 0.95, 0.08, '#6b4423', x * 0.8, h + 0.16, z * 0.8);
    walmdach(g, 2.0, 0.75, '#2e6b2e', h + 1.1);
    const turm = new T3.Group(); turm.position.y = h + 0.16; g.add(turm);
    waechter(turm, team, 'bogen');
    g.userData.turm = turm; g.userData.hoehe = h + 2.1;
  },
  moerser(g, lvl) {
    const st = stil(lvl);
    walze(g, 1.15, 1.28, 0.62, 10, st.sockel === '#93653a' ? '#8a8f94' : st.sockel, 0, 0, 0);
    walze(g, 0.92, 0.92, 0.03, 10, '#2c2a28', 0, 0.62, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; kugel(g, 0.2, '#b59a6a', Math.cos(a) * 1.25, 0.12, Math.sin(a) * 1.25).scale.set(1.2, 0.6, 1); }
    const turm = new T3.Group(); turm.position.y = 0.62; g.add(turm);
    walze(turm, 0.42, 0.5, 0.25, 8, '#4a4a4a', 0, 0, 0, METALL);
    const lauf = new T3.Group(); lauf.position.y = 0.3; lauf.rotation.x = 0.85; turm.add(lauf);
    walze(lauf, 0.27, 0.33, 1.0, 12, '#2f2f35', 0, -0.25, 0, METALL);
    walze(lauf, 0.3, 0.3, 0.08, 12, lvl >= 5 ? '#f2c230' : '#55555c', 0, 0.62, 0, lvl >= 5 ? GOLD : METALL);
    walze(lauf, 0.36, 0.36, 0.08, 12, lvl >= 5 ? '#f2c230' : '#55555c', 0, -0.1, 0, lvl >= 5 ? GOLD : METALL);
    for (let i = 0; i < 3; i++) kugel(g, 0.16, '#3b2a1a', 0.85 - i * 0.2, 0.78, 0.6 + (i % 2) * 0.15);
    g.userData.turm = turm; g.userData.lauf = lauf; g.userData.hoehe = 2.0;
  },
  windturm(g, lvl) {
    walze(g, 0.95, 1.1, 0.3, 10, '#8a8f94', 0, 0, 0);
    walze(g, 0.5, 0.75, 2.6, 10, '#d9e4ec', 0, 0.3, 0);
    for (const y of [0.9, 1.7, 2.5]) walze(g, 0.62 - y * 0.04, 0.66 - y * 0.04, 0.12, 10, '#4a6fa5', 0, y, 0);
    fenster(g, 0, 1.3, 0.66, 'z'); fenster(g, 0.66, 2.0, 0, 'x');
    const turm = new T3.Group(); turm.position.y = 2.9; g.add(turm);
    walze(turm, 0.62, 0.55, 0.3, 10, '#4a6fa5', 0, 0, 0);
    kegel(turm, 0.72, 0.8, 10, '#3a5a8a', 0, 0.3, 0);
    kugel(turm, 0.12, '#f2c230', 0, 0.15, 0.68, GOLD);
    const rotor = new T3.Group(); rotor.position.set(0, 0.15, 0.72); turm.add(rotor);
    for (let i = 0; i < 4; i++) { const b = new T3.Group(); b.rotation.z = i * Math.PI / 2; rotor.add(b); kiste(b, 0.16, 0.95, 0.04, '#f4f4f4', 0, 0.12, 0); }
    g.userData.dreh = [{ m: rotor, achse: 'z', v: 5 }];
    g.userData.turm = turm; g.userData.hoehe = 4.1;
  },
  mauer(g, lvl, team, nb) {
    const farbe = ['#93653a', '#a8743f', '#a2a7ad', '#b39b72', '#8e959c', '#c9b27a', '#6b7580', '#4d5763', '#e3b23c'][lvl - 1] || '#a2a7ad';
    const o = lvl >= 9 ? GOLD : null;
    const h = 0.7 + lvl * 0.03;
    if (lvl <= 2) {
      for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) { walze(g, 0.12, 0.12, h, 6, farbe, x, 0, z); kegel(g, 0.12, 0.18, 6, farbe, x, h, z); }
      if (nb & 1) for (const z of [-0.1, 0.1]) teil(g, geo('CylinderGeometry', 0.07, 0.07, 1.0, 5), mat('#6b4423'), 0.5, h * 0.4 + (z > 0 ? 0.25 : 0), 0, 0, 0, Math.PI / 2);
      if (nb & 2) for (const x of [-0.1, 0.1]) teil(g, geo('CylinderGeometry', 0.07, 0.07, 1.0, 5), mat('#6b4423'), 0, h * 0.4 + (x > 0 ? 0.25 : 0), 0.5, Math.PI / 2, 0, 0);
    } else {
      kiste(g, 0.62, h, 0.62, farbe, 0, 0, 0, o);
      kiste(g, 0.72, 0.12, 0.72, farbe, 0, h, 0, o);
      if (nb & 1) kiste(g, 1.0, h - 0.12, 0.44, farbe, 0.5, 0, 0, o);
      if (nb & 2) kiste(g, 0.44, h - 0.12, 1.0, farbe, 0, 0, 0.5, o);
    }
    g.userData.hoehe = h + 0.3;
  },
};

// Kleiner Wächter mit Bogen (auf dem Bogenturm)
function waechter(gr, team, waffe) {
  kiste(gr, 0.1, 0.22, 0.1, '#4a3426', -0.07, 0, 0); kiste(gr, 0.1, 0.22, 0.1, '#4a3426', 0.07, 0, 0);
  kiste(gr, 0.28, 0.3, 0.2, team, 0, 0.22, 0);
  kugel(gr, 0.12, '#f1c27d', 0, 0.64, 0);
  kegel(gr, 0.15, 0.18, 8, '#3f6b2e', 0, 0.7, 0);
  if (waffe === 'bogen') { teil(gr, geo('TorusGeometry', 0.22, 0.02, 4, 10, Math.PI), mat('#5a3a1d'), 0.2, 0.42, 0.18, 0, Math.PI / 2, Math.PI / 2); }
}

function geruest(g, s, h) {
  const a = s / 2 - 0.15;
  for (const [x, z] of [[-a, -a], [a, -a], [-a, a], [a, a]]) walze(g, 0.04, 0.04, h, 5, '#b98a4e', x, 0, z);
  for (const y of [h * 0.45, h * 0.9]) { kiste(g, s - 0.2, 0.05, 0.18, '#c8a06a', 0, y, a); kiste(g, 0.18, 0.05, s - 0.2, '#c8a06a', a, y, 0); }
  kiste(g, 0.35, 0.3, 0.35, '#a0703f', a - 0.1, 0, a + 0.25);
}
function baustelle(g, s) {
  kiste(g, s - 0.5, 0.15, s - 0.5, '#c8a06a', 0, 0, 0);
  for (let i = 0; i < 4; i++) kiste(g, s - 0.8, 0.06, 0.2, '#b98a4e', 0, 0.15 + i * 0.06, -0.3 + i * 0.2, null, i * 0.1);
  geruest(g, s, 1.2);
  kiste(g, 0.4, 0.4, 0.4, '#8b5a2b', -s / 2 + 0.6, 0.15, s / 2 - 0.6);
  g.userData.hoehe = 1.6;
}
function truemmer(g, s, typ) {
  const r = zufall(s * 13 + typ.length * 7);
  walze(g, s * 0.48, s * 0.5, 0.03, 12, '#3b3127', 0, 0, 0).receiveShadow = true;
  if (typ === 'mauer') { for (let i = 0; i < 3; i++) brocken(g, 0.1 + r() * 0.06, '#777', (r() - 0.5) * 0.6, 0.06, (r() - 0.5) * 0.6); g.userData.hoehe = 0.4; return; }
  for (let i = 0; i < 6 + s * 3; i++) {
    const f = ['#6b5a48', '#8a8a8a', '#5a3a1d', '#9c8a76'][i % 4];
    const b = i % 3 ? brocken(g, 0.12 + r() * 0.16, f, (r() - 0.5) * (s - 0.6), 0.1, (r() - 0.5) * (s - 0.6)) : kiste(g, 0.5 + r() * 0.4, 0.08, 0.1, f, (r() - 0.5) * (s - 0.8), 0.04, (r() - 0.5) * (s - 0.8), null, r() * 3);
    b.rotation.set(r() * 3, r() * 3, r() * 0.4);
  }
  g.userData.rauch = [0, 0.3, 0]; g.userData.rauchSchwach = true;
  g.userData.hoehe = 0.6;
}
function bauModell(e) {
  const g = new T3.Group(), team = e.team === 'gegner' ? GEGNER : SPIELER;
  if (e.tot) truemmer(g, e.gr, e.typ);
  else if (e.lvl < 1) baustelle(g, e.gr);
  else {
    MODELL[e.typ](g, e.lvl, team, e.nachbarn || 0);
    if (e.bau != null) geruest(g, e.gr, Math.min(2.4, (g.userData.hoehe || 2) * 0.7));
  }
  if (e.geist) {
    const farbe = e.geist === 'ok' ? '#5dff6a' : '#ff4a3a';
    const gm = new T3.MeshStandardMaterial({ color: farbe, transparent: true, opacity: 0.55, emissive: farbe, emissiveIntensity: 0.35, flatShading: true });
    g.traverse(o => { if (o.isMesh) { o.material = gm; o.castShadow = false; } });
    const p = new T3.Mesh(geo('PlaneGeometry', e.gr, e.gr), new T3.MeshBasicMaterial({ color: farbe, transparent: true, opacity: 0.35, depthWrite: false }));
    p.rotation.x = -Math.PI / 2; p.position.y = 0.03; g.add(p);
  } else if (!e.tot && e.typ !== 'mauer') {
    // Grundplatte, damit Gebäude nicht schweben
    const p = new T3.Mesh(geo('PlaneGeometry', e.gr - 0.08, e.gr - 0.08), mat('#8f7a52'));
    p.rotation.x = -Math.PI / 2; p.position.y = 0.012; p.receiveShadow = true; g.add(p);
  }
  return g;
}

/* ---------------------------------------------------------------- Figuren */
function glied(k, w, h, d, f, x, y, z) {   // Drehpunkt oben (Schulter / Hüfte)
  const p = new T3.Group(); p.position.set(x, y, z); k.add(p);
  const m = new T3.Mesh(geo('BoxGeometry', w, h, d), mat(f)); m.position.y = -h / 2; m.castShadow = true; p.add(m);
  return p;
}
const FIGUR = {
  raufbold(k, t) {
    t.beinL = glied(k, 0.12, 0.22, 0.13, '#4a3426', -0.09, 0.22, 0); t.beinR = glied(k, 0.12, 0.22, 0.13, '#4a3426', 0.09, 0.22, 0);
    kiste(k, 0.36, 0.3, 0.26, '#b5652b', 0, 0.2, 0); kiste(k, 0.37, 0.06, 0.27, '#3b2a1a', 0, 0.22, 0);
    kiste(k, 0.14, 0.06, 0.16, SPIELER, -0.2, 0.46, 0);
    t.armL = glied(k, 0.1, 0.26, 0.11, '#e8b48a', -0.23, 0.48, 0); t.armR = glied(k, 0.1, 0.26, 0.11, '#e8b48a', 0.23, 0.48, 0);
    kugel(k, 0.14, '#f1c27d', 0, 0.62, 0);
    kiste(k, 0.22, 0.13, 0.09, '#8a3e12', 0, 0.48, 0.1); kiste(k, 0.29, 0.07, 0.29, '#c0392b', 0, 0.69, 0);
    for (const x of [-0.05, 0.05]) kiste(k, 0.03, 0.03, 0.02, '#111', x, 0.63, 0.135);
    const axt = new T3.Group(); axt.position.set(0, -0.24, 0.06); axt.rotation.x = 1.3; t.armR.add(axt);
    kiste(axt, 0.04, 0.48, 0.04, '#6b4423', 0, -0.05, 0); kiste(axt, 0.03, 0.18, 0.2, '#b8c0c6', 0, 0.28, 0.08, METALL);
  },
  schleuderin(k, t) {
    t.beinL = glied(k, 0.09, 0.22, 0.1, '#5b3b6b', -0.07, 0.22, 0); t.beinR = glied(k, 0.09, 0.22, 0.1, '#5b3b6b', 0.07, 0.22, 0);
    kegel(k, 0.19, 0.24, 7, '#c2457a', 0, 0.14, 0).rotation.x = Math.PI;
    kiste(k, 0.24, 0.24, 0.17, '#c2457a', 0, 0.26, 0);
    kiste(k, 0.26, 0.05, 0.19, SPIELER, 0, 0.44, 0);
    t.armL = glied(k, 0.07, 0.22, 0.08, '#f1c9a5', -0.16, 0.48, 0); t.armR = glied(k, 0.07, 0.22, 0.08, '#f1c9a5', 0.16, 0.48, 0);
    kugel(k, 0.12, '#f1c9a5', 0, 0.6, 0);
    kugel(k, 0.13, '#f0c34a', 0, 0.64, -0.03).scale.set(1, 0.9, 1);
    kiste(k, 0.07, 0.22, 0.07, '#f0c34a', 0, 0.42, -0.14);
    for (const x of [-0.045, 0.045]) kiste(k, 0.025, 0.03, 0.02, '#111', x, 0.6, 0.115);
    kiste(t.armR, 0.02, 0.3, 0.02, '#7a5230', 0, -0.35, 0); kugel(t.armR, 0.045, '#999', 0, -0.5, 0);
  },
  waschbaer(k, t) {
    const leg = (x, z) => glied(k, 0.08, 0.15, 0.08, '#4a4a4a', x, 0.15, z);
    t.beinL = new T3.Group(); t.beinR = new T3.Group(); k.add(t.beinL); k.add(t.beinR);
    t.beinL.add(leg(-0.1, 0.12)); t.beinL.add(leg(0.1, -0.12)); t.beinR.add(leg(0.1, 0.12)); t.beinR.add(leg(-0.1, -0.12));
    kugel(k, 0.2, '#8c8c8c', 0, 0.26, 0).scale.set(1, 0.8, 1.3);
    kugel(k, 0.15, '#9a9a9a', 0, 0.38, 0.25);
    kiste(k, 0.25, 0.06, 0.08, '#1e1e1e', 0, 0.38, 0.34);
    kugel(k, 0.06, '#eeeeee', 0, 0.34, 0.39); kugel(k, 0.025, '#111', 0, 0.35, 0.44);
    for (const x of [-0.09, 0.09]) kegel(k, 0.05, 0.09, 4, '#6a6a6a', x, 0.5, 0.22);
    for (let i = 0; i < 4; i++) teil(k, geo('CylinderGeometry', 0.07, 0.075, 0.1, 7), mat(i % 2 ? '#2a2a2a' : '#bcbcbc'), 0, 0.3 + i * 0.07, -0.3 - i * 0.06, -0.7, 0, 0);
    kugel(k, 0.14, '#a07a45', 0, 0.46, -0.08); kiste(k, 0.05, 0.08, 0.05, '#6b4423', 0, 0.58, -0.08);
    kiste(k, 0.18, 0.04, 0.2, SPIELER, 0, 0.4, 0.05);
  },
  maulwurf(k, t) {
    t.beinL = glied(k, 0.07, 0.1, 0.08, '#3b2618', -0.1, 0.1, 0); t.beinR = glied(k, 0.07, 0.1, 0.08, '#3b2618', 0.1, 0.1, 0);
    kugel(k, 0.2, '#5a3b28', 0, 0.26, 0).scale.set(1, 0.95, 1.15);
    kugel(k, 0.06, '#f0a0a8', 0, 0.28, 0.24);
    for (const x of [-0.06, 0.06]) kiste(k, 0.025, 0.025, 0.02, '#111', x, 0.35, 0.18);
    t.armL = glied(k, 0.07, 0.12, 0.07, '#e8a0a0', -0.18, 0.28, 0.1); t.armR = glied(k, 0.07, 0.12, 0.07, '#e8a0a0', 0.18, 0.28, 0.1);
    for (const x of [-0.06, 0, 0.06]) walze(k, 0.045, 0.045, 0.3, 8, '#c62d2d', x, 0.24, -0.2);
    kiste(k, 0.2, 0.04, 0.1, '#222', 0, 0.36, -0.2);
    walze(k, 0.008, 0.008, 0.12, 4, '#222', 0, 0.54, -0.2);
    const funke = kugel(k, 0.035, '#ffe066', 0, 0.67, -0.2, { e: '#ffcc00', ei: 2 });
    funke.castShadow = false; t.funke = funke;
    kiste(k, 0.18, 0.04, 0.22, SPIELER, 0, 0.42, 0);
  },
  troll(k, t) {
    t.beinL = glied(k, 0.18, 0.22, 0.2, '#6b7681', -0.13, 0.22, 0); t.beinR = glied(k, 0.18, 0.22, 0.2, '#6b7681', 0.13, 0.22, 0);
    brocken(k, 0.3, '#7d8a96', 0, 0.48, 0).scale.set(1.05, 1.0, 0.85);
    brocken(k, 0.14, '#8a96a2', 0, 0.85, 0.08);
    for (const x of [-0.05, 0.05]) kiste(k, 0.04, 0.03, 0.02, '#ff9a2e', x, 0.86, 0.2, { e: '#ff7a00', ei: 1.5 });
    for (const [x, z] of [[-0.18, -0.05], [0.12, -0.12], [0.2, 0.08]]) kiste(k, 0.14, 0.05, 0.12, '#5e8f3a', x, 0.74, z);
    t.armL = glied(k, 0.12, 0.3, 0.12, '#6b7681', -0.36, 0.66, 0); t.armR = glied(k, 0.12, 0.3, 0.12, '#6b7681', 0.36, 0.66, 0);
    brocken(t.armL, 0.13, '#7d8a96', 0, -0.36, 0); brocken(t.armR, 0.13, '#7d8a96', 0, -0.36, 0);
    kiste(k, 0.2, 0.05, 0.2, SPIELER, -0.3, 0.7, 0);
  },
  greif(k, t) {
    kugel(k, 0.22, '#b8862e', 0, 0, 0).scale.set(0.95, 0.85, 1.45);
    kugel(k, 0.14, '#f2efe6', 0, 0.16, 0.3);
    kegel(k, 0.06, 0.16, 5, '#f2b81e', 0, 0.12, 0.43).rotation.x = Math.PI / 2;
    for (const x of [-0.06, 0.06]) kiste(k, 0.03, 0.03, 0.02, '#111', x, 0.2, 0.42);
    const fl = (s) => { const p = new T3.Group(); p.position.set(s * 0.16, 0.08, 0); k.add(p); kiste(p, 0.62, 0.04, 0.32, '#8a5a1e', s * 0.31, 0, 0); kiste(p, 0.3, 0.035, 0.26, '#d4a24c', s * 0.66, 0, -0.04); return p; };
    t.fluegelL = fl(-1); t.fluegelR = fl(1);
    kiste(k, 0.2, 0.04, 0.3, '#d4a24c', 0, 0.02, -0.4, null, 0);
    for (const x of [-0.08, 0.08]) kiste(k, 0.06, 0.16, 0.06, '#c79a4a', x, -0.26, 0.05);
    kiste(k, 0.2, 0.04, 0.18, SPIELER, 0, 0.17, 0.0);
  },
};
const FIGUR_GROESSE = { raufbold: 1.35, schleuderin: 1.3, waschbaer: 1.3, maulwurf: 1.35, troll: 1.75, greif: 1.6 };
function figurBauen(typ) {
  const g = new T3.Group(), k = new T3.Group(); g.add(k);
  const t = {}; FIGUR[typ](k, t);
  g.scale.setScalar(FIGUR_GROESSE[typ] || 1.3);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData = { k, t };
  return g;
}

/* ---------------------------------------------------------------- Welt */
function bodenTextur() {
  const c = document.createElement('canvas'), S = 1024; c.width = c.height = S;
  const x = c.getContext('2d'), z = S / N, r = zufall(3);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { x.fillStyle = (i + j) % 2 ? '#7ccb55' : '#74c24f'; x.fillRect(i * z, j * z, z + 1, z + 1); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = ['rgba(60,130,40,.35)', 'rgba(150,215,100,.35)', 'rgba(90,160,55,.3)'][i % 3]; x.fillRect(r() * S, r() * S, 1.5, 3 + r() * 3); }
  for (let i = 0; i < 160; i++) { x.fillStyle = ['#fff7a8', '#ffffff', '#ffb3d1', '#c9f0ff'][i % 4]; x.beginPath(); x.arc(r() * S, r() * S, 2 + r() * 1.5, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 6; x.strokeRect(3, 3, S - 6, S - 6);
  const t = new T3.CanvasTexture(c); t.colorSpace = T3.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
function wieseTextur() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'), r = zufall(11);
  x.fillStyle = '#5cab3f'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { x.fillStyle = ['rgba(40,110,30,.35)', 'rgba(130,200,90,.3)'][i % 2]; x.fillRect(r() * 256, r() * 256, 2, 4); }
  const t = new T3.CanvasTexture(c); t.wrapS = t.wrapT = T3.RepeatWrapping; t.repeat.set(40, 40); t.colorSpace = T3.SRGBColorSpace;
  return t;
}
function weltBauen() {
  szene.background = new T3.Color('#a9d9f2');
  szene.fog = new T3.Fog('#a9d9f2', 75, 170);
  szene.add(new T3.HemisphereLight('#dff1ff', '#55743a', 1.25));
  sonne = new T3.DirectionalLight('#fff1d6', 2.6);
  sonne.castShadow = true;
  const klein = Math.min(innerWidth, innerHeight) < 700;
  sonne.shadow.mapSize.set(klein ? 1024 : 2048, klein ? 1024 : 2048);
  sonne.shadow.bias = -0.0004; sonne.shadow.normalBias = 0.03;
  szene.add(sonne); szene.add(sonne.target);
  // Spielfeld als leicht erhöhte Wiese
  const feld = new T3.Mesh(new T3.BoxGeometry(N, 0.6, N), [mat('#7a5534'), mat('#7a5534'), new T3.MeshStandardMaterial({ map: bodenTextur(), roughness: 0.95 }), mat('#7a5534'), mat('#6d4b2e'), mat('#6d4b2e')]);
  feld.position.set(N / 2, -0.3, N / 2); feld.receiveShadow = true; szene.add(feld);
  const wiese = new T3.Mesh(new T3.PlaneGeometry(300, 300), new T3.MeshStandardMaterial({ map: wieseTextur(), roughness: 1 }));
  wiese.rotation.x = -Math.PI / 2; wiese.position.set(N / 2, -0.55, N / 2); wiese.receiveShadow = true; szene.add(wiese);
  // See
  const see = new T3.Mesh(new T3.CircleGeometry(7, 32), new T3.MeshStandardMaterial({ color: '#3f97d6', roughness: 0.15, metalness: 0.1 }));
  see.rotation.x = -Math.PI / 2; see.position.set(-9, -0.52, N * 0.62); see.scale.set(1.3, 0.8, 1); szene.add(see);
  const ufer = new T3.Mesh(new T3.CircleGeometry(7.8, 32), mat('#d9c58f')); ufer.rotation.x = -Math.PI / 2; ufer.position.set(-9, -0.535, N * 0.62); ufer.scale.set(1.3, 0.8, 1); ufer.receiveShadow = true; szene.add(ufer);
  // Bäume, Felsen, Büsche (instanziert)
  const r = zufall(42), baeume = [], steine = [], buesche = [];
  for (let i = 0; i < 900; i++) {
    const x = -26 + r() * (N + 52), z = -26 + r() * (N + 52);
    if (x > -1.5 && z > -1.5 && x < N + 1.5 && z < N + 1.5) continue;
    if (Math.hypot((x + 9) / 1.3, (z - N * 0.62) / 0.8) < 8.5) continue;
    const p = r();
    (p < 0.7 ? baeume : p < 0.82 ? steine : buesche).push([x, z, 0.7 + r() * 0.6, r() * 6, r()]);
  }
  const dummy = new T3.Object3D(), farbe = new T3.Color();
  const inst = (g, m, liste, setz) => {
    const im = new T3.InstancedMesh(g, m, liste.length); im.castShadow = true; im.receiveShadow = true;
    liste.forEach((p, i) => { setz(p); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    szene.add(im); return im;
  };
  const tannen = baeume.filter(b => b[4] < 0.55), laub = baeume.filter(b => b[4] >= 0.55);
  inst(geo('CylinderGeometry', 0.12, 0.18, 1, 6), mat('#6b4423'), baeume, ([x, z, s]) => { dummy.position.set(x, -0.55 + 0.5 * s, z); dummy.scale.set(s, s, s); dummy.rotation.set(0, 0, 0); });
  const t1 = inst(geo('ConeGeometry', 0.9, 1.6, 7), mat('#2f7a3a'), tannen, ([x, z, s, rot]) => { dummy.position.set(x, -0.55 + (1.5) * s, z); dummy.scale.set(s, s, s); dummy.rotation.set(0, rot, 0); });
  const t2 = inst(geo('ConeGeometry', 0.65, 1.3, 7), mat('#3a8c44'), tannen, ([x, z, s, rot]) => { dummy.position.set(x, -0.55 + 2.3 * s, z); dummy.scale.set(s, s, s); dummy.rotation.set(0, rot, 0); });
  const kr = inst(geo('IcosahedronGeometry', 0.95, 0), mat('#ffffff'), laub, ([x, z, s, rot]) => { dummy.position.set(x, -0.55 + 1.75 * s, z); dummy.scale.set(s, s * 0.9, s); dummy.rotation.set(rot, rot, 0); });
  laub.forEach((b, i) => kr.setColorAt(i, farbe.set(['#4f9d3a', '#5dae42', '#6bb84a', '#d98b2b'][Math.floor(b[4] * 37) % 4 === 3 && b[4] > 0.95 ? 3 : Math.floor(b[4] * 37) % 3])));
  [t1, t2].forEach(im => tannen.forEach((b, i) => im.setColorAt(i, farbe.set(b[4] < 0.25 ? '#2a6e35' : '#327f3d'))));
  inst(geo('DodecahedronGeometry', 0.6, 0), mat('#9a9a96'), steine, ([x, z, s, rot]) => { dummy.position.set(x, -0.45, z); dummy.scale.set(s, s * 0.6, s); dummy.rotation.set(rot, rot, 0); });
  inst(geo('IcosahedronGeometry', 0.5, 0), mat('#4c9a3b'), buesche, ([x, z, s, rot]) => { dummy.position.set(x, -0.4, z); dummy.scale.set(s, s * 0.7, s); dummy.rotation.set(0, rot, 0); });
  // Auswahlring
  auswahlRing = new T3.Mesh(geo('RingGeometry', 0.46, 0.5, 40), new T3.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
  auswahlRing.rotation.x = -Math.PI / 2; auswahlRing.position.y = 0.04; auswahlRing.visible = false; szene.add(auswahlRing);
  // Absetz-Verbotszone
  const vc = document.createElement('canvas'); vc.width = vc.height = N * 4;
  verbotCanvas = vc;
  verbotTex = new T3.CanvasTexture(vc); verbotTex.magFilter = T3.NearestFilter; verbotTex.minFilter = T3.LinearFilter;
  verbotMesh = new T3.Mesh(new T3.PlaneGeometry(N, N), new T3.MeshBasicMaterial({ map: verbotTex, transparent: true, depthWrite: false }));
  verbotMesh.rotation.x = -Math.PI / 2; verbotMesh.position.set(N / 2, 0.025, N / 2); verbotMesh.visible = false; szene.add(verbotMesh);
}
let auswahlRing, verbotMesh, verbotTex, verbotCanvas, verbotQuelle = null;
function verbotZeigen(verbot) {
  if (!verbot) { verbotMesh.visible = false; return; }
  if (verbot !== verbotQuelle) {
    verbotQuelle = verbot;
    const x = verbotCanvas.getContext('2d'), z = 4;
    x.clearRect(0, 0, N * z, N * z);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (verbot[j * N + i]) { x.fillStyle = 'rgba(255,40,40,.28)'; x.fillRect(i * z, j * z, z, z); }
    verbotTex.needsUpdate = true;
  }
  verbotMesh.visible = true;
}

/* ---------------------------------------------------------------- Kamera */
function kameraSetzen() {
  ziel.x = clamp(ziel.x, -3, N + 3); ziel.z = clamp(ziel.z, -3, N + 3);
  kamera.position.set(ziel.x + Math.sin(PHI) * Math.cos(THETA) * abstand, Math.cos(PHI) * abstand, ziel.z + Math.sin(PHI) * Math.sin(THETA) * abstand);
  kamera.lookAt(ziel);
  kamera.updateMatrixWorld();
  const h = clamp(abstand * 0.75, 14, 34);
  sonne.position.set(ziel.x - 14, 30, ziel.z - 6); sonne.target.position.copy(ziel);
  const sc = sonne.shadow.camera;
  if (sc.right !== h) { sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.near = 1; sc.far = 90; sc.updateProjectionMatrix(); }
}
function bild2feld(px, py) {
  ray.setFromCamera({ x: px / W * 2 - 1, y: -(py / H) * 2 + 1 }, kamera);
  const p = ray.ray.intersectPlane(boden0, tmpV);
  return p ? [p.x, p.z] : [-99, -99];
}
function pan(dx, dy) {
  const k = 2 * abstand * Math.tan(FOV * Math.PI / 360) / H;
  const rx = Math.sin(THETA), rz = -Math.cos(THETA), fx = -Math.cos(THETA), fz = -Math.sin(THETA);
  ziel.x -= rx * dx * k; ziel.z -= rz * dx * k;
  ziel.x += fx * dy * k / Math.cos(PHI) * 0.75; ziel.z += fz * dy * k / Math.cos(PHI) * 0.75;
  kameraSetzen();
}
function zoomBei(f, px, py) {
  const [x0, z0] = bild2feld(px, py);
  abstand = clamp(abstand / f, 9, 80); kameraSetzen();
  const [x1, z1] = bild2feld(px, py);
  if (x0 > -90 && x1 > -90) { ziel.x += x0 - x1; ziel.z += z0 - z1; }
  kameraSetzen();
}
function zentrieren(kampf) {
  ziel.set(N / 2, 0, N / 2);
  const t = Math.tan(FOV * Math.PI / 360), a = W / H;
  const breit = kampf ? (a < 1 ? N * 0.75 : N * 1.05) : (a < 1 ? 13 : 23), tief = kampf ? N * 0.62 : 15;
  abstand = clamp(a < 1 ? breit / (2 * t * a) : Math.max(breit / (2 * t * a), tief / (2 * t)), 12, 80);
  kameraSetzen();
}
function groesse() {
  W = innerWidth; H = innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  kamera.aspect = W / H; kamera.updateProjectionMatrix();
  const d = Math.min(window.devicePixelRatio || 1, 2);
  ov.width = Math.round(W * d); ov.height = Math.round(H * d); o2.setTransform(d, 0, 0, d, 0, 0);
  kameraSetzen();
}
function init(canvas, n) {
  N = n; cv = canvas;
  renderer = new T3.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T3.PCFSoftShadowMap;
  renderer.toneMapping = T3.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  szene = new T3.Scene();
  kamera = new T3.PerspectiveCamera(FOV, 1, 0.5, 400);
  ov = document.getElementById('overlay'); o2 = ov.getContext('2d');
  weltBauen(); groesse();
}

/* ---------------------------------------------------------------- Partikel & Effekte */
const partikel = [];
function teilchen(g, farbe, x, y, z, vx, vy, vz, leben, s0, s1, o) {
  o = o || {};
  const m = new T3.Mesh(g, new T3.MeshBasicMaterial({ color: farbe, transparent: true, opacity: o.alpha ?? 1, depthWrite: false }));
  m.position.set(x, y, z); m.scale.setScalar(s0); if (o.rx) m.rotation.x = o.rx;
  szene.add(m);
  partikel.push({ m, v: [vx, vy, vz], leben, max: leben, s0, s1, g: o.g || 0, a0: o.alpha ?? 1, dreh: o.dreh || 0 });
}
function effekt(x, y, h, art, gr) {
  gr = gr || 1;
  const kugelG = geo('IcosahedronGeometry', 1, 1), wuerfel = geo('BoxGeometry', 1, 1, 1);
  if (art === 'boom') {
    teilchen(kugelG, '#fff1b0', x, h + 0.3, y, 0, 0, 0, 0.15, 0.2, 0.8 * gr);
    teilchen(kugelG, '#ff9a2e', x, h + 0.3, y, 0, 0.5, 0, 0.32, 0.25, 1.0 * gr, { alpha: 0.75 });
    for (let i = 0; i < 10; i++) { const a = Math.random() * 6.3, v = 1 + Math.random() * 2; teilchen(kugelG, i % 2 ? '#ff7a1a' : '#ffc23d', x, h + 0.3, y, Math.cos(a) * v, 1 + Math.random() * 2, Math.sin(a) * v, 0.45, 0.18 * gr, 0.02, { g: 3 }); }
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.3; teilchen(kugelG, '#6d6a66', x + Math.cos(a) * 0.3, h + 0.4, y + Math.sin(a) * 0.3, Math.cos(a) * 0.5, 0.8 + Math.random(), Math.sin(a) * 0.5, 1.0, 0.18 * gr, 0.45 * gr, { alpha: 0.4 }); }
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.3, v = 2 + Math.random() * 2; teilchen(wuerfel, '#3a2c20', x, h + 0.3, y, Math.cos(a) * v, 3 + Math.random() * 2, Math.sin(a) * v, 0.8, 0.09, 0.09, { g: 12, dreh: 8 }); }
  } else if (art === 'staub') {
    for (let i = 0; i < 9; i++) { const a = Math.random() * 6.3, v = 0.6 + Math.random() * 1.2; teilchen(kugelG, i % 3 ? '#b5a184' : '#8c8070', x + Math.cos(a) * 0.4 * gr, h + 0.2, y + Math.sin(a) * 0.4 * gr, Math.cos(a) * v * gr, 0.6 + Math.random() * 0.8, Math.sin(a) * v * gr, 0.8, 0.16 * gr, 0.42 * gr, { alpha: 0.45 }); }
    for (let i = 0; i < 6; i++) { const a = Math.random() * 6.3, v = 1.5 + Math.random() * 2; teilchen(wuerfel, ['#6b5a48', '#8a8a8a', '#5a3a1d'][i % 3], x, h + 0.4, y, Math.cos(a) * v, 2.5 + Math.random() * 2, Math.sin(a) * v, 0.8, 0.14, 0.12, { g: 10, dreh: 7 }); }
  } else if (art === 'treffer') {
    teilchen(kugelG, '#fff6c8', x, h, y, 0, 0, 0, 0.14, 0.08, 0.3);
    for (let i = 0; i < 3; i++) teilchen(wuerfel, '#ffd36b', x, h, y, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.3, 0.05, 0.02, { g: 8 });
  } else if (art === 'setzen') {
    teilchen(geo('RingGeometry', 0.8, 1, 32), '#7fc8ff', x, 0.05, y, 0, 0, 0, 0.45, 0.15, 0.7, { rx: -Math.PI / 2 });
    for (let i = 0; i < 5; i++) { const a = Math.random() * 6.3; teilchen(kugelG, '#d8c8a8', x, 0.1, y, Math.cos(a), 0.6, Math.sin(a), 0.5, 0.1, 0.25, { alpha: 0.7 }); }
  } else if (art === 'muenzen' || art === 'holz') {
    for (let i = 0; i < 8; i++) { const a = Math.random() * 6.3, v = 0.5 + Math.random(); teilchen(art === 'holz' ? wuerfel : geo('CylinderGeometry', 1, 1, 0.3, 10), art === 'holz' ? '#a0703f' : '#f2c230', x, h, y, Math.cos(a) * v, 3 + Math.random() * 2, Math.sin(a) * v, 0.9, 0.12, 0.12, { g: 7, dreh: 6 }); }
  } else if (art === 'rauch') {
    teilchen(kugelG, gr < 1 ? '#5e5a55' : '#8f8a84', x + (Math.random() - 0.5) * 0.2, h, y + (Math.random() - 0.5) * 0.2, 0.15 + Math.random() * 0.1, 0.7, 0.05, 1.8, 0.1, 0.45, { alpha: 0.35 });
  }
}
function partikelSchritt(dt) {
  for (let i = partikel.length - 1; i >= 0; i--) {
    const p = partikel[i]; p.leben -= dt;
    if (p.leben <= 0) { szene.remove(p.m); p.m.material.dispose(); partikel.splice(i, 1); continue; }
    const q = 1 - p.leben / p.max;
    p.v[1] -= p.g * dt;
    p.m.position.x += p.v[0] * dt; p.m.position.y += p.v[1] * dt; p.m.position.z += p.v[2] * dt;
    if (p.m.position.y < 0.02 && p.g) { p.m.position.y = 0.02; p.v[0] *= 0.6; p.v[2] *= 0.6; p.v[1] = 0; }
    if (p.dreh) { p.m.rotation.x += p.dreh * dt; p.m.rotation.z += p.dreh * dt * 0.7; }
    p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * q);
    p.m.material.opacity = p.a0 * (1 - q * q);
  }
}

/* ---------------------------------------------------------------- Texte & Leisten (2D über dem Bild) */
const texte = [];
function text(x, y, h, t, farbe) { texte.push({ x, y, h, t, farbe, z: 0 }); }
function projiziere(x, y, z) {
  tmpV2.set(x, y, z).project(kamera);
  return [(tmpV2.x + 1) / 2 * W, (1 - tmpV2.y) / 2 * H, tmpV2.z];
}
function leiste(x, y, w, anteil, farbe) {
  o2.fillStyle = 'rgba(0,0,0,.6)'; o2.fillRect(x - w / 2 - 1.5, y - 1.5, w + 3, 8);
  o2.fillStyle = farbe; o2.fillRect(x - w / 2, y, w * clamp(anteil, 0, 1), 5);
}
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function blase(x, y, ch, hop) {
  o2.fillStyle = 'rgba(255,255,255,.95)'; o2.beginPath(); o2.arc(x, y + hop, 16, 0, 7); o2.fill();
  o2.strokeStyle = '#8a5a2e'; o2.lineWidth = 2.5; o2.stroke();
  o2.beginPath(); o2.moveTo(x - 5, y + hop + 14); o2.lineTo(x, y + hop + 22); o2.lineTo(x + 5, y + hop + 14); o2.fillStyle = 'rgba(255,255,255,.95)'; o2.fill();
  o2.font = '18px ' + EMOJI; o2.textAlign = 'center'; o2.textBaseline = 'middle'; o2.fillText(ch, x, y + hop + 1);
}

/* ---------------------------------------------------------------- Zeichnen */
const bauEintraege = new Map(), einheitEintraege = new Map(), geschossEintraege = new Map(), lagerFiguren = new Map();
function entfernen(o) { szene.remove(o); }
function winkelZu(aktuell, ziel, k) {
  let d = ziel - aktuell; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return aktuell + d * k;
}
let rauchTakt = 0;
function render(sz, dt) {
  zeit += dt; rauchTakt += dt;
  const rauchJetzt = rauchTakt > 0.18; if (rauchJetzt) rauchTakt = 0;
  const overlay = [];
  // Gebäude
  const gesehen = new Set();
  let gewaehlt = null;
  for (const e of sz.bauten) {
    const sig = e.typ + '|' + e.lvl + '|' + (e.tot ? 1 : 0) + '|' + (e.nachbarn || 0) + '|' + (e.geist || '') + '|' + (e.bau != null ? 1 : 0) + '|' + e.team;
    let en = bauEintraege.get(e.key);
    if (!en || en.sig !== sig) {
      if (en) entfernen(en.g);
      en = { g: bauModell(e), sig, w: en ? en.w : null, rauch: 0 };
      szene.add(en.g); bauEintraege.set(e.key, en);
    }
    gesehen.add(e.key);
    const g = en.g, ud = g.userData;
    g.position.set(e.x + e.gr / 2, 0, e.y + e.gr / 2);
    if (ud.dreh) for (const d of ud.dreh) d.m.rotation[d.achse] += d.v * dt;
    if (ud.flammen) ud.flammen.forEach((f, i) => { const s = 1 + Math.sin(zeit * 13 + i * 2) * 0.15 + Math.sin(zeit * 7.3) * 0.08; f.scale.set(s, s * (1 + Math.sin(zeit * 9 + i) * 0.12), s); });
    if (ud.fahnen) ud.fahnen.forEach(f => { f.rotation.y = Math.sin(zeit * 3 + e.x) * 0.35; });
    if (ud.turm) {
      if (e.winkel != null) { if (en.w == null) en.w = e.winkel; en.w = winkelZu(en.w, e.winkel, Math.min(1, dt * 8)); }
      else if (en.w == null) en.w = Math.PI / 4 + ((e.x * 7 + e.y * 3) % 5) * 0.5;
      ud.turm.rotation.y = en.w;
      const f = e.feuer == null ? 1e9 : e.feuer;
      if (ud.arm) { const p = f < 180 ? f / 180 : f < 900 ? 1 - (f - 180) / 720 : 0; ud.arm.rotation.x = ud.armRuhe + (ud.armSchuss - ud.armRuhe) * p; }
      if (ud.lauf) { const p = f < 300 ? 1 - f / 300 : 0; ud.lauf.position.y = 0.3 - p * 0.12; }
    }
    if (ud.rauch && rauchJetzt && (!ud.rauchSchwach || Math.random() < 0.35)) {
      const [rx, ry, rz] = ud.rauch; effekt(g.position.x + rx, g.position.z + rz, ry, 'rauch', ud.rauchSchwach ? 0.5 : 1);
    }
    if (e.gewaehlt) { gewaehlt = e; g.position.y = Math.max(0, Math.sin(zeit * 6)) * 0.06; } else g.position.y = 0;
    const kopf = (ud.hoehe || 2) + 0.2;
    if (e.hp != null && e.hp < 1 && !e.tot) overlay.push(['leiste', e.x + e.gr / 2, kopf, e.y + e.gr / 2, e.hp, e.typ === 'mauer' ? 22 : 46]);
    if (e.blase) overlay.push(['blase', e.x + e.gr / 2, kopf + 0.3, e.y + e.gr / 2, e.blase]);
    if (e.bau != null) overlay.push(['bau', e.x + e.gr / 2, kopf, e.y + e.gr / 2, e.bau, e.rest]);
  }
  for (const [k, en] of bauEintraege) if (!gesehen.has(k)) { entfernen(en.g); bauEintraege.delete(k); }
  if (gewaehlt) {
    auswahlRing.visible = true; auswahlRing.position.set(gewaehlt.x + gewaehlt.gr / 2, 0.04, gewaehlt.y + gewaehlt.gr / 2);
    auswahlRing.scale.setScalar(gewaehlt.gr * 1.05 + Math.sin(zeit * 5) * 0.05); auswahlRing.material.opacity = 0.6 + Math.sin(zeit * 5) * 0.3;
  } else auswahlRing.visible = false;

  // Truppen im Heerlager (nur im Dorf)
  const lagerGesehen = new Set();
  if (sz.lager && sz.lager.length) {
    const lager = sz.bauten.filter(e => e.typ === 'heerlager' && e.lvl >= 1 && !e.geist);
    let i = 0;
    for (const l of lager) for (let s = 0; s < 10 && i < sz.lager.length; s++, i++) {
      const key = l.key.id + ':' + s, typ = sz.lager[i];
      let f = lagerFiguren.get(key);
      if (!f || f.typ !== typ) { if (f) entfernen(f.g); f = { g: figurBauen(typ), typ }; szene.add(f.g); lagerFiguren.set(key, f); }
      lagerGesehen.add(key);
      const a = s / 10 * Math.PI * 2 + 0.3, r = 1.0 + (s % 2) * 0.35;
      f.g.position.set(l.x + l.gr / 2 + Math.cos(a) * r, typ === 'greif' ? 0.15 : 0, l.y + l.gr / 2 + Math.sin(a) * r);
      f.g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      const k = f.g.userData.k, t = f.g.userData.t;
      k.position.y = Math.sin(zeit * 2 + s) * 0.01;
      if (t.fluegelL) { t.fluegelL.rotation.z = 0.5 + Math.sin(zeit * 1.5 + s) * 0.1; t.fluegelR.rotation.z = -t.fluegelL.rotation.z; }
      if (t.funke) t.funke.scale.setScalar(0.7 + Math.random() * 0.6);
    }
  }
  for (const [k, f] of lagerFiguren) if (!lagerGesehen.has(k)) { entfernen(f.g); lagerFiguren.delete(k); }

  // Einheiten
  const eg = new Set();
  for (const u of sz.einheiten) {
    let en = einheitEintraege.get(u.key);
    if (!en) { en = { g: figurBauen(u.t), w: Math.atan2(u.rx || 1, u.ry || 1) }; szene.add(en.g); einheitEintraege.set(u.key, en); }
    eg.add(u.key);
    const g = en.g, k = g.userData.k, t = g.userData.t, ph = zeit * 11 + u.phase;
    const hoch = u.flug ? 1.7 + Math.sin(zeit * 3 + u.phase) * 0.12 : 0;
    g.position.set(u.x, hoch, u.y);
    if (u.rx || u.ry) en.w = winkelZu(en.w, Math.atan2(u.rx, u.ry), Math.min(1, dt * 10));
    g.rotation.y = en.w;
    const sw = u.lauf ? Math.sin(ph) : 0;
    if (t.beinL) { t.beinL.rotation.x = sw * 0.7; t.beinR.rotation.x = -sw * 0.7; }
    if (t.armL) t.armL.rotation.x = -sw * 0.5;
    if (t.armR) {
      const a = u.angriff == null ? 1e9 : u.angriff;
      t.armR.rotation.x = a < 350 ? -2.4 + (a / 350) * 2.6 : sw * 0.5;
    }
    k.position.y = u.lauf ? Math.abs(Math.sin(ph)) * 0.05 : 0;
    if (t.fluegelL) { const f = Math.sin(zeit * 9 + u.phase) * 0.7; t.fluegelL.rotation.z = f; t.fluegelR.rotation.z = -f; }
    if (t.funke) t.funke.scale.setScalar(0.6 + Math.random() * 0.8);
    if (u.hp < u.max) overlay.push(['leiste', u.x, hoch + (u.t === 'troll' ? 1.9 : u.flug ? 0.9 : 1.2), u.y, u.hp / u.max, 24, '#5fd0ff']);
  }
  for (const [k, en] of einheitEintraege) if (!eg.has(k)) { entfernen(en.g); einheitEintraege.delete(k); }

  // Geschosse
  const gg = new Set();
  for (const s of sz.geschosse) {
    let en = geschossEintraege.get(s.key);
    if (!en) {
      let m;
      if (s.art === 'pfeil') { m = new T3.Group(); const a = new T3.Mesh(geo('BoxGeometry', 0.04, 0.04, 0.55), mat('#5b3a1e')); const b = new T3.Mesh(geo('ConeGeometry', 0.05, 0.12, 4), mat('#ccc')); b.rotation.x = Math.PI / 2; b.position.z = 0.3; m.add(a); m.add(b); }
      else if (s.art === 'bombe') { m = new T3.Group(); m.add(new T3.Mesh(geo('SphereGeometry', 0.22, 10, 8), mat('#3b2a1a'))); const f = new T3.Mesh(geo('SphereGeometry', 0.07, 6, 5), mat('#ffcc33', { e: '#ff9900', ei: 2 })); f.position.y = 0.22; m.add(f); }
      else if (s.art === 'wind') m = new T3.Mesh(geo('TorusGeometry', 0.25, 0.05, 6, 16), new T3.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.8 }));
      else if (s.art === 'feuer') m = new T3.Mesh(geo('IcosahedronGeometry', 0.17, 1), mat('#ff8c1a', { e: '#ff6a00', ei: 2 }));
      else m = new T3.Mesh(geo('DodecahedronGeometry', s.art === 'stein' ? 0.16 : 0.07, 0), mat(s.art === 'stein' ? '#8d8d8d' : '#bbb'));
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      en = { m }; szene.add(m); geschossEintraege.set(s.key, en);
    }
    gg.add(s.key);
    const vorher = en.m.position.clone();
    en.m.position.set(s.x, s.h, s.y);
    if (s.art === 'pfeil' && vorher.distanceToSquared(en.m.position) > 1e-5) en.m.lookAt(vorher.multiplyScalar(-1).add(en.m.position.clone().multiplyScalar(2)));
    if (s.art === 'wind') { en.m.rotation.x = zeit * 12; en.m.rotation.y = zeit * 9; }
    if (s.art === 'feuer' && Math.random() < 0.5) teilchen(geo('IcosahedronGeometry', 1, 0), '#ffb340', s.x, s.h, s.y, 0, 0.3, 0, 0.25, 0.1, 0.02, { alpha: 0.8 });
  }
  for (const [k, en] of geschossEintraege) if (!gg.has(k)) { entfernen(en.m); geschossEintraege.delete(k); }

  verbotZeigen(sz.verbot);
  partikelSchritt(dt);
  renderer.render(szene, kamera);

  // 2D-Ebene
  o2.clearRect(0, 0, W, H);
  for (const o of overlay) {
    const [px, py, pz] = projiziere(o[1], o[2], o[3]);
    if (pz > 1) continue;
    if (o[0] === 'leiste') leiste(px, py, o[5], o[4], o[6] || (o[4] > 0.5 ? '#6fdc4f' : o[4] > 0.25 ? '#f6c343' : '#e2463b'));
    else if (o[0] === 'blase') blase(px, py - 18, o[4], Math.sin(zeit * 4) * 3);
    else if (o[0] === 'bau') {
      leiste(px, py, 56, o[4], '#4fc3f7');
      if (o[5]) { o2.font = '800 12px system-ui,sans-serif'; o2.textAlign = 'center'; o2.textBaseline = 'bottom'; o2.lineWidth = 3; o2.strokeStyle = 'rgba(0,0,0,.75)'; o2.strokeText('🔨 ' + o[5], px, py - 3); o2.fillStyle = '#fff'; o2.fillText('🔨 ' + o[5], px, py - 3); }
    }
  }
  o2.textAlign = 'center'; o2.textBaseline = 'middle'; o2.font = '800 16px system-ui,sans-serif';
  for (let i = texte.length - 1; i >= 0; i--) {
    const t = texte[i]; t.z += dt;
    if (t.z > 1.5) { texte.splice(i, 1); continue; }
    const [px, py] = projiziere(t.x, t.h + t.z * 0.9, t.y);
    o2.globalAlpha = Math.max(0, 1 - (t.z / 1.5) ** 2);
    o2.lineWidth = 4; o2.strokeStyle = 'rgba(0,0,0,.7)'; o2.strokeText(t.t, px, py); o2.fillStyle = t.farbe; o2.fillText(t.t, px, py);
  }
  o2.globalAlpha = 1;
}

function fokus(x, y, d) { ziel.set(x, 0, y); if (d) abstand = d; kameraSetzen(); }
return { init, groesse, bild2feld, pan, zoomBei, zentrieren, render, effekt, text, fokus };
})();
