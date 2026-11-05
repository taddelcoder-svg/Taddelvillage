'use strict';
/* =========================================================================
   Taddelvillage – Dorf aufbauen, Truppen ausbilden, Räuberdörfer angreifen.
   Alles in einer Datei, ohne Bibliotheken. Spielstand in localStorage („tv_stand“).
   ========================================================================= */
(() => {

/* ---------------------------------------------------------------- Grundlagen */
const N = 36;                 // Kartengröße in Feldern
const TW = 64, TH = 32;       // Feldgröße (isometrisch) in Weltpixeln
const MAX_RH = 8;
const SPEICHER = 'tv_stand';
const $ = id => document.getElementById(id);
const jetzt = () => Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.floor(n).toLocaleString('de-DE');
function dauerText(s) {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');
  const h = Math.floor(m / 60);
  return h + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
}
function mulberry(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------------------------------------------------------------- Gebäude */
const G = {
  rathaus:    { name: 'Rathaus', em: '🏛️', gr: 4, kat: 'dorf', res: 'gold', basis: 0, maxLvl: 8, hp: 1600, h: 34, wand: '#e0c58e', dach: '#c0392b',
                text: 'Das Herz deines Dorfes. Jede Stufe schaltet mehr Gebäude und höhere Stufen frei.' },
  goldmine:   { name: 'Goldmine', em: '⛏️', gr: 3, kat: 'wirtschaft', res: 'holz', basis: 150, maxLvl: 9, hp: 420, h: 18, wand: '#8d6e4e', dach: '#e8b923', prod: 'gold',
                text: 'Fördert ständig Gold. Antippen zum Einsammeln.' },
  saegewerk:  { name: 'Sägewerk', em: '🪚', gr: 3, kat: 'wirtschaft', res: 'gold', basis: 150, maxLvl: 9, hp: 420, h: 18, wand: '#b07a45', dach: '#4f7a2a', prod: 'holz',
                text: 'Sägt ständig Holz. Antippen zum Einsammeln.' },
  goldtruhe:  { name: 'Schatzkammer', em: '💰', gr: 3, kat: 'wirtschaft', res: 'holz', basis: 300, maxLvl: 9, hp: 700, h: 22, wand: '#8a7a62', dach: '#f2c230', lager: 'gold',
                text: 'Lagert Gold. Mehr Stufen = mehr Platz.' },
  holzlager:  { name: 'Holzlager', em: '🪵', gr: 3, kat: 'wirtschaft', res: 'gold', basis: 300, maxLvl: 9, hp: 700, h: 22, wand: '#8a5a2e', dach: '#6d8f3a', lager: 'holz',
                text: 'Lagert Holz. Mehr Stufen = mehr Platz.' },
  baumeister: { name: 'Baumeisterhütte', em: '👷', gr: 2, kat: 'wirtschaft', res: 'gold', basis: 0, maxLvl: 1, hp: 250, h: 14, wand: '#c49a6c', dach: '#3d7bd9',
                text: 'Jede Hütte bringt einen Baumeister. Mehr Baumeister = mehr gleichzeitige Baustellen.' },
  kaserne:    { name: 'Kaserne', em: '🎖️', gr: 3, kat: 'armee', res: 'holz', basis: 200, maxLvl: 6, hp: 550, h: 22, wand: '#9a7b5a', dach: '#8e2f2f',
                text: 'Bildet Truppen aus. Jede Stufe schaltet eine neue Truppe frei.' },
  heerlager:  { name: 'Heerlager', em: '⛺', gr: 4, kat: 'armee', res: 'holz', basis: 250, maxLvl: 8, hp: 400, h: 6, wand: '#b08a55', dach: '#c76b2a',
                text: 'Hier wartet deine Armee. Jede Stufe bringt 5 Plätze mehr.' },
  schmiede:   { name: 'Schmiede', em: '⚒️', gr: 3, kat: 'armee', res: 'holz', basis: 2000, maxLvl: 5, hp: 650, h: 24, wand: '#66666f', dach: '#d35400',
                text: 'Macht alle deine Truppen stärker: +20 % Leben und Schaden pro Stufe.' },
  schleuder:  { name: 'Steinschleuder', em: '🪨', gr: 3, kat: 'verteidigung', res: 'gold', basis: 250, maxLvl: 9, hp: 450, h: 16, wand: '#9a9a9a', dach: '#6d4c2f',
                vert: { reich: 8, schaden: 11, takt: 0.9, boden: true, luft: false, art: 'stein' }, text: 'Schleudert Steine auf Bodentruppen.' },
  bogenturm:  { name: 'Bogenturm', em: '🏹', gr: 3, kat: 'verteidigung', res: 'gold', basis: 600, maxLvl: 9, hp: 420, h: 38, wand: '#a0703f', dach: '#2e6b2e',
                vert: { reich: 10, schaden: 12, takt: 1.0, boden: true, luft: true, art: 'pfeil' }, text: 'Große Reichweite, trifft Boden- und Lufttruppen.' },
  moerser:    { name: 'Donnerfass', em: '💥', gr: 3, kat: 'verteidigung', res: 'gold', basis: 3000, maxLvl: 8, hp: 450, h: 14, wand: '#5a5a5a', dach: '#333',
                vert: { reich: 11, min: 4, schaden: 26, takt: 4.5, boden: true, luft: false, art: 'bombe', flaeche: 1.6 },
                text: 'Wirft explodierende Fässer: Flächenschaden, aber ein toter Winkel ganz nah dran.' },
  windturm:   { name: 'Windturm', em: '🌪️', gr: 3, kat: 'verteidigung', res: 'gold', basis: 6000, maxLvl: 8, hp: 800, h: 42, wand: '#a9c1d3', dach: '#4a6fa5',
                vert: { reich: 10, schaden: 90, takt: 1.0, boden: false, luft: true, art: 'wind' }, text: 'Holt Flieger mit heftigen Böen vom Himmel.' },
  mauer:      { name: 'Mauer', em: '🧱', gr: 1, kat: 'verteidigung', res: 'gold', basis: 50, maxLvl: 9, hp: 350, h: 13, wand: '#a3a3a3', dach: '#c7c7c7',
                text: 'Hält Bodentruppen auf. Sprengmaulwürfe hassen sie.' },
};
// Höchstanzahl je Rathaus-Stufe (Index = Stufe - 1)
const ANZAHL = {
  rathaus: [1, 1, 1, 1, 1, 1, 1, 1],
  goldmine: [1, 2, 3, 4, 5, 6, 6, 7], saegewerk: [1, 2, 3, 4, 5, 6, 6, 7],
  goldtruhe: [1, 1, 2, 2, 2, 3, 3, 4], holzlager: [1, 1, 2, 2, 2, 3, 3, 4],
  baumeister: [5, 5, 5, 5, 5, 5, 5, 5],
  kaserne: [1, 1, 1, 1, 1, 1, 1, 1],
  heerlager: [1, 1, 2, 2, 3, 3, 4, 4],
  schmiede: [0, 0, 1, 1, 1, 1, 1, 1],
  schleuder: [2, 2, 3, 3, 4, 4, 5, 5],
  bogenturm: [1, 2, 2, 3, 3, 4, 4, 5],
  moerser: [0, 0, 1, 1, 2, 2, 3, 3],
  windturm: [0, 0, 0, 1, 1, 2, 2, 3],
  mauer: [25, 50, 75, 100, 125, 150, 175, 200],
};
const HUETTE_KOSTEN = [0, 500, 2000, 6000, 15000];
const BAUZEIT = [10, 40, 120, 300, 720, 1500, 2700, 4200, 6000];
const LAGER_KAP = [1500, 3000, 6000, 12000, 25000, 50000, 90000, 150000, 250000];
const RH_KAP = [2000, 4000, 8000, 15000, 30000, 60000, 100000, 150000];
const istRohstoff = t => t === 'goldmine' || t === 'saegewerk' || t === 'goldtruhe' || t === 'holzlager' || t === 'rathaus';

function maxLvl(typ, rh) {
  const g = G[typ];
  if (typ === 'rathaus') return MAX_RH;
  if (typ === 'schmiede') return clamp(rh - 2, 1, g.maxLvl);
  return Math.min(g.maxLvl, rh + 1);
}
function kosten(typ, lvl) {
  if (typ === 'rathaus') return { res: 'gold', n: Math.round(1000 * Math.pow(2.6, lvl - 2) / 10) * 10 };
  if (typ === 'baumeister') return { res: 'gold', n: HUETTE_KOSTEN[Math.min(4, anzahl('baumeister'))] || 0 };
  return { res: G[typ].res, n: Math.round(G[typ].basis * Math.pow(1.9, lvl - 1) / 5) * 5 };
}
function bauzeit(typ, lvl) {
  if (typ === 'mauer') return 0;
  if (typ === 'baumeister') return 10;
  return BAUZEIT[lvl - 1] * (typ === 'rathaus' ? 1.5 : 1);
}
const lebenVon = (typ, lvl) => Math.round(G[typ].hp * Math.pow(1.25, Math.max(0, lvl - 1)));
const prodRate = lvl => 500 * Math.pow(1.55, lvl - 1);     // pro Stunde
const prodKap = lvl => prodRate(lvl) * 2;
const lagerPlatz = lvl => 15 + 5 * lvl;
const vertSchaden = (typ, lvl) => G[typ].vert.schaden * Math.pow(1.22, lvl - 1);

/* ---------------------------------------------------------------- Truppen */
const T = {
  raufbold:    { kurz: 'Raufbold', name: 'Raufbold', em: '🪓', platz: 1, kosten: 25, zeit: 4, hp: 60, schaden: 11, takt: 1.0, reich: 0.6, tempo: 1.6, ziel: 'alle', kas: 1, farbe: '#e4a63a',
                 text: 'Zäher Nahkämpfer für alles.' },
  schleuderin: { kurz: 'Schleuder', name: 'Schleuderin', em: '🎯', platz: 1, kosten: 50, zeit: 6, hp: 26, schaden: 9, takt: 1.0, reich: 3.5, tempo: 1.9, ziel: 'alle', kas: 2, farbe: '#d14f8f', fern: true,
                 text: 'Schießt über Mauern hinweg, hält aber wenig aus.' },
  waschbaer:   { kurz: 'Waschbär', name: 'Plünder-Waschbär', em: '🦝', platz: 1, kosten: 40, zeit: 5, hp: 34, schaden: 12, takt: 1.0, reich: 0.6, tempo: 2.8, ziel: 'rohstoff', bonus: 2, kas: 3, farbe: '#8c8c8c',
                 text: 'Flink und gierig: geht auf Rohstoffe und macht dort doppelten Schaden.' },
  maulwurf:    { kurz: 'Maulwurf', name: 'Sprengmaulwurf', em: '🧨', platz: 2, kosten: 100, zeit: 8, hp: 24, schaden: 24, takt: 1, reich: 0.6, tempo: 2.4, ziel: 'mauer', bonus: 16, flaeche: 1.4, kas: 4, farbe: '#9b6a3a', selbst: true,
                 text: 'Rennt zur nächsten Mauer und sprengt sie (16-facher Schaden an Mauern).' },
  troll:       { kurz: 'Troll', name: 'Steintroll', em: '🗿', platz: 5, kosten: 250, zeit: 18, hp: 560, schaden: 26, takt: 2.0, reich: 0.8, tempo: 1.0, ziel: 'verteidigung', kas: 5, farbe: '#7d8a96',
                 text: 'Ein Felsbrocken auf Beinen. Geht nur auf Verteidigungen los.' },
  greif:       { kurz: 'Greif', name: 'Greif', em: '🦅', platz: 6, kosten: 500, zeit: 28, hp: 400, schaden: 52, takt: 1.6, reich: 2.4, tempo: 1.7, ziel: 'alle', flug: true, flaeche: 0.9, kas: 6, farbe: '#c9a227', fern: true,
                 text: 'Fliegt über Mauern und trifft mehrere Gebäude auf einmal.' },
};
const T_LISTE = Object.keys(T);

/* ---------------------------------------------------------------- Spielstand */
let S = null;
function neuerStand() {
  S = { v: 1, gold: 1500, holz: 1500, troph: 0, nextId: 1, bauten: [], armee: { raufbold: 20 }, schlange: [], schlangeStart: 0,
        kampagne: {}, stat: { angriffe: 0, siege: 0, sterne: 0, geplündert: 0 }, erstellt: jetzt(), hilfe: false };
  const add = (typ, x, y) => S.bauten.push({ id: S.nextId++, typ, x, y, lvl: 1, ziel: 0, ende: 0, start: 0, letzte: jetzt() });
  add('rathaus', 16, 16); add('baumeister', 21, 16); add('goldmine', 11, 16); add('saegewerk', 16, 21);
  add('kaserne', 16, 11); add('heerlager', 11, 10); add('schleuder', 20, 20); add('goldtruhe', 21, 11); add('holzlager', 11, 21);
}
function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (roh) { S = JSON.parse(roh); if (!S || !Array.isArray(S.bauten)) S = null; }
  } catch (e) { S = null; }
  if (!S) neuerStand();
  S.armee = S.armee || {}; S.schlange = S.schlange || []; S.kampagne = S.kampagne || {}; S.stat = S.stat || { angriffe: 0, siege: 0, sterne: 0, geplündert: 0 };
}
let speicherBedarf = false;
function speichern() {
  // Der Melder lädt gerade einen Cloud-Stand und lädt die Seite neu – dann nichts überschreiben
  try { if (sessionStorage.getItem('sl_geladen')) return; } catch (e) {}
  try { localStorage.setItem(SPEICHER, JSON.stringify(S)); speicherBedarf = false; } catch (e) {}
}
function merken() { speicherBedarf = true; }
setInterval(() => { if (speicherBedarf) speichern(); }, 3000);
addEventListener('pagehide', speichern);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') speichern(); });

/* ---------------------------------------------------------------- Regeln */
const rh = () => { const r = S.bauten.find(b => b.typ === 'rathaus'); return r ? r.lvl : 1; };
const anzahl = typ => S.bauten.filter(b => b.typ === typ).length;
const maxAnzahl = typ => ANZAHL[typ][rh() - 1];
function maxRes(res) {
  let k = RH_KAP[rh() - 1];
  for (const b of S.bauten) if (G[b.typ].lager === res && b.lvl >= 1) k += LAGER_KAP[b.lvl - 1];
  return k;
}
const baumeisterGesamt = () => S.bauten.filter(b => b.typ === 'baumeister' && b.lvl >= 1).length;
const baumeisterBelegt = () => S.bauten.filter(b => b.ende > 0).length;
const baumeisterFrei = () => baumeisterGesamt() - baumeisterBelegt();
const kaserneLvl = () => Math.max(0, ...S.bauten.filter(b => b.typ === 'kaserne').map(b => b.lvl));
const schmiedeLvl = () => Math.max(0, ...S.bauten.filter(b => b.typ === 'schmiede').map(b => b.lvl));
function armeePlatz() { let p = 0; for (const b of S.bauten) if (b.typ === 'heerlager' && b.lvl >= 1) p += lagerPlatz(b.lvl); return p; }
function armeeBelegt() { let p = 0; for (const t in S.armee) p += (S.armee[t] || 0) * T[t].platz; return p; }
function schlangeBelegt() { let p = 0; for (const t of S.schlange) p += T[t].platz; return p; }
function menge(b) {
  const g = G[b.typ];
  if (!g.prod || b.lvl < 1) return 0;
  const r = prodRate(b.lvl);
  return Math.min(prodKap(b.lvl), r * Math.max(0, jetzt() - b.letzte) / 3.6e6);
}
// Fügt Rohstoffe hinzu (höchstens bis zum Lager-Maximum) und gibt zurück, wie viel wirklich dazukam
function hinzu(res, n) {
  const vorher = S[res];
  if (n > 0) S[res] = Math.max(vorher, Math.min(maxRes(res), vorher + n));
  else S[res] = Math.max(0, vorher + n);
  return S[res] - vorher;
}
function einsammeln(b, leise) {
  const g = G[b.typ], m = Math.floor(menge(b));
  if (m < 1) return false;
  const platz = maxRes(g.prod) - S[g.prod];
  if (platz <= 0) { if (!leise) melden('Lager voll! Bau ein größeres Lager.'); return false; }
  const n = Math.min(m, platz);
  S[g.prod] += n;
  b.letzte = jetzt() - (m - n) / prodRate(b.lvl) * 3.6e6;
  const [sx, sy] = iso(b.x + g.gr / 2, b.y + g.gr / 2);
  schwebText(sx, sy - 40, '+' + fmt(n) + (g.prod === 'gold' ? ' 🪙' : ' 🪵'), g.prod === 'gold' ? '#ffe066' : '#ffcf9e');
  ton('muenze'); merken();
  return true;
}
function bezahlen(k) {
  if (S[k.res] < k.n) { melden('Nicht genug ' + (k.res === 'gold' ? 'Gold 🪙' : 'Holz 🪵') + ' (' + fmt(k.n - S[k.res]) + ' fehlen)'); ton('nein'); return false; }
  S[k.res] -= k.n; return true;
}
function belegung(ausser) {
  const occ = new Int32Array(N * N).fill(-1);
  for (const b of S.bauten) {
    if (b === ausser) continue;
    const s = G[b.typ].gr;
    for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) if (x >= 0 && y >= 0 && x < N && y < N) occ[y * N + x] = b.id;
  }
  return occ;
}
function frei(typ, x, y, ausser, occ) {
  const s = G[typ].gr;
  if (x < 0 || y < 0 || x + s > N || y + s > N) return false;
  occ = occ || belegung(ausser);
  for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) if (occ[yy * N + xx] !== -1) return false;
  return true;
}
function freierPlatz(typ, cx, cy) {
  const occ = belegung(null), s = G[typ].gr;
  cx = Math.round(cx - s / 2); cy = Math.round(cy - s / 2);
  for (let r = 0; r < N; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    if (frei(typ, cx + dx, cy + dy, null, occ)) return [cx + dx, cy + dy];
  }
  return null;
}

