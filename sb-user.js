/* sb-user.js
 * Reads current user's profile from Supabase public.users using cached UUID in localStorage (sb_user_id_v1).
 * Exposes:
 *   window.SBUser.getCurrentProfile() -> Promise<{id, phone, inviteCode, createdAt}>
 *   window.SBUser.fetchUserRowById(id) -> Promise<row|null>
 */
;(function (window) {
  "use strict";

  var SUPABASE_URL = w.SUPABASE_URL || "https://oyowsjjmaesspqiknvhp.supabase.co";
  var SUPABASE_KEY = w.SUPABASE_ANON || "";
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Supabase config missing. Load sb-config.js first.");
  }
  var SB_USER_ID_KEY = "sb_user_id_v1";

  function apiHeaders() {
    return {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
  }

  function getSupabaseUserId() {
    try {
      var v = localStorage.getItem(SB_USER_ID_KEY);
      if (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return v;
    } catch (e) {}
    return "";
  }

  async function fetchUserRowById(id) {
    if (!id) return null;
    var url = SUPABASE_URL + "/rest/v1/users?select=id,phone,invite_code,public_id,created_at&" +
      "id=eq." + encodeURIComponent(id) + "&limit=1";
    var res = await fetch(url, { method: "GET", headers: apiHeaders() });
    if (!res.ok) return null;
    var rows = await res.json();
    return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
  }

  async function getCurrentProfile() {
    var id = getSupabaseUserId();
    if (!id) return null;

    var row = await fetchUserRowById(id);
    if (!row) return null;

    return {
      id: row.id || "",
      phone: row.phone || "",
      inviteCode: row.invite_code || "",
      publicId: row.public_id || "",
      createdAt: row.created_at || ""
    };
  }

  window.SBUser = {
    getCurrentProfile: getCurrentProfile,
    fetchUserRowById: fetchUserRowById
  };
})(window);
