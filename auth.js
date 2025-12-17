// auth.js
;(function (window) {
  "use strict";

  var SUPABASE_URL = window.SUPABASE_URL || "https://oyowsjjmaesspqiknvhp.supabase.co";
  var SUPABASE_ANON = window.SUPABASE_ANON || "";
  var SB_USER_ID_KEY = "sb_user_id_v1";

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error("Supabase config missing. Ensure sb-config.js is loaded first.");
  }


  function apiHeaders() {
    return {
      apikey: SUPABASE_ANON,
      Authorization: "Bearer " + SUPABASE_ANON,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }

  function isUuid(v) {
    return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }

  function setSupabaseUserId(id) {
    try {
      if (id && isUuid(id)) localStorage.setItem(SB_USER_ID_KEY, String(id));
    } catch (e) {}
  }

  async function fetchOne(path) {
    var res = await fetch(SUPABASE_URL + path, { headers: apiHeaders() });
    if (!res.ok) return null;
    var data = await res.json();
    return Array.isArray(data) && data[0] ? data[0] : null;
  }

  async function findUserByPhone(phone) {
    return fetchOne("/rest/v1/users?select=id,phone,invite_code&phone=eq." + encodeURIComponent(phone));
  }

  async function findInviterByCode(code) {
    return fetchOne("/rest/v1/users?select=id&invite_code=eq." + encodeURIComponent(code));
  }

  async function registerWithInvite(opts) {
    var phone = String(opts.phone || "").trim();
    var usedCode = String(opts.usedInviteCode || "").trim().toUpperCase();

    var inviter = await findInviterByCode(usedCode);
    if (!inviter) throw new Error("Invalid invite");

    var res = await fetch(SUPABASE_URL + "/rest/v1/users", {
      method: "POST",
      headers: Object.assign({}, apiHeaders(), { Prefer: "return=representation" }),
      body: JSON.stringify({
        phone: phone,
        used_invite_code: usedCode,
        inviter_id: inviter.id
      })
    });

    var rows = await res.json();
    var user = rows[0];

    setSupabaseUserId(user.id);
    return user;
  }

  async function loginWithPhone(opts) {
    var phone = String(opts.phone || "").trim();
    var user = await findUserByPhone(phone);
    if (!user) throw new Error("Not found");
    setSupabaseUserId(user.id);
    return user;
  }

  
function getSupabaseUserId() {
  try { return localStorage.getItem(SB_USER_ID_KEY) || ""; } catch (e) { return ""; }
}

function fullPhone(areaCode, digits) {
  areaCode = String(areaCode || "").trim();
  digits = String(digits || "").replace(/\D/g, "");
  return areaCode + digits;
}
window.ExaAuth = { registerWithInvite: registerWithInvite, loginWithPhone: loginWithPhone, getSupabaseUserId: getSupabaseUserId, fullPhone: fullPhone };
})(window);
