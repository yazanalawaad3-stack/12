// common-nav.js
// Safe no-op placeholder. Your pages include this file; keeping it prevents 404s.
// It does NOT change any styles.
;(function (w) {
  "use strict";
  // Optional: highlight active nav links if you have them
  try {
    var path = (location.pathname || "").split("/").pop();
    var links = document.querySelectorAll('a[href]');
    links.forEach(function(a){
      var href = (a.getAttribute('href') || '').split('/').pop();
      if (href && path && href === path) a.classList.add('active');
    });
  } catch (e) {}
})(window);
