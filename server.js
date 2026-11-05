'use strict';
/* Kleiner statischer Server für Render (keine Abhängigkeiten). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const ORDNER = path.join(__dirname, 'public');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
  let pfad;
  try { pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (pfad === '/') pfad = '/index.html';
  const datei = path.normalize(path.join(ORDNER, pfad));
  if (!datei.startsWith(ORDNER)) { res.writeHead(403); return res.end(); }
  fs.stat(datei, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream',
      'Cache-Control': pfad.endsWith('.html') ? 'no-cache' : 'public, max-age=300' });
    fs.createReadStream(datei).pipe(res);
  });
}).listen(PORT, () => console.log('Taddelvillage läuft auf Port ' + PORT));
