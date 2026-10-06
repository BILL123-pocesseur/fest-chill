/* Fest&Chill — appli installable : service worker + invitation à installer */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  if (/festchill-admin/.test(location.pathname)) return;           // pas d'invitation sur l'administration
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;
  try { var d = parseInt(localStorage.getItem('fc-pwa-dismissed') || '0', 10); if (d && Date.now() - d < 14 * 86400000) return; } catch (e) {}

  var deferred = null, shown = false;
  function banner(html, actionLabel, onAction) {
    if (shown || document.getElementById('fc-pwa-banner')) return; shown = true;
    var b = document.createElement('div'); b.id = 'fc-pwa-banner';
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9000;max-width:460px;margin:0 auto;display:flex;gap:10px;align-items:center;padding:12px 14px;border-radius:16px;background:#241C14;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:.84rem;line-height:1.35';
    b.innerHTML = '<img src="icons/icon-192.png" alt="" width="40" height="40" style="border-radius:10px;flex:0 0 auto"><div style="flex:1;min-width:0">' + html + '</div>'
      + (actionLabel ? '<button id="fc-pwa-go" style="flex:0 0 auto;padding:9px 14px;border:none;border-radius:10px;background:#E8A33D;color:#241C14;font-weight:800;cursor:pointer">' + actionLabel + '</button>' : '')
      + '<button id="fc-pwa-x" aria-label="Fermer" style="flex:0 0 auto;border:none;background:transparent;color:#fff;opacity:.7;font-size:1.1rem;cursor:pointer;padding:4px 6px">✕</button>';
    document.body.appendChild(b);
    function close(remember) { b.remove(); if (remember) { try { localStorage.setItem('fc-pwa-dismissed', String(Date.now())); } catch (e) {} } }
    document.getElementById('fc-pwa-x').onclick = function () { close(true); };
    var go = document.getElementById('fc-pwa-go'); if (go) go.onclick = function () { onAction(close); };
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    setTimeout(function () {
      banner('<b>Installe Fest&amp;Chill</b><br><span style="opacity:.8">Accès direct depuis ton écran d\'accueil</span>', 'Installer', function (close) {
        if (!deferred) return; deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; close(false); });
      });
    }, 2500);
  });
  window.addEventListener('appinstalled', function () { var b = document.getElementById('fc-pwa-banner'); if (b) b.remove(); });

  // iPhone / iPad : pas de bouton automatique, on explique le geste
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  if (isIOS && isSafari) {
    setTimeout(function () {
      banner('<b>Installe Fest&amp;Chill</b><br><span style="opacity:.85">Touche <b>Partager</b> ⬆️ puis <b>« Sur l\'écran d\'accueil »</b></span>', '', null);
    }, 3500);
  }
})();