/* ---------------------------------------------------------------- Zeit-Takt (Dorf) */
function dorfTakt() {
  const t = jetzt();
  for (const b of S.bauten) {
    if (b.ende && t >= b.ende) {
      const neu = b.lvl === 0;
      b.lvl = b.ziel; b.ziel = 0; b.ende = 0; b.start = 0;
      if (neu) b.letzte = t;
      melden(G[b.typ].em + ' ' + G[b.typ].name + (neu ? ' fertig gebaut!' : ' ist jetzt Stufe ' + b.lvl + '!'));
      ton('fertig'); merken();
      if (gewaehlt === b) infoZeigen();
    }
  }
  // Ausbildung
  let geaendert = false;
  if (kaserneLvl() < 1) S.schlangeStart = t;
  while (S.schlange.length && kaserneLvl() >= 1) {
    const typ = S.schlange[0], dauer = T[typ].zeit * 1000;
    if (S.schlangeStart + dauer > t) break;
    if (armeeBelegt() + T[typ].platz > armeePlatz()) { S.schlangeStart = t - dauer; break; }
    S.armee[typ] = (S.armee[typ] || 0) + 1;
    S.schlange.shift(); S.schlangeStart += dauer; geaendert = true;
  }
  if (!S.schlange.length) S.schlangeStart = t;
  if (geaendert) { merken(); if ($('fArmee').classList.contains('offen')) armeeZeigen(); }
}

/* ---------------------------------------------------------------- Ton */
let tonAn = true, ac = null;
try { tonAn = localStorage.getItem('tvgeraet_ton') !== 'aus'; } catch (e) {}
function ton(art) {
  if (!tonAn) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    const P = { klick: [520, 0.05, 'triangle', 0.08], muenze: [880, 0.12, 'square', 0.05], bau: [220, 0.18, 'sawtooth', 0.06],
      fertig: [660, 0.3, 'triangle', 0.1], nein: [140, 0.2, 'square', 0.06], schuss: [300, 0.06, 'square', 0.025],
      boom: [70, 0.35, 'sawtooth', 0.12], setzen: [400, 0.06, 'triangle', 0.06], stern: [990, 0.4, 'triangle', 0.12], kaputt: [110, 0.25, 'sawtooth', 0.08] }[art];
    if (!P) return;
    o.type = P[2]; o.frequency.setValueAtTime(P[0], t);
    if (art === 'fertig' || art === 'stern') o.frequency.exponentialRampToValueAtTime(P[0] * 1.5, t + P[1]);
    if (art === 'boom' || art === 'kaputt') o.frequency.exponentialRampToValueAtTime(30, t + P[1]);
    g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[1]);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + P[1] + 0.02);
  } catch (e) {}
}

