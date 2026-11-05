// Goodnotes-Knopf – in allen Spielen gleich (Vorlage: spielesammlung).
// Kleiner, halbtransparenter Knopf nur auf iPad/iPhone/Mac, öffnet die Goodnotes-App.
// Verschieben: Knopf ziehen (Platz wird gemerkt). Tastenkürzel: Ctrl+Shift+G oder Alt+G.
(function(){
  var ua = navigator.userAgent;
  var apple = /iPad|iPhone|iPod/.test(ua) || /Macintosh/.test(ua);
  if (!apple) return;
  var ZIEL = 'goodnotes://';
  function oeffnen(){
    try { window.top.location.href = ZIEL; } catch (e) { location.href = ZIEL; }
  }
  document.addEventListener('keydown', function(e){
    if (e.code === 'KeyG' && ((e.ctrlKey && e.shiftKey) || (e.altKey && !e.ctrlKey && !e.metaKey))){
      e.preventDefault(); e.stopPropagation(); oeffnen();
    }
  }, true);
  if ((navigator.maxTouchPoints || 0) < 1) return;   // Knopf nur auf Touch-Geräten
  function bauen(){
    var k = document.createElement('div');
    k.setAttribute('role', 'button');
    k.setAttribute('aria-label', 'Goodnotes öffnen');
    k.title = 'Goodnotes öffnen';
    k.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    k.style.cssText = 'position:fixed;z-index:2147483647;width:32px;height:32px;border-radius:50%;'
      + 'display:flex;align-items:center;justify-content:center;background:rgba(20,20,30,.55);color:#fff;'
      + 'opacity:.3;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;'
      + 'transition:opacity .2s;cursor:pointer;-webkit-tap-highlight-color:transparent';
    var pos = null;
    try { pos = JSON.parse(localStorage.getItem('goodnotes_knopf')); } catch (e) {}
    function setzen(x, y){
      x = Math.max(0, Math.min(innerWidth - 32, x)); y = Math.max(0, Math.min(innerHeight - 32, y));
      k.style.left = x + 'px'; k.style.top = y + 'px';
    }
    function platzieren(){
      if (pos) setzen(pos.x * innerWidth, pos.y * innerHeight);
      else { k.style.left = 'calc(env(safe-area-inset-left) + 6px)'; k.style.top = 'calc(50% - 16px)'; }
    }
    platzieren();
    addEventListener('resize', platzieren);
    var start = null, gezogen = false;
    function stopp(e){ e.stopPropagation(); }
    k.addEventListener('touchstart', stopp, { passive:true });
    k.addEventListener('touchmove', function(e){ e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { passive:false });
    k.addEventListener('touchend', function(e){ e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { passive:false });
    k.addEventListener('pointerdown', function(e){
      e.stopPropagation(); e.preventDefault();
      var r = k.getBoundingClientRect();
      start = { x:e.clientX, y:e.clientY, dx:e.clientX - r.left, dy:e.clientY - r.top }; gezogen = false;
      k.style.opacity = '.9';
      try { k.setPointerCapture(e.pointerId); } catch (f) {}
    });
    k.addEventListener('pointermove', function(e){
      if (!start) return;
      e.stopPropagation();
      if (!gezogen && Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 10) return;
      gezogen = true;
      setzen(e.clientX - start.dx, e.clientY - start.dy);
    });
    function ende(e){
      if (!start) return;
      e.stopPropagation(); start = null; k.style.opacity = '.3';
      if (gezogen){
        var r = k.getBoundingClientRect();
        pos = { x:r.left / innerWidth, y:r.top / innerHeight };
        try { localStorage.setItem('goodnotes_knopf', JSON.stringify(pos)); } catch (f) {}
      } else if (e.type === 'pointerup') oeffnen();
    }
    k.addEventListener('pointerup', ende);
    k.addEventListener('pointercancel', ende);
    k.addEventListener('click', stopp);
    k.addEventListener('contextmenu', function(e){ e.preventDefault(); });
    document.body.appendChild(k);
  }
  if (document.body) bauen(); else document.addEventListener('DOMContentLoaded', bauen);
})();
