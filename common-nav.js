// Common navigation utilities
//
// This lightweight script enforces that most pages require the user
// to be authenticated. If no user ID is found in localStorage then
// the browser is redirected to the login page. It excludes the
// `login.html` and `signup.html` pages from this check to avoid
// redirect loops. Additional navigation logic can be added here
// without altering existing HTML structure.

;(function () {
  'use strict';
  function enforceAuth() {
    // Determine the current file name
    var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    // Only protect pages other than login and signup
    if (page === 'login.html' || page === 'signup.html') return;
    if (!window.ExaAuth || typeof window.ExaAuth.ensureSupabaseUserId !== 'function') return;
    window.ExaAuth.ensureSupabaseUserId().then(function (uid) {
      if (!uid) {
        window.location.href = 'login.html';
      }
    }).catch(function () {});
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceAuth);
  } else {
    enforceAuth();
  }
})();