/* ---------------------------------------------------------------- Kamera */
const cv = $('welt'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
const cam = { x: 0, y: 0, z: 1 };
const iso = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
function bild2feld(px, py) {
  const wx = (px - cam.x) / cam.z, wy = (py - cam.y) / cam.z, a = wx / (TW / 2), b = wy / (TH / 2);
  return [(a + b) / 2, (b - a) / 2];
}
function groesse() {
  DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  kameraBegrenzen();
}
function kameraZentrieren() {
  // Im Kampf weiter raus, damit man den Rand zum Absetzen sieht
  cam.z = modus === 'kampf'
    ? clamp(Math.max(Math.min(W / (N * TW), H / (N * TH)) * 1.2, W / (24 * TW)), 0.3, 1.3)
    : clamp(Math.max(Math.min(W / (N * TW), H / (N * TH)) * 1.5, W / (15 * TW)), 0.35, 1.3);
  const [cx, cy] = iso(N / 2, N / 2);
  cam.x = W / 2 - cx * cam.z; cam.y = H / 2 - cy * cam.z;
}
function kameraBegrenzen() {
  const [cx, cy] = iso(N / 2, N / 2);
  let sx = cx * cam.z + cam.x, sy = cy * cam.z + cam.y;
  const rx = N * TW / 2 * cam.z, ry = N * TH / 2 * cam.z;
  sx = clamp(sx, W / 2 - rx, W / 2 + rx); sy = clamp(sy, H / 2 - ry, H / 2 + ry);
  cam.x = sx - cx * cam.z; cam.y = sy - cy * cam.z;
}
function zoomBei(f, px, py) {
  const z2 = clamp(cam.z * f, 0.3, 2.4); f = z2 / cam.z;
  cam.x = px - (px - cam.x) * f; cam.y = py - (py - cam.y) * f; cam.z = z2; kameraBegrenzen();
}

/* ---------------------------------------------------------------- Zeichenhilfen */
const farbCache = new Map();
function ton2(hex, f) {
  const k = hex + f; let c = farbCache.get(k);
  if (c) return c;
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round((n >> 16 & 255) * f), 0, 255), g = clamp(Math.round((n >> 8 & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
  c = `rgb(${r},${g},${b})`; farbCache.set(k, c); return c;
}
function poly(p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.fill(); }
function raute(x0, y0, x1, y1, farbe, z) {
  z = z || 0; ctx.fillStyle = farbe;
  const a = iso(x0, y0), b = iso(x1, y0), c = iso(x1, y1), d = iso(x0, y1);
  poly([[a[0], a[1] - z], [b[0], b[1] - z], [c[0], c[1] - z], [d[0], d[1] - z]]);
}
function quader(x0, y0, x1, y1, z0, h, farbe, oben) {
  const a = iso(x0, y0), b = iso(x1, y0), c = iso(x1, y1), d = iso(x0, y1), z1 = z0 + h;
  ctx.fillStyle = ton2(farbe, 0.82); poly([[d[0], d[1] - z0], [c[0], c[1] - z0], [c[0], c[1] - z1], [d[0], d[1] - z1]]);
  ctx.fillStyle = ton2(farbe, 0.64); poly([[c[0], c[1] - z0], [b[0], b[1] - z0], [b[0], b[1] - z1], [c[0], c[1] - z1]]);
  ctx.fillStyle = oben || ton2(farbe, 1.08); poly([[a[0], a[1] - z1], [b[0], b[1] - z1], [c[0], c[1] - z1], [d[0], d[1] - z1]]);
}
function dachPyramide(x0, y0, x1, y1, z, hoehe, farbe) {
  const a = iso(x0, y0), b = iso(x1, y0), c = iso(x1, y1), d = iso(x0, y1), m = iso((x0 + x1) / 2, (y0 + y1) / 2);
  const A = [a[0], a[1] - z], B = [b[0], b[1] - z], C = [c[0], c[1] - z], D = [d[0], d[1] - z], M = [m[0], m[1] - z - hoehe];
  ctx.fillStyle = ton2(farbe, 1.15); poly([A, B, M]); poly([D, A, M]);
  ctx.fillStyle = ton2(farbe, 0.95); poly([D, C, M]);
  ctx.fillStyle = ton2(farbe, 0.75); poly([C, B, M]);
}
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
const emojiCache = new Map();
function emo(ch, x, y, groesse) {
  const g = Math.round(groesse), k = ch + '|' + g;
  let c = emojiCache.get(k);
  if (!c) {
    c = document.createElement('canvas'); const s = g * 2 + 8; c.width = c.height = s;
    const k2 = c.getContext('2d'); k2.font = (g * 2) + 'px ' + EMOJI_FONT; k2.textAlign = 'center'; k2.textBaseline = 'middle';
    k2.fillText(ch, s / 2, s / 2 + g * 0.12); emojiCache.set(k, c);
  }
  const s = c.width / 2;
  ctx.drawImage(c, x - s / 2, y - s / 2, s, s);
}
function balken(x, y, w, anteil, farbe) {
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = farbe; ctx.fillRect(x - w / 2, y, w * clamp(anteil, 0, 1), 4);
}

// Boden einmal vorzeichnen
const RAND = 5;
let boden = null;
function bodenMalen() {
  const breite = (N + RAND * 2) * TW, hoehe = (N + RAND * 2) * TH;
  boden = document.createElement('canvas'); boden.width = breite; boden.height = hoehe;
  const b = boden.getContext('2d');
  const ox = breite / 2, oy = RAND * TH;   // Weltpunkt (0,0) im Bild
  const r = mulberry(7);
  b.fillStyle = '#2c6a26'; b.fillRect(0, 0, breite, hoehe);
  const fliese = (x, y, farbe) => {
    const [ax, ay] = iso(x, y), [bx, by] = iso(x + 1, y), [cx, cy] = iso(x + 1, y + 1), [dx, dy] = iso(x, y + 1);
    b.fillStyle = farbe; b.beginPath(); b.moveTo(ox + ax, oy + ay); b.lineTo(ox + bx, oy + by); b.lineTo(ox + cx, oy + cy); b.lineTo(ox + dx, oy + dy); b.closePath(); b.fill();
  };
  for (let y = -RAND; y < N + RAND; y++) for (let x = -RAND; x < N + RAND; x++) {
    const innen = x >= 0 && y >= 0 && x < N && y < N;
    if (innen) fliese(x, y, (x + y) % 2 ? '#74c24f' : '#6cb948');
    else fliese(x, y, (x + y) % 2 ? '#3f8a33' : '#3a8230');
  }
  // Rand des Spielfelds
  b.strokeStyle = 'rgba(255,255,255,.35)'; b.lineWidth = 3; b.beginPath();
  [[0, 0], [N, 0], [N, N], [0, N]].forEach((p, i) => { const [x, y] = iso(p[0], p[1]); i ? b.lineTo(ox + x, oy + y) : b.moveTo(ox + x, oy + y); });
  b.closePath(); b.stroke();
  // Bäume, Büsche und Steine außen herum
  const baeume = [];
  for (let i = 0; i < 520; i++) {
    const x = -RAND + r() * (N + RAND * 2), y = -RAND + r() * (N + RAND * 2);
    if (x > -0.6 && y > -0.6 && x < N + 0.6 && y < N + 0.6) continue;
    baeume.push([x, y, r()]);
  }
  baeume.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
  b.textAlign = 'center'; b.textBaseline = 'bottom';
  for (const [x, y, z] of baeume) {
    const [sx, sy] = iso(x, y);
    const ch = z < 0.55 ? '🌲' : z < 0.8 ? '🌳' : z < 0.92 ? '🌿' : '🪨';
    const gr = ch === '🌿' || ch === '🪨' ? 18 : 30 + z * 18;
    b.fillStyle = 'rgba(0,0,0,.18)'; b.beginPath(); b.ellipse(ox + sx, oy + sy, gr * 0.45, gr * 0.2, 0, 0, Math.PI * 2); b.fill();
    b.font = gr + 'px ' + EMOJI_FONT; b.fillText(ch, ox + sx, oy + sy + gr * 0.12);
  }
  // ein paar Blumen auf dem Feld
  for (let i = 0; i < 70; i++) {
    const [sx, sy] = iso(r() * N, r() * N);
    b.fillStyle = ['#fff7a8', '#ffffff', '#ffb3d1', '#9be37d'][i % 4]; b.globalAlpha = 0.6;
    b.beginPath(); b.arc(ox + sx, oy + sy, 2.2, 0, Math.PI * 2); b.fill(); b.globalAlpha = 1;
  }
  boden.ox = ox; boden.oy = oy;
}

/* ---------------------------------------------------------------- Gebäude zeichnen */
const zeit0 = performance.now();
function bauZeichnen(typ, x, y, lvl, z) {
  const g = G[typ], s = g.gr;
  if (z.tot) { truemmer(x, y, s, typ === 'mauer'); return; }
  if (z.geist) ctx.globalAlpha = 0.8;
  if (z.geist) raute(x, y, x + s, y + s, z.geist === 'ok' ? 'rgba(90,255,90,.55)' : 'rgba(255,60,60,.6)');
  else if (typ !== 'mauer') raute(x + 0.05, y + 0.05, x + s - 0.05, y + s - 0.05, 'rgba(110,80,40,.32)');
  const st = 1 + 0.05 * Math.max(0, lvl - 1);
  if (typ === 'mauer') mauerZeichnen(x, y, lvl, z.nachbarn || 0);
  else if (lvl < 1) {
    quader(x + 0.3, y + 0.3, x + s - 0.3, y + s - 0.3, 0, 5, '#c8a06a');
    const [mx, my] = iso(x + s / 2, y + s / 2); emo('🔨', mx, my - 18, 22);
  } else if (typ === 'heerlager') {
    raute(x + 0.25, y + 0.25, x + s - 0.25, y + s - 0.25, '#c9a46b');
    const [mx, my] = iso(x + s / 2, y + s / 2);
    const fl = 1 + Math.sin((performance.now() - zeit0) / 120) * 0.08;
    emo('🔥', mx, my - 10, 20 * fl);
    [[0.9, 0.9], [s - 0.9, 0.9], [0.9, s - 0.9], [s - 0.9, s - 0.9]].forEach(([dx, dy], i) => {
      if (i >= Math.min(4, 1 + Math.ceil(lvl / 2))) return;
      const [tx, ty] = iso(x + dx, y + dy); emo('⛺', tx, ty - 12, 24);
    });
  } else if (g.vert) {
    const ins = typ === 'moerser' ? 0.4 : typ === 'schleuder' ? 0.35 : 0.6;
    quader(x + ins, y + ins, x + s - ins, y + s - ins, 0, g.h * st, g.wand);
    quader(x + ins - 0.15, y + ins - 0.15, x + s - ins + 0.15, y + s - ins + 0.15, g.h * st, 5, g.dach);
    if (lvl >= 5) quader(x + ins - 0.15, y + ins - 0.15, x + s - ins + 0.15, y + s - ins + 0.15, g.h * st + 5, 1.5, '#f2c230');
    const [mx, my] = iso(x + s / 2, y + s / 2);
    emo(g.em, mx, my - g.h * st - 20, 30);
  } else {
    const ins = typ === 'rathaus' ? 0.35 : 0.3, hh = g.h * st, dh = 8 + s * 5;
    quader(x + ins, y + ins, x + s - ins, y + s - ins, 0, hh, g.wand);
    // Fenster/Tür auf der Vorderseite
    const [tx, ty] = iso(x + s / 2, y + s - ins);
    ctx.fillStyle = 'rgba(60,35,15,.85)'; ctx.fillRect(tx - 5, ty - Math.min(14, hh - 2), 10, Math.min(14, hh - 2));
    dachPyramide(x + ins - 0.12, y + ins - 0.12, x + s - ins + 0.12, y + s - ins + 0.12, hh, dh, g.dach);
    const [mx, my] = iso(x + s / 2, y + s / 2);
    if (typ === 'rathaus') {
      ctx.fillStyle = '#5b3a1e'; ctx.fillRect(mx - 1, my - hh - dh - 22, 2, 22);
      ctx.fillStyle = lvl >= 5 ? '#f2c230' : '#3fae3a'; ctx.beginPath(); ctx.moveTo(mx + 1, my - hh - dh - 22); ctx.lineTo(mx + 15, my - hh - dh - 17); ctx.lineTo(mx + 1, my - hh - dh - 12); ctx.fill();
      emo('🏛️', mx, my - hh * 0.45, 22);
    } else emo(g.em, mx, my - hh - dh - 8, 24);
  }
  ctx.globalAlpha = 1;
  const [mx, my] = iso(x + s / 2, y + s / 2), oben = my - (typ === 'mauer' ? 22 : g.h + 8 + s * 5 + 26);
  if (z.bau != null) {
    ctx.strokeStyle = '#7a4f23'; ctx.lineWidth = 2;
    const a = iso(x + 0.2, y + s - 0.2), b2 = iso(x + s - 0.2, y + s - 0.2), c = iso(x + s - 0.2, y + 0.2);
    ctx.beginPath(); for (const p of [a, b2, c]) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - g.h - 10); } ctx.stroke();
    emo('🔨', mx + 18, oben + 4, 16);
    balken(mx, oben + 14, 44, z.bau, '#4fc3f7');
  }
  if (z.blase) {
    const hop = Math.sin((performance.now() - zeit0) / 250) * 3;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(mx, oben - 2 + hop, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 2; ctx.stroke();
    emo(z.blase, mx, oben - 2 + hop, 16);
  }
  if (z.gewaehlt) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + Math.sin((performance.now() - zeit0) / 180) * 0.3) + ')'; ctx.lineWidth = 2.5;
    const a = iso(x, y), b2 = iso(x + s, y), c = iso(x + s, y + s), d = iso(x, y + s);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.stroke();
  }
  if (z.hp != null && z.hp < 1) balken(mx, oben + 4, typ === 'mauer' ? 20 : 40, z.hp, z.hp > 0.5 ? '#6fdc4f' : z.hp > 0.25 ? '#f6c343' : '#e2463b');
}
function mauerZeichnen(x, y, lvl, nb) {
  const farbe = ['#a3a3a3', '#a3a3a3', '#8e9aa6', '#b38b5d', '#9c6b4a', '#d9c27a', '#6e7f8f', '#4d5763', '#e3b23c'][lvl - 1] || '#a3a3a3';
  const h = 12 + lvl;
  quader(x + 0.22, y + 0.22, x + 0.78, y + 0.78, 0, h, farbe);
  if (nb & 1) quader(x + 0.78, y + 0.3, x + 1.22, y + 0.7, 0, h - 3, farbe);
  if (nb & 2) quader(x + 0.3, y + 0.78, x + 0.7, y + 1.22, 0, h - 3, farbe);
}
function truemmer(x, y, s, klein) {
  raute(x + 0.1, y + 0.1, x + s - 0.1, y + s - 0.1, 'rgba(60,45,30,.55)');
  if (klein) { const [mx, my] = iso(x + 0.5, y + 0.5); ctx.fillStyle = '#7a7a7a'; ctx.fillRect(mx - 4, my - 3, 5, 3); ctx.fillRect(mx + 1, my - 1, 4, 3); return; }
  const r = mulberry(x * 97 + y * 13);
  for (let i = 0; i < 4 + s * 2; i++) {
    const [px, py] = iso(x + 0.3 + r() * (s - 0.6), y + 0.3 + r() * (s - 0.6));
    ctx.fillStyle = i % 2 ? '#6b5a48' : '#8a8a8a'; ctx.fillRect(px - 3, py - 4, 6 + r() * 4, 4 + r() * 3);
  }
}
function mauerNachbarn(liste) {
  const m = new Set(); for (const b of liste) if (b.typ === 'mauer' && !b.tot) m.add(b.x + ',' + b.y);
  return b => (m.has((b.x + 1) + ',' + b.y) ? 1 : 0) | (m.has(b.x + ',' + (b.y + 1)) ? 2 : 0);
}

