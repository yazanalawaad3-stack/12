// User profile utilities
//
// This module defines a global `SBUser` object with helper methods
// for retrieving information about the currently logged-in user from
// the Supabase database. It relies on the user ID stored in
// localStorage by `auth.js`.

;(function () {
  'use strict';
  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before sb-user.js.');
    return;
  }

  /**
   * Fetch the profile of the currently logged-in user. Returns null if
   * no user is logged in or the user cannot be found. The returned
   * object includes both the internal ID and the public ID as well as
   * phone number and invitation codes.
   *
   * @returns {Promise<{id:string, phone:string, inviteCode:string, usedInviteCode:string|null, publicId:number, createdAt:string}|null>}
   */
  async function getCurrentProfile() {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) return null;
    var url = SB.url + '/rest/v1/users'
      + '?select=id,phone,invite_code,used_invite_code,public_id,created_at'
      + '&id=eq.' + encodeURIComponent(userId)
      + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    var row = rows[0];
    return {
      id: row.id,
      phone: row.phone,
      inviteCode: row.invite_code,
      usedInviteCode: row.used_invite_code,
      publicId: row.public_id,
      createdAt: row.created_at
    };
  }

  window.SBUser = {
    getCurrentProfile: getCurrentProfile
  };
})();