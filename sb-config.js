// Supabase configuration file
// This file defines the connection details for the Supabase backend.
// It exposes a global `SB_CONFIG` object which contains the base URL and
// anonymous API key required to access your Supabase project's REST
// interface. The helper method `headers()` returns the correct set of
// headers needed on each request.

;(function () {
  'use strict';

  // These values are provided by the user. Do not modify them here.
  var url = 'https://oyowsjjmaesspqiknvhp.supabase.co';
  var anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95b3dzamptYWVzc3BxaWtudmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTE4NzcsImV4cCI6MjA4MTM4Nzg3N30.aBo32xNG_dh1QD7NBI4N6jhYFLY42Xyxer2DNXxJi-w';

  // Build an object with helper functions for constructing API requests.
  var SB_CONFIG = {
    url: url,
    anonKey: anonKey,
    /**
     * Returns common headers for Supabase REST requests. The
     * Authorization header uses the anon key by default.
     */
    headers: function () {
      return {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
    }
  };

  // Expose globally
  if (typeof window !== 'undefined') {
    window.SB_CONFIG = SB_CONFIG;
  }
})();