/* ---------------------------------------------------------------- Effekte */
let texte = [], effekte = [];
function schwebText(x, y, text, farbe) { texte.push({ x, y, text, farbe, t: 0 }); }
function effekt(x, y, art, gr) { effekte.push({ x, y, art, gr: gr || 1, t: 0 }); }
function effekteZeichnen(dt) {
  for (const e of effekte) {
    e.t += dt; const p = e.t / 0.5;
    if (e.art === 'boom') {
      ctx.globalAlpha = Math.max(0, 1 - p); ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 34 * e.gr * p + 6, 17 * e.gr * p + 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(e.x, e.y - 4, 18 * e.gr * p, 9 * e.gr * p, 0, 0, Math.PI * 2); ctx.fill();
    } else if (e.art === 'staub') {
      ctx.globalAlpha = Math.max(0, 0.8 - p * 0.8); ctx.fillStyle = '#c9b08a';
      for (let i = 0; i < 5; i++) { const a = i * 1.26; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * 26 * p * e.gr, e.y - 10 - Math.sin(a) * 12 * p * e.gr - p * 16, 9 * e.gr * (1 - p * 0.4), 0, Math.PI * 2); ctx.fill(); }
    } else if (e.art === 'treffer') {
      ctx.globalAlpha = Math.max(0, 1 - p * 2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y, 3 + p * 10, 0, Math.PI * 2); ctx.fill();
    } else if (e.art === 'setzen') {
      ctx.globalAlpha = Math.max(0, 1 - p); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y, 6 + p * 18, 3 + p * 9, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  effekte = effekte.filter(e => e.t < 0.5);
  ctx.textAlign = 'center'; ctx.font = '800 15px system-ui,sans-serif';
  for (const t of texte) {
    t.t += dt; ctx.globalAlpha = Math.max(0, 1 - t.t / 1.4);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(t.text, t.x, t.y - t.t * 30);
    ctx.fillStyle = t.farbe; ctx.fillText(t.text, t.x, t.y - t.t * 30);
  }
  ctx.globalAlpha = 1;
  texte = texte.filter(t => t.t < 1.4);
}

/* ---------------------------------------------------------------- Meldungen & Fenster */
let meldTimer = 0;
function melden(text) {
  const m = $('meldung'); m.textContent = text; m.classList.add('zeigen');
  clearTimeout(meldTimer); meldTimer = setTimeout(() => m.classList.remove('zeigen'), 2200);
}
function oeffnen(id) { $(id).classList.add('offen'); }
function schliessen(id) { $(id).classList.remove('offen'); }
document.querySelectorAll('.fenster').forEach(f => {
  f.addEventListener('click', e => { if (e.target === f && f.id !== 'fErgebnis') schliessen(f.id); });
  f.querySelectorAll('[data-zu]').forEach(k => k.addEventListener('click', () => { ton('klick'); schliessen(f.id); }));
});
function frage(titel, text, ja, jaText) {
  $('frageTitel').textContent = titel; $('frageText').textContent = text; $('frageJa').textContent = jaText || 'OK';
  $('frageJa').onclick = () => { schliessen('fFrage'); ja(); };
  $('frageNein').onclick = () => schliessen('fFrage');
  oeffnen('fFrage');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const resEm = r => r === 'gold' ? '🪙' : '🪵';

/* ---------------------------------------------------------------- Dorf: Auswahl, Bauen, Verschieben */
let modus = 'dorf';
let gewaehlt = null;      // gewähltes Gebäude
let platz = null;         // { typ, x, y } beim Neubau
let zieh = null;          // laufendes Ziehen

function bauAn(fx, fy) {
  const x = Math.floor(fx), y = Math.floor(fy);
  for (let i = S.bauten.length - 1; i >= 0; i--) {
    const b = S.bauten[i], s = G[b.typ].gr;
    if (x >= b.x && x < b.x + s && y >= b.y && y < b.y + s) return b;
  }
  return null;
}
function waehlen(b) { gewaehlt = b; infoZeigen(); }
function infoZeigen() {
  const box = $('info');
  if (!gewaehlt || modus !== 'dorf' || platz) { box.classList.remove('offen'); return; }
  const b = gewaehlt, g = G[b.typ], r = rh(), ml = maxLvl(b.typ, r);
  let h = `<h3>${g.em} ${esc(g.name)} <span class="kleintext">Stufe ${b.lvl}${b.ende ? ' → ' + b.ziel : ''}</span></h3><p>${esc(g.text)}</p>`;
  const lv = Math.max(1, b.lvl);
  const werte = [];
  werte.push('❤️ ' + fmt(lebenVon(b.typ, lv)));
  if (g.prod) werte.push(resEm(g.prod) + ' ' + fmt(prodRate(lv)) + '/h · fasst ' + fmt(prodKap(lv)));
  if (g.lager) werte.push('Lager ' + fmt(LAGER_KAP[lv - 1]) + ' ' + resEm(g.lager));
  if (b.typ === 'rathaus') werte.push('Lager je ' + fmt(RH_KAP[lv - 1]));
  if (b.typ === 'heerlager') werte.push('👥 ' + lagerPlatz(lv) + ' Plätze');
  if (b.typ === 'kaserne') werte.push('Truppen: ' + T_LISTE.filter(t => T[t].kas <= lv).map(t => T[t].em).join(' '));
  if (b.typ === 'schmiede') werte.push('Truppen +' + Math.round((Math.pow(1.2, lv) - 1) * 100) + ' %');
  if (g.vert) werte.push('⚔️ ' + vertSchaden(b.typ, lv).toFixed(0) + ' · Reichweite ' + g.vert.reich + ' · ' + (g.vert.boden && g.vert.luft ? 'Boden + Luft' : g.vert.luft ? 'nur Luft' : 'nur Boden'));
  h += `<p>${werte.join(' &nbsp;·&nbsp; ')}</p><div class="zeile">`;
  if (b.ende) {
    h += `<button class="knopf grau" disabled>⏳ <span id="infoZeit">${dauerText((b.ende - jetzt()) / 1000)}</span></button>`;
    h += `<button class="knopf rot" id="iAbbr">Abbrechen</button>`;
  } else if (b.typ === 'baumeister') {
    h += `<button class="knopf grau" disabled>👷 Baumeister wohnt hier</button>`;
  } else if (b.lvl >= g.maxLvl) {
    h += `<button class="knopf grau" disabled>⭐ Höchststufe</button>`;
  } else if (b.lvl >= ml) {
    h += `<button class="knopf grau" disabled>🏛️ Rathaus Stufe ${b.typ === 'schmiede' ? b.lvl + 3 : b.lvl} nötig</button>`;
  } else {
    const k = kosten(b.typ, b.lvl + 1);
    h += `<button class="knopf gruen" id="iAus">⬆️ Stufe ${b.lvl + 1}: <span class="${S[k.res] < k.n ? 'zu-teuer' : ''}">${fmt(k.n)} ${resEm(k.res)}</span> · ${dauerText(bauzeit(b.typ, b.lvl + 1))}</button>`;
    if (b.typ === 'mauer') h += `<button class="knopf" id="iAlle">🧱 Alle Stufe-${b.lvl}-Mauern</button>`;
  }
  if (g.prod && b.lvl >= 1) h += `<button class="knopf" id="iSam">${resEm(g.prod)} Einsammeln</button>`;
  if (b.typ === 'kaserne' || b.typ === 'heerlager') h += `<button class="knopf blau" id="iArmee">⚔️ Armee</button>`;
  h += `</div><p class="kleintext" style="margin-top:6px">Gebäude ziehen zum Verschieben.</p>`;
  box.innerHTML = h; box.classList.add('offen');
  const on = (id, f) => { const e = $(id); if (e) e.onclick = () => { ton('klick'); f(); }; };
  on('iAus', () => ausbauen(b));
  on('iAlle', () => alleMauern(b.lvl));
  on('iSam', () => { einsammeln(b); infoZeigen(); });
  on('iArmee', () => armeeZeigen(true));
  on('iAbbr', () => frage('Bau abbrechen?', 'Du bekommst die Kosten vollständig zurück.', () => {
    const k = kosten(b.typ, b.ziel);
    S[k.res] += k.n;   // Erstattung darf übers Lager gehen
    if (b.lvl === 0) { S.bauten = S.bauten.filter(x => x !== b); gewaehlt = null; }
    else { b.ende = 0; b.ziel = 0; }
    merken(); infoZeigen(); uiDorf();
  }, 'Abbrechen'));
}
function ausbauen(b) {
  const g = G[b.typ], neu = b.lvl + 1;
  if (neu > maxLvl(b.typ, rh())) return;
  const z = bauzeit(b.typ, neu);
  if (z > 0 && baumeisterFrei() < 1) { melden('👷 Kein Baumeister frei – warte oder bau eine Hütte.'); ton('nein'); return; }
  const k = kosten(b.typ, neu);
  if (!bezahlen(k)) return;
  if (z > 0) { b.ziel = neu; b.start = jetzt(); b.ende = jetzt() + z * 1000; }
  else { b.lvl = neu; melden(g.em + ' ' + g.name + ' ist jetzt Stufe ' + neu); }
  if (g.prod && b.lvl >= 1) einsammeln(b, true);
  ton('bau'); merken(); infoZeigen(); uiDorf();
}
function alleMauern(lvl) {
  if (lvl + 1 > maxLvl('mauer', rh())) return;
  const k = kosten('mauer', lvl + 1); let n = 0;
  for (const b of S.bauten) if (b.typ === 'mauer' && b.lvl === lvl && S.gold >= k.n) { S.gold -= k.n; b.lvl++; n++; }
  if (!n) { melden('Nicht genug Gold 🪙'); ton('nein'); return; }
  melden('🧱 ' + n + ' Mauern auf Stufe ' + (lvl + 1)); ton('bau'); merken(); infoZeigen(); uiDorf();
}
function platzStarten(typ) {
  if (anzahl(typ) >= maxAnzahl(typ)) return;
  const [fx, fy] = bild2feld(W / 2, H / 2);
  let p = freierPlatz(typ, fx, fy);
  if (!p) { melden('Kein Platz mehr frei!'); return; }
  gewaehlt = null; platz = { typ, x: p[0], y: p[1] };
  schliessen('fShop'); uiDorf(); infoZeigen();
}
function platzBestaetigen() {
  if (!platz) return;
  const typ = platz.typ;
  if (!frei(typ, platz.x, platz.y, null)) { melden('Hier ist kein Platz.'); ton('nein'); return; }
  if (anzahl(typ) >= maxAnzahl(typ)) { platz = null; uiDorf(); return; }
  const z = bauzeit(typ, 1);
  if (z > 0 && baumeisterFrei() < 1 && typ !== 'baumeister') { melden('👷 Kein Baumeister frei.'); ton('nein'); return; }
  const k = typ === 'baumeister' ? kosten('baumeister', 1) : kosten(typ, 1);
  if (!bezahlen(k)) return;
  const b = { id: S.nextId++, typ, x: platz.x, y: platz.y, lvl: 0, ziel: 1, ende: 0, start: 0, letzte: jetzt() };
  if (typ === 'baumeister') { b.lvl = 1; b.ziel = 0; }
  else if (z > 0) { b.start = jetzt(); b.ende = jetzt() + z * 1000; }
  else { b.lvl = 1; b.ziel = 0; }
  S.bauten.push(b); ton('bau'); merken();
  const [sx, sy] = iso(b.x + G[typ].gr / 2, b.y + G[typ].gr / 2); effekt(sx, sy, 'staub', G[typ].gr / 3);
  // Mauern: gleich die nächste daneben anbieten
  if (typ === 'mauer' && anzahl('mauer') < maxAnzahl('mauer') && S.gold >= kosten('mauer', 1).n) {
    const occ = belegung(null), dirs = [[platz.dx || 1, platz.dy || 0], [1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const [dx, dy] of dirs) if (frei('mauer', platz.x + dx, platz.y + dy, null, occ)) { platz = { typ, x: platz.x + dx, y: platz.y + dy, dx, dy }; uiDorf(); return; }
  }
  platz = null; gewaehlt = b; uiDorf(); infoZeigen();
}
$('platzJa').onclick = () => { ton('klick'); platzBestaetigen(); };
$('platzNein').onclick = () => { ton('klick'); platz = null; uiDorf(); };

/* ---------------------------------------------------------------- Shop */
let shopReiter = 'wirtschaft';
function shopZeigen() {
  const reiter = [['wirtschaft', '💰 Wirtschaft'], ['armee', '⚔️ Armee'], ['verteidigung', '🛡️ Verteidigung']];
  $('shopReiter').innerHTML = reiter.map(([k, t]) => `<button data-r="${k}" class="${k === shopReiter ? 'an' : ''}">${t}</button>`).join('');
  $('shopReiter').querySelectorAll('button').forEach(b => b.onclick = () => { ton('klick'); shopReiter = b.dataset.r; shopZeigen(); });
  const r = rh();
  let h = '';
  for (const typ in G) {
    const g = G[typ];
    if (g.kat !== shopReiter) continue;
    const n = anzahl(typ), m = maxAnzahl(typ);
    const k = typ === 'baumeister' ? kosten('baumeister', 1) : kosten(typ, 1);
    let naechst = 0; for (let i = r; i <= MAX_RH; i++) if (ANZAHL[typ][i - 1] > n) { naechst = i; break; }
    const aus = n >= m;
    let stat = '';
    if (g.vert) stat = `⚔️ ${g.vert.schaden} · 🎯 ${g.vert.reich} · ${g.vert.boden && g.vert.luft ? 'Boden+Luft' : g.vert.luft ? 'Luft' : 'Boden'}`;
    else if (g.prod) stat = resEm(g.prod) + ' ' + fmt(prodRate(1)) + '/h';
    else if (g.lager) stat = 'Lager ' + fmt(LAGER_KAP[0]);
    h += `<div class="ware ${aus ? 'aus' : ''}" data-t="${typ}"><span class="anz">${n}/${m}</span><div class="em">${g.em}</div><div class="n">${esc(g.name)}</div>
      <div class="stat">${stat}</div>
      <div class="k">${aus ? (naechst ? '🏛️ Rathaus ' + naechst : 'Maximum') : `<span class="${S[k.res] < k.n ? 'zu-teuer' : ''}">${fmt(k.n)} ${resEm(k.res)}</span>`}</div>
      <div class="z">${aus ? '' : '⏱ ' + dauerText(bauzeit(typ, 1))}</div></div>`;
  }
  $('shopRaster').innerHTML = h;
  $('shopRaster').querySelectorAll('.ware').forEach(w => w.onclick = () => {
    const typ = w.dataset.t;
    if (w.classList.contains('aus')) { ton('nein'); return; }
    ton('klick'); platzStarten(typ);
  });
  oeffnen('fShop');
}

/* ---------------------------------------------------------------- Armee */
function armeeZeigen(oeffnenAuch) {
  const kl = kaserneLvl(), kap = armeePlatz(), bel = armeeBelegt(), sch = schlangeBelegt();
  $('armeeInfo').innerHTML = `👥 Armee: <b>${bel}/${kap}</b> Plätze · in Ausbildung: ${sch} · Kaserne Stufe ${kl || '–'} · Schmiede Stufe ${schmiedeLvl() || '–'}`;
  const jetztH = T_LISTE.filter(t => S.armee[t] > 0).map(t => `<div class="t" title="${esc(T[t].name)}">${T[t].em}<small>×${S.armee[t]}</small></div>`).join('');
  $('armeeJetzt').innerHTML = jetztH || '<span class="hinweis">Noch keine Truppen bereit.</span>';
  const t0 = jetzt();
  $('armeeSchlange').innerHTML = S.schlange.map((t, i) => {
    let fort = '';
    if (i === 0) fort = `<span class="fort" id="armeeFort" style="width:${clamp((t0 - S.schlangeStart) / (T[t].zeit * 10), 0, 100)}%"></span>`;
    return `<div class="t" data-i="${i}" style="cursor:pointer">${T[t].em}${fort}</div>`;
  }).join('') || '<span class="hinweis">Nichts in Ausbildung.</span>';
  $('armeeSchlange').querySelectorAll('.t').forEach(e => e.onclick = () => {
    const i = +e.dataset.i, t = S.schlange[i];
    S.schlange.splice(i, 1); hinzu('holz', T[t].kosten); if (i === 0) S.schlangeStart = jetzt();
    ton('klick'); merken(); armeeZeigen(); uiDorf();
  });
  const m = Math.pow(1.2, schmiedeLvl());
  $('armeeRaster').innerHTML = T_LISTE.map(t => {
    const d = T[t], frei = kl >= d.kas;
    return `<div class="ware ${frei ? '' : 'aus'}" data-t="${t}"><span class="anz">👥 ${d.platz}</span><div class="em">${d.em}</div><div class="n">${esc(d.name)}</div>
      <div class="stat">❤️ ${Math.round(d.hp * m)} · ⚔️ ${Math.round(d.schaden * m)}${d.flug ? ' · fliegt' : ''}</div>
      <div class="stat">${esc(d.text)}</div>
      <div class="k">${frei ? `<span class="${S.holz < d.kosten ? 'zu-teuer' : ''}">${fmt(d.kosten)} 🪵</span> · ⏱ ${d.zeit} s` : '🎖️ Kaserne Stufe ' + d.kas}</div></div>`;
  }).join('');
  $('armeeRaster').querySelectorAll('.ware').forEach(w => w.onclick = () => {
    const t = w.dataset.t, d = T[t];
    if (w.classList.contains('aus')) { ton('nein'); melden('Kaserne Stufe ' + d.kas + ' nötig'); return; }
    if (armeeBelegt() + schlangeBelegt() + d.platz > armeePlatz()) { ton('nein'); melden('Heerlager voll! Bau oder verbessere ein Heerlager.'); return; }
    if (!bezahlen({ res: 'holz', n: d.kosten })) return;
    if (!S.schlange.length) S.schlangeStart = jetzt();
    S.schlange.push(t); ton('klick'); merken(); armeeZeigen(); uiDorf();
  });
  if (oeffnenAuch) oeffnen('fArmee');
}

/* ---------------------------------------------------------------- Dorf-Oberfläche */
function uiDorf() {
  const gm = maxRes('gold'), hm = maxRes('holz');
  $('tGold').textContent = fmt(S.gold); $('tGoldMax').textContent = '/' + fmt(gm); $('bGold').style.width = clamp(S.gold / gm * 100, 0, 100) + '%';
  $('tHolz').textContent = fmt(S.holz); $('tHolzMax').textContent = '/' + fmt(hm); $('bHolz').style.width = clamp(S.holz / hm * 100, 0, 100) + '%';
  $('tTroph').textContent = fmt(S.troph);
  $('tBau').textContent = baumeisterFrei() + '/' + baumeisterGesamt();
  const imDorf = modus === 'dorf';
  $('oben').style.display = imDorf ? '' : 'none';
  $('unten').style.display = imDorf && !platz ? '' : 'none';
  $('platzLeiste').classList.toggle('offen', imDorf && !!platz);
  if (platz) {
    const k = platz.typ === 'baumeister' ? kosten('baumeister', 1) : kosten(platz.typ, 1);
    $('platzText').textContent = G[platz.typ].em + ' ' + G[platz.typ].name + ' · ' + fmt(k.n) + ' ' + resEm(k.res) + ' · ziehen oder tippen zum Platzieren';
  }
  $('kampfOben').classList.toggle('offen', !imDorf);
  $('kampfUnten').classList.toggle('offen', !imDorf);
}
$('shopKnopf').onclick = () => { ton('klick'); gewaehlt = null; infoZeigen(); shopZeigen(); };
$('armeeKnopf').onclick = () => { ton('klick'); armeeZeigen(true); };
$('angriffKnopf').onclick = () => { ton('klick'); angriffZeigen(); };
$('menuKnopf').onclick = () => { ton('klick'); menuZeigen(); };

/* ---------------------------------------------------------------- Menü & Hilfe */
const HILFE = `<ul class="liste">
  <li><b>Rohstoffe:</b> Goldminen und Sägewerke füllen sich von allein – antippen zum Einsammeln. Lager bestimmen, wie viel du behalten kannst.</li>
  <li><b>Bauen:</b> 🛠️ öffnet den Bauplan. Jede Baustelle braucht einen freien 👷 Baumeister. Mehr Hütten = mehr Baumeister.</li>
  <li><b>Rathaus:</b> Höhere Stufe schaltet mehr Gebäude und höhere Stufen frei.</li>
  <li><b>Armee:</b> Truppen kosten Holz und brauchen Platz im Heerlager. Die Kaserne schaltet neue Truppen frei, die Schmiede macht sie stärker.</li>
  <li><b>Angriff:</b> Tippe eine Truppe unten an und dann aufs Feld (nicht ins rote Gebiet). Halten = mehrere setzen. 50 % zerstört = ⭐, Rathaus zerstört = ⭐, alles = ⭐.</li>
  <li><b>Beute:</b> Je mehr Lager, Minen und Rathaus du kaputt machst, desto mehr Gold und Holz nimmst du mit.</li>
  <li><b>Kamera:</b> Ziehen zum Bewegen, Mausrad oder zwei Finger zum Zoomen.</li>
</ul>`;
function menuZeigen() {
  const sterne = Object.values(S.kampagne).reduce((a, k) => a + (k.sterne || 0), 0);
  $('menuInhalt').innerHTML = `
    <p style="font-weight:500">🏛️ Rathaus Stufe <b>${rh()}</b> · 🏆 <b>${fmt(S.troph)}</b> Trophäen · ⭐ ${sterne}/${KAMPAGNE.length * 3} Kampagne<br>
    ⚔️ ${S.stat.angriffe} Angriffe · ${S.stat.siege} Siege · ${fmt(S.stat.geplündert || 0)} Rohstoffe geplündert</p>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="knopf" id="mHilfe">❓ So wird gespielt</button>
      <button class="knopf" id="mTon">${tonAn ? '🔊 Ton an' : '🔇 Ton aus'}</button>
      <button class="knopf" id="mKam">🎥 Kamera zentrieren</button>
      ${window.SLRang && window.SLRang.cloud ? '<button class="knopf blau" id="mCloud">☁️ Spielstand in der Cloud</button>' : ''}
      <button class="knopf rot" id="mNeu">🗑️ Neues Dorf anfangen</button>
    </div>
    <div id="mHilfeText" style="display:none">${HILFE}</div>
    <p class="kleintext" style="margin-top:10px">Taddelvillage – ein Spiel der Swimming-Lions-Spielesammlung. Spielstand wird auf diesem Gerät gespeichert.</p>`;
  $('mHilfe').onclick = () => { ton('klick'); const e = $('mHilfeText'); e.style.display = e.style.display === 'none' ? '' : 'none'; };
  $('mTon').onclick = () => { tonAn = !tonAn; try { localStorage.setItem('tvgeraet_ton', tonAn ? 'an' : 'aus'); } catch (e) {} ton('klick'); menuZeigen(); };
  if ($('mCloud')) $('mCloud').onclick = () => { ton('klick'); schliessen('fMenu'); window.SLRang.cloud(); };
  $('mKam').onclick = () => { ton('klick'); kameraZentrieren(); schliessen('fMenu'); };
  $('mNeu').onclick = () => frage('Neues Dorf?', 'Dein ganzes Dorf, alle Rohstoffe und Trophäen gehen verloren.', () => {
    neuerStand(); speichern(); gewaehlt = null; platz = null; schliessen('fMenu'); kameraZentrieren(); uiDorf(); infoZeigen();
  }, 'Ja, neu anfangen');
  oeffnen('fMenu');
}
function willkommen() {
  $('ergebnisInhalt').innerHTML = `<h2 style="padding:0">🛖 Willkommen in Taddelvillage!</h2>
    <p style="font-weight:500">Bau dein Dorf aus, bilde eine Armee aus und plündere Räuberdörfer.</p>${HILFE}
    <button class="knopf gruen" id="losKnopf" style="width:100%">Los geht's!</button>`;
  oeffnen('fErgebnis');
  $('losKnopf').onclick = () => { ton('klick'); S.hilfe = true; merken(); schliessen('fErgebnis'); };
}

/* =========================================================================
   Kampf
   ========================================================================= */
const KAMPAGNE = [
  ['Krümelhof', '🥖'], ['Matschdorf', '🐷'], ['Pilzlichtung', '🍄'], ['Rübenfeste', '🥕'], ['Nebelmoor', '🌫️'], ['Kieselbach', '🪨'],
  ['Wolfsschanze', '🐺'], ['Bärenbollwerk', '🐻'], ['Schlangengrube', '🐍'], ['Krähenhorst', '🐦‍⬛'], ['Eisenzahn', '⚙️'], ['Feuerfels', '🔥'],
  ['Sturmspitze', '⛈️'], ['Knochenburg', '💀'], ['Drachenhöhle', '🐉'], ['Schattenthron', '👑'],
].map(([name, em], i) => ({ name, em, stufe: Math.ceil((i + 1) / 2), seed: 4711 + i * 97, leicht: i < 2 }));
const NAMEN = ['Bruno', 'Greta', 'Olaf', 'Hilde', 'Knut', 'Frieda', 'Jupp', 'Erna', 'Kalle', 'Lotte', 'Udo', 'Wilma', 'Horst', 'Paula', 'Egon', 'Rosi'];
const ZUSATZ = ['Raffzahn', 'Goldgier', 'Eisenfaust', 'Krummbein', 'Donnerbart', 'Schlitzohr', 'Großmaul', 'Bauchweh', 'Hasenfuß', 'Dickkopf'];
const BEUTE_BASIS = [700, 1600, 3600, 8000, 16000, 30000, 50000, 80000];

function dorfErzeugen(stufe, seed, leicht) {
  const r = mulberry(seed);
  const bauten = [], occ = new Int32Array(N * N).fill(-1);
  // Gegner-Gebäude liegen etwa auf Höhe der Dorfstufe
  const lv = typ => clamp(Math.round(Math.min(G[typ].maxLvl, maxLvl(typ, stufe)) - 0.7 - r() * 1.2), 1, G[typ].maxLvl);
  const passt = (typ, x, y, rand) => {
    const s = G[typ].gr; rand = rand == null ? 3 : rand;
    if (x < rand || y < rand || x + s > N - rand || y + s > N - rand) return false;
    for (let yy = y - 1; yy <= y + s; yy++) for (let xx = x - 1; xx <= x + s; xx++) {
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const innen = xx >= x && xx < x + s && yy >= y && yy < y + s;
      const o = occ[yy * N + xx];
      if (innen && o !== -1) return false;
      if (!innen && o !== -1 && typ !== 'mauer' && bauten[o].typ !== 'mauer') return false;   // 1 Feld Abstand zwischen Gebäuden
    }
    return true;
  };
  const setzen = (typ, x, y, lvl) => {
    const s = G[typ].gr, i = bauten.length;
    bauten.push({ typ, x, y, lvl: lvl || lv(typ) });
    for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) occ[yy * N + xx] = i;
    return bauten[i];
  };
  const ringSetzen = (typ, rMin, rMax, cx, cy) => {
    const s = G[typ].gr;
    for (let v = 0; v < 400; v++) {
      const a = r() * Math.PI * 2, d = rMin + r() * (rMax - rMin + v * 0.025);   // wird es eng, darf es weiter raus
      const x = Math.round(cx + Math.cos(a) * d - s / 2), y = Math.round(cy + Math.sin(a) * d - s / 2);
      if (passt(typ, x, y)) return setzen(typ, x, y);
    }
    return null;
  };
  const c = N / 2;
  setzen('rathaus', c - 2, c - 2, stufe);
  const zahl = typ => Math.max(leicht && G[typ].vert ? Math.min(1, ANZAHL[typ][stufe - 1]) : 0, ANZAHL[typ][stufe - 1] - (r() < 0.35 || (leicht && G[typ].vert) ? 1 : 0));
  const kern = [];
  // Verteidigung und Lager in den Kern
  const kernTypen = [];
  ['goldtruhe', 'holzlager', 'moerser', 'windturm', 'bogenturm', 'schleuder'].forEach(t => { for (let i = 0; i < Math.max(t === 'goldtruhe' || t === 'holzlager' ? 1 : 0, zahl(t)); i++) kernTypen.push(t); });
  // mehr Platz für mehr Gebäude
  const kernR = 3.2 + kernTypen.length * 0.33;
  for (const t of kernTypen) {
    const b = ringSetzen(t, t === 'moerser' ? 2.5 : 3.2, kernR, c, c);
    if (b) kern.push(b);
  }
  // Mauerring um den Kern (wenn genug Mauern), sonst ums Rathaus
  let mauern = ANZAHL.mauer[stufe - 1] - Math.floor(r() * 4);
  const mauerLvl = clamp(stufe + (r() < 0.5 ? 0 : 1) - 1, 1, 9);
  const box = liste => {
    let x0 = N, y0 = N, x1 = 0, y1 = 0;
    for (const b of liste) { const s = G[b.typ].gr; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + s); y1 = Math.max(y1, b.y + s); }
    return [x0 - 1, y0 - 1, x1, y1];
  };
  const ring = ([x0, y0, x1, y1]) => {
    const z = [];
    for (let x = x0; x <= x1; x++) { z.push([x, y0]); z.push([x, y1]); }
    for (let y = y0 + 1; y < y1; y++) { z.push([x0, y]); z.push([x1, y]); }
    return z.filter(([x, y]) => x >= 2 && y >= 2 && x < N - 2 && y < N - 2);
  };
  const ringeBauen = (felder) => {
    for (const [x, y] of felder) { if (mauern <= 0) break; if (occ[y * N + x] === -1) { setzen('mauer', x, y, mauerLvl); mauern--; } }
  };
  const rh0 = bauten[0];
  const aussen = ring(box(bauten.filter(b => b.typ !== 'mauer')));
  if (aussen.length <= mauern) {
    ringeBauen(aussen);
    const innen = ring(box([rh0]));
    if (innen.length <= mauern) ringeBauen(innen);
  } else {
    const innen = ring(box([rh0]));
    ringeBauen(innen);
  }
  // Außenbereich: Minen, Kaserne, Heerlager, Hütten
  const aussenTypen = [];
  ['goldmine', 'saegewerk', 'heerlager', 'kaserne', 'baumeister', 'schmiede'].forEach(t => {
    const n = t === 'baumeister' ? Math.min(5, 1 + Math.floor(stufe / 2)) : zahl(t);
    for (let i = 0; i < n; i++) aussenTypen.push(t);
  });
  let rAussen = kernR + 3;
  for (const t of aussenTypen) {
    let b = null;
    for (let k = 0; k < 6 && !b; k++) b = ringSetzen(t, rAussen, rAussen + 3 + k, c, c);
    rAussen = Math.min(rAussen + 0.15, N / 2 - 4);
  }
  // Beute verteilen
  const pool = { gold: BEUTE_BASIS[stufe - 1] * (0.7 + r() * 0.6), holz: BEUTE_BASIS[stufe - 1] * (0.7 + r() * 0.6) };
  for (const b of bauten) b.beute = { gold: 0, holz: 0 };
  for (const res of ['gold', 'holz']) {
    const lager = bauten.filter(b => G[b.typ].lager === res), minen = bauten.filter(b => G[b.typ].prod === res);
    const rhAnteil = 0.2, lagerAnteil = lager.length ? 0.6 : 0, minenAnteil = minen.length ? 0.2 : 0;
    const rest = 1 - rhAnteil - lagerAnteil - minenAnteil;
    rh0.beute[res] += pool[res] * (rhAnteil + rest);
    for (const b of lager) b.beute[res] += pool[res] * lagerAnteil / lager.length;
    for (const b of minen) b.beute[res] += pool[res] * minenAnteil / minen.length;
  }
  return bauten;
}

let B = null;   // Kampfzustand
function kampfStarten(art, info) {
  const bauten = dorfErzeugen(info.stufe, info.seed, info.leicht);
  let faktor = 1;
  if (art === 'kampagne' && (S.kampagne[info.nr] || {}).geholt) faktor = 0.25;
  const occ = new Int32Array(N * N).fill(-1);
  bauten.forEach((b, i) => {
    b.max = b.hp = lebenVon(b.typ, b.lvl); b.tot = false; b.cd = Math.random() * 0.5; b.ziel = null;
    b.beute.gold *= faktor; b.beute.holz *= faktor;
    const s = G[b.typ].gr;
    for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) occ[y * N + x] = i;
  });
  const verbot = new Uint8Array(N * N);
  for (const b of bauten) { const s = G[b.typ].gr; for (let y = b.y - 1; y <= b.y + s; y++) for (let x = b.x - 1; x <= b.x + s; x++) if (x >= 0 && y >= 0 && x < N && y < N) verbot[y * N + x] = 1; }
  const beute = { gold: 0, holz: 0 };
  for (const b of bauten) { beute.gold += b.beute.gold; beute.holz += b.beute.holz; }
  const verfuegbar = {};
  for (const t of T_LISTE) if (S.armee[t] > 0) verfuegbar[t] = S.armee[t];
  B = { art, info, bauten, occ, verbot, einheiten: [], geschosse: [], zeit: 180, laeuft: false, vorbei: false, endeIn: 0,
        verfuegbar, eingesetzt: {}, auswahl: T_LISTE.find(t => verfuegbar[t] > 0) || null, geholt: { gold: 0, holz: 0 }, beute,
        sterne: 0, prozent: 0, rhTot: false, version: 0, tempo: 1, gesamt: bauten.filter(b => b.typ !== 'mauer').length, kaputt: 0,
        nachbarn: mauerNachbarn(bauten), mult: Math.pow(1.2, schmiedeLvl()) };
  modus = 'kampf'; gewaehlt = null; platz = null; texte = []; effekte = [];
  schliessen('fAngriff'); infoZeigen(); kameraZentrieren(); uiDorf(); kampfUi(true);
  $('kName').textContent = info.name;
  $('weiterKnopf').style.display = art === 'mehr' ? '' : 'none';
  $('weiterKnopf').innerHTML = '🔍 Weiter · ' + fmt(suchKosten()) + ' 🪙';
  if (!B.auswahl) melden('Du hast keine Truppen! Bilde erst welche aus.');
  else melden(art === 'mehr' ? 'Truppe wählen und aufs Feld tippen!' : info.em + ' ' + info.name + ' – leg los!');
}
const suchKosten = () => 10 * rh() * rh() + 10;
function angriffZeigen(reiter) {
  reiter = reiter || angriffZeigen.reiter || 'mehr'; angriffZeigen.reiter = reiter;
  $('angriffReiter').innerHTML = `<button data-r="mehr" class="${reiter === 'mehr' ? 'an' : ''}">🏆 Plündern</button><button data-r="kampagne" class="${reiter === 'kampagne' ? 'an' : ''}">🗺️ Kampagne</button>`;
  $('angriffReiter').querySelectorAll('button').forEach(b => b.onclick = () => { ton('klick'); angriffZeigen(b.dataset.r); });
  const truppen = T_LISTE.filter(t => S.armee[t] > 0).map(t => T[t].em + '×' + S.armee[t]).join(' ') || 'keine';
  let h = `<p class="hinweis">Deine Armee: ${truppen} (${armeeBelegt()}/${armeePlatz()})</p>`;
  if (reiter === 'mehr') {
    h += `<p style="font-weight:500">Such dir ein Räuberdorf in deiner Stärke, klau Gold und Holz und hol Trophäen. Verlierst du, gehen Trophäen verloren.</p>
      <button class="knopf rot" id="suchKnopf" style="width:100%;font-size:18px">🔍 Dorf suchen · ${fmt(suchKosten())} 🪙</button>`;
  } else {
    h += '<div class="kampagne">';
    KAMPAGNE.forEach((k, i) => {
      const st = (S.kampagne[i] || {}).sterne || 0, offen = i === 0 || (S.kampagne[i - 1] || {}).sterne > 0;
      h += `<button data-i="${i}" class="${offen ? '' : 'zu-'}"><span class="em">${offen ? k.em : '🔒'}</span>${esc(k.name)}<small>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</small><span class="kleintext">Stufe ${k.stufe}</span></button>`;
    });
    h += '</div><p class="kleintext">Beim ersten Sieg gibt es die volle Beute, danach ein Viertel.</p>';
  }
  $('angriffInhalt').innerHTML = h;
  const s = $('suchKnopf');
  if (s) s.onclick = () => { if (!armeeBelegt()) { melden('Bilde zuerst Truppen aus! ⚔️'); ton('nein'); return; } if (!bezahlen({ res: 'gold', n: suchKosten() })) return; ton('klick'); mehrStarten(); };
  $('angriffInhalt').querySelectorAll('.kampagne button').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (b.classList.contains('zu-')) { ton('nein'); melden('Gewinn erst das Dorf davor.'); return; }
    if (!armeeBelegt()) { melden('Bilde zuerst Truppen aus! ⚔️'); ton('nein'); return; }
    ton('klick'); kampfStarten('kampagne', { ...KAMPAGNE[i], nr: i, name: KAMPAGNE[i].em + ' ' + KAMPAGNE[i].name });
  });
  oeffnen('fAngriff');
}
function mehrStarten() {
  const r = rh(), seed = Math.floor(Math.random() * 1e9), rr = mulberry(seed);
  const stufe = clamp(r - 1 + Math.floor(rr() * 3) + (S.troph > 300 * r ? 1 : 0), 1, MAX_RH);
  const sieg = clamp(Math.round(18 + (stufe - r) * 6 + rr() * 10), 6, 40), niederlage = clamp(Math.round(14 - (stufe - r) * 4 + rr() * 6), 4, 30);
  const name = 'Dorf von ' + NAMEN[Math.floor(rr() * NAMEN.length)] + ' ' + ZUSATZ[Math.floor(rr() * ZUSATZ.length)];
  kampfStarten('mehr', { stufe, seed, name: name + ' (Stufe ' + stufe + ')', sieg, niederlage });
}

