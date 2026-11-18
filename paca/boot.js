/* راه‌اندازی برنامه؛ در وب، service worker برای باز شدن آفلاین ثبت می‌شود. */
(function () {
  if (!window.PacaDesktop && !window.PacaAndroid && 'serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  window.PacaApp.init();
})();
