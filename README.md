# 🛖 Taddelvillage

Aufbau-Strategie im Browser: Dorf bauen, Rohstoffe sammeln, Armee ausbilden und Räuberdörfer plündern.
Teil der Swimming-Lions-Spielesammlung.

## Inhalt
- **3D-Grafik** mit Three.js (liegt unter `public/vendor/`, MIT-Lizenz): alle Gebäude und Truppen aus Low-Poly-Formen gebaut,
  mit Licht, weichen Schatten, Partikeln und Animationen (drehende Türme, Sägeblatt, Lagerfeuer, Rauch, Explosionen).
- **Dorf** auf einem 36×36-Feld: Rathaus bis Stufe 8, Goldminen, Sägewerke, Lager, Baumeisterhütten, Markt (Gold ↔ Holz),
  Kaserne, Heerlager, Schmiede, Heldenhalle, Steinschleuder, Bogenturm, Donnerfass, Windturm, Glutturm, Balliste,
  versteckte Stachelfallen, Mauern – dazu Deko (Brunnen, Goldlöwe, Blumenbeete, Bäume, Fahnenmasten).
- **Zwei Rohstoffe** (Gold 🪙 und Holz 🪵), Bauzeiten mit Baumeistern, Fortschritt läuft auch offline weiter.
- **7 Truppen**: Raufbold, Schleuderin, Plünder-Waschbär, Sprengmaulwurf, Steintroll, Greif, Kräuterhexe (heilt) –
  jede mit eigener Zielwahl. Dazu der **Löwenhauptmann** als Held aus der Heldenhalle.
- **Angriffe**: 16 Kampagnen-Dörfer mit Sternen und endlose zufällige Räuberdörfer um Trophäen 🏆.
  Truppen laufen per Wegsuche um Gebäude herum und brechen durch Mauern.
- Läuft am Handy (Touch, Zwei-Finger-Zoom, Halten = mehrere Truppen setzen) und am PC (Maus, Mausrad, Tasten 1–6 im Kampf).
- Rangliste und Cloud-Spielstand über den Melder der Sammlung (`data-spiel="Taddelvillage"`, Spielstand-Präfix `tv_`).

## Starten
```bash
npm start
```
Dann http://localhost:10000 öffnen. Keine Abhängigkeiten außer Node ≥ 18.

## Render
Web Service, Build Command leer lassen (oder `npm install`), Start Command `npm start`.
Alternativ als Static Site mit Publish Directory `public`.