function kampfUi(neu) {
  if (!B) return;
  if (neu) {
    $('truppen').innerHTML = T_LISTE.filter(t => B.verfuegbar[t] !== undefined).map(t => `<div class="tk" data-t="${t}"><small id="tk_${t}"></small>${T[t].em}<i>${esc(T[t].kurz)}</i></div>`).join('')
      + '<div class="tk" id="tempoKnopf" style="font-size:22px">⏩<i>Tempo</i></div>';
    $('truppen').querySelectorAll('.tk[data-t]').forEach(e => e.onpointerdown = ev => { ev.preventDefault(); ton('klick'); B.auswahl = e.dataset.t; kampfUi(); });
    $('tempoKnopf').onpointerdown = ev => { ev.preventDefault(); B.tempo = B.tempo === 1 ? 2 : 1; ton('klick'); kampfUi(); };
  }
  for (const t in B.verfuegbar) {
    const e = $('tk_' + t); if (!e) continue;
    e.textContent = '×' + B.verfuegbar[t];
    const k = e.parentNode; k.classList.toggle('an', B.auswahl === t); k.classList.toggle('leer', B.verfuegbar[t] <= 0);
  }
  const tk = $('tempoKnopf'); if (tk) tk.classList.toggle('an', B.tempo === 2);
  const z = Math.ceil(B.zeit);
  $('kZeit').textContent = Math.floor(z / 60) + ':' + String(z % 60).padStart(2, '0');
  $('kSterne').textContent = '★'.repeat(B.sterne) + '☆'.repeat(3 - B.sterne);
  $('kProzent').textContent = Math.floor(B.prozent) + ' %';
  $('kBeute').textContent = 'Beute: 🪙 ' + fmt(B.beute.gold - B.geholt.gold) + ' · 🪵 ' + fmt(B.beute.holz - B.geholt.holz);
  $('kGeholt').textContent = 'Geholt: 🪙 ' + fmt(B.geholt.gold) + ' · 🪵 ' + fmt(B.geholt.holz) + (B.art === 'mehr' ? ` · 🏆 +${B.info.sieg} / −${B.info.niederlage}` : '');
  $('beendenKnopf').innerHTML = B.laeuft ? '🏳️ Aufgeben' : '🏠 Heim';
  if (B.laeuft) $('weiterKnopf').style.display = 'none';
}
$('weiterKnopf').onclick = () => {
  if (!B || B.laeuft) return;
  if (!bezahlen({ res: 'gold', n: suchKosten() })) return;
  ton('klick'); mehrStarten();
};
$('beendenKnopf').onclick = () => {
  if (!B) return; ton('klick');
  if (!B.laeuft) { B = null; modus = 'dorf'; kameraZentrieren(); uiDorf(); merken(); return; }
  frage('Kampf beenden?', 'Gesetzte Truppen sind weg. Die Beute bis jetzt behältst du.', () => kampfEnde(), 'Beenden');
};

function setzeEinheit(t, fx, fy) {
  if (!B || B.vorbei) return false;
  if (!B.verfuegbar[t]) { melden('Keine ' + T[t].name + ' mehr übrig.'); return false; }
  const x = Math.floor(fx), y = Math.floor(fy);
  if (x < 0 || y < 0 || x >= N || y >= N || B.verbot[y * N + x]) { return 'rot'; }
  const d = T[t], m = B.mult;
  B.einheiten.push({ t, x: fx, y: fy, hp: d.hp * m, max: d.hp * m, schaden: d.schaden * m, cd: 0.2, ziel: null, mauer: null, pfad: null, pfadV: -1, pi: 0,
    ox: (Math.random() - 0.5) * 0.3, oy: (Math.random() - 0.5) * 0.3, phase: Math.random() * 6, lauf: false, blick: 1 });
  B.verfuegbar[t]--; B.eingesetzt[t] = (B.eingesetzt[t] || 0) + 1;
  if (!B.laeuft) { B.laeuft = true; }
  const [sx, sy] = iso(fx, fy); effekt(sx, sy, 'setzen'); ton('setzen');
  if (B.verfuegbar[t] <= 0) { const n = T_LISTE.find(k => B.verfuegbar[k] > 0); if (n) B.auswahl = n; }
  kampfUi();
  return true;
}

// Abstand von Punkt zu Gebäude-Rechteck
function abstand(px, py, b) {
  const s = G[b.typ].gr;
  const dx = Math.max(b.x - px, 0, px - (b.x + s)), dy = Math.max(b.y - py, 0, py - (b.y + s));
  return Math.hypot(dx, dy);
}
function naechsterPunkt(px, py, b) {
  const s = G[b.typ].gr;
  return [clamp(px, b.x, b.x + s), clamp(py, b.y, b.y + s)];
}
const mitte = b => { const s = G[b.typ].gr; return [b.x + s / 2, b.y + s / 2]; };

function zielSuchen(u) {
  const d = T[u.t];
  let kand = B.bauten.filter(b => !b.tot && b.typ !== 'mauer');
  if (d.ziel === 'verteidigung') { const k = kand.filter(b => G[b.typ].vert); if (k.length) kand = k; }
  else if (d.ziel === 'rohstoff') { const k = kand.filter(b => istRohstoff(b.typ)); if (k.length) kand = k; }
  else if (d.ziel === 'mauer') { const k = B.bauten.filter(b => !b.tot && b.typ === 'mauer'); if (k.length) kand = k; }
  let best = null, bd = Infinity;
  for (const b of kand) { const a = abstand(u.x, u.y, b); if (a < bd) { bd = a; best = b; } }
  return best;
}

// A*-Wegsuche auf dem Raster. Mauern sind teuer, aber passierbar (dann wird die Mauer angegriffen).
const heap = { a: [], f: null };
function pfadSuchen(u, ziel) {
  const sx = clamp(Math.floor(u.x), 0, N - 1), sy = clamp(Math.floor(u.y), 0, N - 1);
  const zi = B.bauten.indexOf(ziel), s = G[ziel.typ].gr;
  const kosten = new Float32Array(N * N).fill(Infinity), von = new Int32Array(N * N).fill(-1), zu = new Uint8Array(N * N);
  const h = (x, y) => { const dx = Math.max(ziel.x - x, 0, x - (ziel.x + s - 1)), dy = Math.max(ziel.y - y, 0, y - (ziel.y + s - 1)); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
  const feldKosten = i => {
    const o = B.occ[i];
    if (o === -1 || o === zi) return 1;
    const b = B.bauten[o];
    if (b.tot) return 1;
    if (b.typ === 'mauer') return 1 + 6 + b.hp / 80;
    return Infinity;
  };
  const offen = [];
  const push = (i, f) => { offen.push([f, i]); let k = offen.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (offen[p][0] <= offen[k][0]) break; [offen[p], offen[k]] = [offen[k], offen[p]]; k = p; } };
  const pop = () => { const top = offen[0], last = offen.pop(); if (offen.length) { offen[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < offen.length && offen[l][0] < offen[m][0]) m = l; if (r < offen.length && offen[r][0] < offen[m][0]) m = r; if (m === k) break; [offen[m], offen[k]] = [offen[k], offen[m]]; k = m; } } return top; };
  const start = sy * N + sx; kosten[start] = 0; push(start, h(sx, sy));
  let gefunden = -1, schritte = 0;
  while (offen.length && schritte++ < 4000) {
    const [, i] = pop();
    if (zu[i]) continue; zu[i] = 1;
    const x = i % N, y = (i / N) | 0;
    if (B.occ[i] === zi) { gefunden = i; break; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx; if (zu[j]) continue;
      let c = feldKosten(j); if (c === Infinity) continue;
      if (dx && dy) {
        // keine Ecken schneiden und nicht diagonal zwischen Mauern durchschlüpfen
        if (feldKosten(y * N + nx) !== 1 || feldKosten(ny * N + x) !== 1) continue;
        c *= 1.414;
      }
      const k = kosten[i] + c;
      if (k < kosten[j]) { kosten[j] = k; von[j] = i; push(j, k + h(nx, ny)); }
    }
  }
  if (gefunden < 0) return null;
  const weg = []; let i = gefunden;
  while (i !== start && i !== -1) { weg.push(i); i = von[i]; }
  weg.reverse();
  return weg;
}

function bauSchaden(b, n, quelle) {
  if (b.tot || n <= 0) return;
  const echt = Math.min(b.hp, n);
  b.hp -= n;
  // Beute anteilig
  const anteil = echt / b.max;
  for (const res of ['gold', 'holz']) {
    if (!b.beute[res]) continue;
    const g = b.beute[res] * anteil; B.geholt[res] += g;
  }
  if (b.hp <= 0) {
    b.hp = 0; b.tot = true; B.version++;
    const [mx, my] = mitte(b), [sx, sy] = iso(mx, my);
    effekt(sx, sy, 'staub', G[b.typ].gr / 2.5); ton('kaputt');
    const ges = b.beute.gold + b.beute.holz;
    if (ges >= 1) schwebText(sx, sy - 30, (b.beute.gold >= 1 ? '+' + fmt(b.beute.gold) + '🪙 ' : '') + (b.beute.holz >= 1 ? '+' + fmt(b.beute.holz) + '🪵' : ''), '#ffe066');
    if (b.typ !== 'mauer') {
      B.kaputt++; B.prozent = B.kaputt / B.gesamt * 100;
      if (b.typ === 'rathaus') B.rhTot = true;
      const st = (B.prozent >= 50 ? 1 : 0) + (B.rhTot ? 1 : 0) + (B.prozent >= 100 ? 1 : 0);
      if (st > B.sterne) { B.sterne = st; ton('stern'); melden('⭐ Stern ' + st + '!'); }
      if (B.prozent >= 100) B.endeIn = 1.5;
    }
    B.nachbarn = mauerNachbarn(B.bauten);
  }
}
function flaechenSchadenBau(x, y, rad, n, u) {
  const d = T[u.t];
  for (const b of B.bauten) {
    if (b.tot) continue;
    if (abstand(x, y, b) <= rad) {
      let m = n;
      if (b.typ === 'mauer' && d.ziel === 'mauer') m *= d.bonus;
      bauSchaden(b, m, u);
    }
  }
}
function einheitAngriff(u, ziel) {
  if (u.cd > 0) return;
  const d = T[u.t];
  u.cd = d.takt;
  const [zx, zy] = naechsterPunkt(u.x, u.y, ziel);
  u.blick = (zx - zy) - (u.x - u.y) >= 0 ? 1 : -1;
  if (d.selbst) {
    const [sx, sy] = iso(u.x, u.y); effekt(sx, sy, 'boom', 1.2); ton('boom');
    flaechenSchadenBau(zx, zy, d.flaeche, u.schaden, u);
    u.hp = 0; return;
  }
  let n = u.schaden;
  if (d.bonus && d.ziel === 'rohstoff' && istRohstoff(ziel.typ)) n *= d.bonus;
  if (d.fern) {
    B.geschosse.push({ von: [u.x, u.y, d.flug ? 34 : 12], nach: [zx, zy, 10], t: 0, dauer: Math.max(0.15, Math.hypot(zx - u.x, zy - u.y) / 9), art: d.flug ? 'feuer' : 'kiesel',
      treffer: () => { if (d.flaeche) flaechenSchadenBau(zx, zy, d.flaeche, n, u); else bauSchaden(ziel, n, u); } });
  } else {
    bauSchaden(ziel, n, u);
    const [sx, sy] = iso(zx, zy); effekt(sx, sy - 10, 'treffer');
  }
}
function geheZu(u, tx, ty, dt) {
  const d = T[u.t], dx = tx - u.x, dy = ty - u.y, l = Math.hypot(dx, dy);
  if (l < 1e-4) return true;
  const sch = d.tempo * dt;
  u.lauf = true; u.blick = (dx - dy) >= 0 ? 1 : -1;
  if (sch >= l) { u.x = tx; u.y = ty; return true; }
  u.x += dx / l * sch; u.y += dy / l * sch; return false;
}
function einheitSchritt(u, dt) {
  const d = T[u.t];
  u.cd = Math.max(0, u.cd - dt); u.lauf = false;
  if (u.mauer && u.mauer.tot) u.mauer = null;
  if (!u.ziel || u.ziel.tot) { u.ziel = zielSuchen(u); u.pfad = null; u.mauer = null; if (!u.ziel) return; }
  const ziel = u.mauer || u.ziel;
  if (abstand(u.x, u.y, ziel) <= d.reich) { einheitAngriff(u, ziel); return; }
  if (u.mauer) { const [px, py] = naechsterPunkt(u.x, u.y, u.mauer); geheZu(u, px, py, dt); return; }
  if (d.flug) { const [px, py] = naechsterPunkt(u.x, u.y, ziel); geheZu(u, px, py, dt); return; }
  if (!u.pfad || u.pfadV !== B.version) { u.pfad = pfadSuchen(u, u.ziel); u.pfadV = B.version; u.pi = 0; }
  if (!u.pfad || u.pi >= u.pfad.length) { const [px, py] = naechsterPunkt(u.x, u.y, ziel); geheZu(u, px, py, dt); return; }
  const zelle = u.pfad[u.pi], o = B.occ[zelle];
  if (o !== -1 && !B.bauten[o].tot && B.bauten[o].typ === 'mauer' && B.bauten[o] !== u.ziel) { u.mauer = B.bauten[o]; return; }
  const cx = zelle % N + 0.5, cy = ((zelle / N) | 0) + 0.5;
  if (geheZu(u, cx, cy, dt)) u.pi++;
}
function vertSchritt(b, dt) {
  const v = G[b.typ].vert;
  b.cd -= dt;
  if (b.cd > 0) return;
  const [mx, my] = mitte(b), passt = u => u.hp > 0 && (T[u.t].flug ? v.luft : v.boden);
  const imBereich = u => { const a = Math.hypot(u.x - mx, u.y - my) - G[b.typ].gr / 2 + 0.5; return a <= v.reich && (!v.min || a >= v.min); };
  if (!b.ziel || !passt(b.ziel) || !imBereich(b.ziel)) {
    b.ziel = null; let bd = Infinity;
    for (const u of B.einheiten) { if (!passt(u) || !imBereich(u)) continue; const a = Math.hypot(u.x - mx, u.y - my); if (a < bd) { bd = a; b.ziel = u; } }
  }
  if (!b.ziel) { b.cd = 0.1; return; }
  b.cd = v.takt;
  const u = b.ziel, n = vertSchaden(b.typ, b.lvl), h = G[b.typ].h * (1 + 0.05 * (b.lvl - 1)) + 8;
  ton('schuss');
  if (v.art === 'bombe') {
    const tx = u.x, ty = u.y;
    B.geschosse.push({ von: [mx, my, h], nach: [tx, ty, 0], t: 0, dauer: 1.3, art: 'bombe', bogen: 90,
      treffer: () => { const [sx, sy] = iso(tx, ty); effekt(sx, sy, 'boom', 1.3); ton('boom'); for (const e of B.einheiten) if (e.hp > 0 && !T[e.t].flug && Math.hypot(e.x - tx, e.y - ty) <= v.flaeche) e.hp -= n; } });
  } else {
    const ziel = u;
    B.geschosse.push({ von: [mx, my, h], ziel, t: 0, dauer: Math.max(0.12, Math.hypot(u.x - mx, u.y - my) / (v.art === 'pfeil' ? 16 : v.art === 'wind' ? 12 : 11)), art: v.art,
      treffer: () => { if (ziel.hp > 0) { ziel.hp -= n; const [sx, sy] = iso(ziel.x, ziel.y); effekt(sx, sy - (T[ziel.t].flug ? 34 : 8), 'treffer'); } } });
  }
}
function kampfSchritt(dt) {
  if (!B || B.vorbei) return;
  if (B.laeuft) B.zeit -= dt;
  for (const u of B.einheiten) if (u.hp > 0) einheitSchritt(u, dt);
  for (const b of B.bauten) if (!b.tot && G[b.typ].vert) vertSchritt(b, dt);
  for (const g of B.geschosse) {
    g.t += dt;
    if (g.t >= g.dauer && !g.fertig) { g.fertig = true; g.treffer(); }
  }
  B.geschosse = B.geschosse.filter(g => !g.fertig);
  for (const u of B.einheiten) if (u.hp <= 0 && !u.weg) {
    u.weg = true;
    if (!T[u.t].selbst) { const [sx, sy] = iso(u.x, u.y); effekt(sx, sy - (T[u.t].flug ? 34 : 0), 'staub', 0.5); schwebText(sx, sy - 20, '💀', '#fff'); }
  }
  B.einheiten = B.einheiten.filter(u => !u.weg);
  const nochDa = Object.values(B.verfuegbar).some(n => n > 0);
  if (B.laeuft && !B.einheiten.length && !nochDa && !B.endeIn) B.endeIn = 1.2;
  if (B.laeuft && B.zeit <= 0 && !B.endeIn) { B.zeit = 0; B.endeIn = 0.01; }
  if (B.endeIn) { B.endeIn -= dt; if (B.endeIn <= 0) kampfEnde(); }
}
function kampfEnde() {
  if (!B || B.vorbei) return;
  B.vorbei = true;
  const gold = Math.floor(B.geholt.gold), holz = Math.floor(B.geholt.holz);
  const gG = hinzu('gold', gold), gH = hinzu('holz', holz);
  for (const t in B.eingesetzt) S.armee[t] = Math.max(0, (S.armee[t] || 0) - B.eingesetzt[t]);
  S.stat.angriffe++; S.stat.geplündert = (S.stat.geplündert || 0) + gG + gH;
  if (B.sterne > 0) { S.stat.siege++; }
  let trophText = '';
  if (B.art === 'mehr') {
    const d = B.sterne > 0 ? Math.round(B.info.sieg * B.sterne / 3) : -B.info.niederlage;
    const vorher = S.troph; S.troph = Math.max(0, S.troph + d);
    trophText = `<p style="font-size:20px">🏆 ${S.troph - vorher >= 0 ? '+' : ''}${S.troph - vorher}</p>`;
  } else {
    const k = S.kampagne[B.info.nr] || { sterne: 0, geholt: false };
    const neuSterne = Math.max(0, B.sterne - k.sterne);
    if (B.sterne > k.sterne) { S.stat.sterne += neuSterne; k.sterne = B.sterne; }
    if (B.sterne > 0) k.geholt = true;
    S.kampagne[B.info.nr] = k;
    if (B.sterne > 0 && B.info.nr + 1 < KAMPAGNE.length && neuSterne && k.sterne === B.sterne && !(S.kampagne[B.info.nr + 1])) trophText = '<p>🗺️ Nächstes Dorf freigeschaltet!</p>';
  }
  speichern();
  const voll = (gG < gold || gH < holz) ? '<p class="kleintext">Deine Lager sind voll – ein Teil der Beute passte nicht mehr rein.</p>' : '';
  ton(B.sterne ? 'fertig' : 'nein');
  $('ergebnisInhalt').innerHTML = `<h2 style="padding:0">${B.sterne ? '🎉 Sieg!' : '💀 Niederlage'}</h2>
    <div class="gross" style="color:#e8a400">${'★'.repeat(B.sterne)}<span style="color:#c9b28a">${'☆'.repeat(3 - B.sterne)}</span></div>
    <p>${Math.floor(B.prozent)} % zerstört</p>
    <p style="font-size:20px">🪙 +${fmt(gG)} &nbsp; 🪵 +${fmt(gH)}</p>${trophText}${voll}
    <p class="kleintext">Eingesetzt: ${Object.keys(B.eingesetzt).map(t => T[t].em + '×' + B.eingesetzt[t]).join(' ') || 'nichts'}</p>
    <button class="knopf gruen" id="heimKnopf" style="width:100%;font-size:18px">🏠 Zurück ins Dorf</button>`;
  oeffnen('fErgebnis');
  $('heimKnopf').onclick = () => { ton('klick'); schliessen('fErgebnis'); B = null; modus = 'dorf'; kameraZentrieren(); uiDorf(); };
}

/* ---------------------------------------------------------------- Einheiten & Geschosse zeichnen */
function einheitZeichnen(u, zeit) {
  const d = T[u.t], [sx, sy] = iso(u.x + u.ox, u.y + u.oy);
  const r = 8 + Math.sqrt(d.platz) * 2.6, hoch = d.flug ? 34 + Math.sin(zeit * 4 + u.phase) * 3 : 0;
  const hop = u.lauf && !d.flug ? Math.abs(Math.sin(zeit * 12 + u.phase)) * 3 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  const y = sy - hoch - hop - r * 0.7;
  ctx.fillStyle = d.farbe; ctx.beginPath(); ctx.arc(sx, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2b6bd6'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.translate(sx, y); ctx.scale(u.blick, 1); emo(d.em, 0, -1, r * 1.55); ctx.restore();
  if (u.hp < u.max) balken(sx, y - r - 8, 18, u.hp / u.max, '#5fd0ff');
}
function geschossZeichnen(g) {
  const p = clamp(g.t / g.dauer, 0, 1);
  let nach = g.nach;
  if (g.ziel) nach = [g.ziel.x, g.ziel.y, T[g.ziel.t].flug ? 34 : 8];
  const x = g.von[0] + (nach[0] - g.von[0]) * p, y = g.von[1] + (nach[1] - g.von[1]) * p;
  let z = g.von[2] + (nach[2] - g.von[2]) * p;
  if (g.bogen) z += Math.sin(p * Math.PI) * g.bogen;
  const [sx, sy] = iso(x, y);
  if (g.art === 'pfeil') {
    const [ex, ey] = iso(nach[0], nach[1]), a = Math.atan2((ey - nach[2]) - (sy - z), ex - sx);
    ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * 8, sy - z - Math.sin(a) * 8); ctx.lineTo(sx, sy - z); ctx.stroke();
  } else if (g.art === 'wind') {
    ctx.strokeStyle = 'rgba(220,240,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy - z, 6, p * 12, p * 12 + 4); ctx.stroke();
  } else if (g.art === 'bombe') {
    ctx.fillStyle = '#4a2f1a'; ctx.beginPath(); ctx.arc(sx, sy - z, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(sx + 3, sy - z - 5, 2, 0, Math.PI * 2); ctx.fill();
  } else if (g.art === 'feuer') {
    ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.arc(sx, sy - z, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(sx, sy - z, 2.5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = g.art === 'stein' ? '#777' : '#ddd'; ctx.beginPath(); ctx.arc(sx, sy - z, g.art === 'stein' ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------------------------------------------------------------- Hauptzeichnen */
function zeichnen(dt) {
  const zeit = (performance.now() - zeit0) / 1000;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#2c6a26'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(DPR * cam.z, 0, 0, DPR * cam.z, DPR * cam.x, DPR * cam.y);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(boden, -boden.ox, -boden.oy);
  const liste = [];
  if (modus === 'kampf' && B) {
    if (B.auswahl && !B.vorbei && B.verfuegbar[B.auswahl] > 0) {
      ctx.fillStyle = 'rgba(255,40,40,.16)'; ctx.beginPath();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (B.verbot[y * N + x]) {
        const a = iso(x, y), b = iso(x + 1, y), c = iso(x + 1, y + 1), d = iso(x, y + 1);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      }
      ctx.fill();
    }
    for (const b of B.bauten) {
      const s = G[b.typ].gr;
      liste.push({ k: b.tot ? -1000 + b.x + b.y : b.x + b.y + s, f: () => bauZeichnen(b.typ, b.x, b.y, b.lvl, { tot: b.tot, hp: b.hp / b.max, nachbarn: b.typ === 'mauer' ? B.nachbarn(b) : 0 }) });
    }
    for (const u of B.einheiten) liste.push({ k: u.x + u.y + (T[u.t].flug ? 4 : 0.2), f: () => einheitZeichnen(u, zeit) });
  } else {
    const nb = mauerNachbarn(S.bauten), t = jetzt();
    for (const b of S.bauten) {
      const s = G[b.typ].gr;
      const gezogen = zieh && zieh.b === b;
      const x = gezogen ? zieh.x : b.x, y = gezogen ? zieh.y : b.y;
      let blase = null;
      if (G[b.typ].prod && b.lvl >= 1 && menge(b) >= Math.max(10, prodKap(b.lvl) * 0.04)) blase = G[b.typ].prod === 'gold' ? '🪙' : '🪵';
      if (b.typ === 'kaserne' && S.schlange.length) blase = T[S.schlange[0]].em;
      liste.push({ k: x + y + s, f: () => bauZeichnen(b.typ, x, y, b.lvl, {
        bau: b.ende ? clamp((t - b.start) / (b.ende - b.start), 0, 1) : null, blase, gewaehlt: gewaehlt === b && !gezogen,
        geist: gezogen ? (frei(b.typ, x, y, b) ? 'ok' : 'nein') : null, nachbarn: b.typ === 'mauer' ? nb(b) : 0 }) });
    }
    if (platz) {
      const s = G[platz.typ].gr;
      liste.push({ k: platz.x + platz.y + s + 0.01, f: () => bauZeichnen(platz.typ, platz.x, platz.y, 1, { geist: frei(platz.typ, platz.x, platz.y, null) ? 'ok' : 'nein' }) });
    }
  }
  liste.sort((a, b) => a.k - b.k);
  for (const e of liste) e.f();
  if (B && modus === 'kampf') for (const g of B.geschosse) geschossZeichnen(g);
  effekteZeichnen(dt);
}

/* ---------------------------------------------------------------- Eingabe */
const zeiger = new Map();
let geste = null, halten = null;
function haltenStopp() { if (halten) { clearInterval(halten.iv); clearTimeout(halten.to); halten = null; } }
function drueckenStart(g, e) {
  const [fx, fy] = bild2feld(e.clientX, e.clientY);
  if (modus === 'dorf') {
    if (platz) {
      const s = G[platz.typ].gr;
      if (fx >= platz.x - 0.5 && fx < platz.x + s + 0.5 && fy >= platz.y - 0.5 && fy < platz.y + s + 0.5) g.platzZieh = { dx: fx - platz.x, dy: fy - platz.y };
    } else if (gewaehlt) {
      const s = G[gewaehlt.typ].gr;
      if (fx >= gewaehlt.x && fx < gewaehlt.x + s && fy >= gewaehlt.y && fy < gewaehlt.y + s) g.bauZieh = { b: gewaehlt, dx: fx - gewaehlt.x, dy: fy - gewaehlt.y };
    }
  } else if (B && B.auswahl && !B.vorbei) {
    // Halten = mehrere Truppen nacheinander setzen
    halten = { x: e.clientX, y: e.clientY, n: 0 };
    halten.to = setTimeout(() => {
      if (!halten) return;
      halten.iv = setInterval(() => {
        if (!halten || !B) return haltenStopp();
        const [hx, hy] = bild2feld(halten.x, halten.y);
        const r = setzeEinheit(B.auswahl, hx + (Math.random() - 0.5) * 0.6, hy + (Math.random() - 0.5) * 0.6);
        if (r === true) halten.n++; else if (r !== 'rot') haltenStopp();
      }, 110);
    }, 280);
  }
}
function ziehen(g, e) {
  const [fx, fy] = bild2feld(e.clientX, e.clientY);
  if (g.platzZieh) { platz.x = Math.round(fx - g.platzZieh.dx); platz.y = Math.round(fy - g.platzZieh.dy); return true; }
  if (g.bauZieh) { zieh = { b: g.bauZieh.b, x: Math.round(fx - g.bauZieh.dx), y: Math.round(fy - g.bauZieh.dy) }; return true; }
  return false;
}
function tippen(px, py) {
  const [fx, fy] = bild2feld(px, py);
  if (modus === 'kampf') {
    if (!B || B.vorbei) return;
    if (halten && halten.n > 0) return;
    if (!B.auswahl) { melden('Wähle unten eine Truppe.'); return; }
    const r = setzeEinheit(B.auswahl, fx, fy);
    if (r === 'rot') { melden('Nicht ins rote Gebiet – setz die Truppen am Rand ab.'); ton('nein'); }
    return;
  }
  if (platz) {
    const s = G[platz.typ].gr;
    platz.x = Math.round(fx - s / 2); platz.y = Math.round(fy - s / 2);
    return;
  }
  const b = bauAn(fx, fy);
  if (b) {
    ton('klick');
    if (G[b.typ].prod && menge(b) >= 1 && gewaehlt !== b) einsammeln(b);
    waehlen(b);
  } else if (gewaehlt) { gewaehlt = null; infoZeigen(); }
}
cv.addEventListener('pointerdown', e => {
  try { cv.setPointerCapture(e.pointerId); } catch (f) {}
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (zeiger.size === 1) { geste = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, bewegt: false }; drueckenStart(geste, e); }
  else if (zeiger.size === 2) {
    haltenStopp(); zieh = null;
    const [a, b] = [...zeiger.values()];
    geste = { pinch: true, d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, bewegt: true };
  }
});
cv.addEventListener('pointermove', e => {
  if (!zeiger.has(e.pointerId)) return;
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!geste) return;
  if (geste.pinch) {
    if (zeiger.size < 2) return;
    const [a, b] = [...zeiger.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    cam.x += mx - geste.mx; cam.y += my - geste.my;
    if (geste.d > 0) zoomBei(d / geste.d, mx, my);
    geste.d = d; geste.mx = mx; geste.my = my; kameraBegrenzen(); return;
  }
  if (halten) { halten.x = e.clientX; halten.y = e.clientY; }
  if (!geste.bewegt && Math.hypot(e.clientX - geste.sx, e.clientY - geste.sy) > 9) {
    geste.bewegt = true;
    if (halten && halten.n === 0) haltenStopp();
  }
  if (geste.bewegt) {
    if (halten && halten.n > 0) { /* weiter setzen während Ziehen */ }
    else if (!ziehen(geste, e)) { cam.x += e.clientX - geste.lx; cam.y += e.clientY - geste.ly; kameraBegrenzen(); }
  }
  geste.lx = e.clientX; geste.ly = e.clientY;
});
function zeigerEnde(e) {
  if (!zeiger.has(e.pointerId)) return;
  zeiger.delete(e.pointerId);
  if (geste && !geste.pinch) {
    if (!geste.bewegt && e.type === 'pointerup') tippen(e.clientX, e.clientY);
    if (zieh) {
      const b = zieh.b;
      if (frei(b.typ, zieh.x, zieh.y, b)) { if (b.x !== zieh.x || b.y !== zieh.y) { b.x = zieh.x; b.y = zieh.y; merken(); ton('setzen'); } }
      else if (geste.bewegt) { melden('Da ist kein Platz.'); ton('nein'); }
      zieh = null;
    }
  }
  haltenStopp();
  if (zeiger.size === 1 && geste && geste.pinch) { const [p] = [...zeiger.values()]; geste = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, bewegt: true }; }
  else if (zeiger.size === 0) geste = null;
}
cv.addEventListener('pointerup', zeigerEnde);
cv.addEventListener('pointercancel', zeigerEnde);
cv.addEventListener('wheel', e => { e.preventDefault(); zoomBei(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (platz) { platz = null; uiDorf(); } else if (gewaehlt) { gewaehlt = null; infoZeigen(); } }
  if (modus === 'kampf' && B && /^[1-6]$/.test(e.key)) { const t = T_LISTE.filter(k => B.verfuegbar[k] !== undefined)[+e.key - 1]; if (t) { B.auswahl = t; kampfUi(); } }
});
addEventListener('resize', groesse);

/* ---------------------------------------------------------------- Rangliste */
window.SLRangAdapter = () => {
  const sterne = Object.values(S.kampagne).reduce((a, k) => a + (k.sterne || 0), 0);
  return { punkte: S.troph, progress: Math.round(((rh() - 1) / (MAX_RH - 1)) * 60 + sterne / (KAMPAGNE.length * 3) * 40) };
};

/* ---------------------------------------------------------------- Start & Schleife */
laden();
groesse(); bodenMalen(); kameraZentrieren();
// Offline-Fortschritt anwenden
dorfTakt(); uiDorf();
if (!S.hilfe) willkommen();
let letzte = performance.now(), uiTakt = 0;
function schleife(t) {
  const dt = Math.min(0.05, (t - letzte) / 1000); letzte = t;
  if (modus === 'kampf' && B) {
    const schritte = B.tempo;
    for (let i = 0; i < schritte; i++) kampfSchritt(dt);
  }
  uiTakt += dt;
  if (uiTakt > 0.25) {
    uiTakt = 0;
    dorfTakt();
    if (modus === 'dorf') {
      uiDorf();
      const iz = $('infoZeit'); if (iz && gewaehlt && gewaehlt.ende) iz.textContent = dauerText((gewaehlt.ende - jetzt()) / 1000);
      const af = $('armeeFort'); if (af && S.schlange.length) af.style.width = clamp((jetzt() - S.schlangeStart) / (T[S.schlange[0]].zeit * 10), 0, 100) + '%';
    } else kampfUi();
  }
  zeichnen(dt);
  requestAnimationFrame(schleife);
}
requestAnimationFrame(schleife);

// Für Tests von außen
window.TV = { get S() { return S; }, get B() { return B; }, kampfStarten, KAMPAGNE, setzeEinheit, dorfErzeugen, mehrStarten, kampfSchritt };
})();
