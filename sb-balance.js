/* sb-balance.js
 * Demo balance renderer:
 * - Shows a "demo" USDT balance on the UI.
 * - Balance source priority:
 *   1) Supabase wallet_balances by user_id (uuid) if sb_user_id_v1 exists
 *   2) Supabase wallet_balances by uid (text) if demoCurrentUser exists
 *   3) Fallback to local DemoWallet state (offline demo)
 *
 * This keeps the UI moving even if deposits/withdrawals are processed in the backend,
 * while still avoiding "real on-chain" balance display semantics.
 */
;(function (window, document) {
  "use strict";

  var SUPABASE_URL = w.SUPABASE_URL || "https://oyowsjjmaesspqiknvhp.supabase.co";
  var SUPABASE_KEY = w.SUPABASE_ANON || "";
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Supabase config missing. Load sb-config.js first.");
  }

  var SB_USER_ID_KEY = "sb_user_id_v1";      // uuid from public.users (if used)
  var DEMO_USER_KEY  = "demoCurrentUser";    // local demo user (has .id)

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function getSupabaseUserId() {
    try {
      if (window.ExaAuth && typeof window.ExaAuth.getSupabaseUserId === "function") {
        var v = window.ExaAuth.getSupabaseUserId();
        if (v) return String(v);
      }
    } catch (e) {}
    try { return localStorage.getItem(SB_USER_ID_KEY) || ""; } catch (e) { return ""; }
  }

  function getDemoUid() {
    try {
      var raw = localStorage.getItem(DEMO_USER_KEY);
      if (!raw) return "";
      var u = safeJsonParse(raw);
      if (u && u.id) return String(u.id);
    } catch (e) {}
    // DemoWallet state sometimes carries userId
    try {
      if (window.DemoWallet && typeof window.DemoWallet.getState === "function") {
        var st = window.DemoWallet.getState();
        if (st && st.userId) return String(st.userId);
      }
    } catch (e) {}
    return "";
  }

  function fmt(n) {
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    // keep up to 2 decimals, strip trailing zeros
    var s = x.toFixed(2);
    s = s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return s;
  }

  function updateUI(usdt) {
    var usdtStr = fmt(usdt);

    
    // Keep legacy demo balance in sync so pages like member.html can read it
    try { localStorage.setItem('demoBalance', String(usdtStr)); } catch (e) {}
// Token rows (e.g., USDT line item)
    var curAmt = document.querySelector(".currency-amount[data-asset='USDT']") || document.querySelector(".currency-amount");
    if (curAmt) curAmt.textContent = usdtStr;

    // Big balance (expects like "123 USDT")
    var bigEls = document.querySelectorAll(".assets-usdt-balance");
    for (var b = 0; b < bigEls.length; b++) {
      bigEls[b].textContent = usdtStr + " USDT";
    }

    // Donut center amount: only update the inner span so we don't destroy markup
    var usdApprox = document.querySelector(".assets-usd-approx");
    if (usdApprox) usdApprox.textContent = usdtStr;

    // Any other explicit USDT balance holders (numeric only)
    var els = document.querySelectorAll("[data-balance='USDT'], .usdt-balance");
    for (var i = 0; i < els.length; i++) {
      els[i].textContent = usdtStr;
    }
  }

  async function fetchWalletBalancesBy(field, value) {
    var url =
      SUPABASE_URL +
      "/rest/v1/wallet_balances?select=usdt_balance,updated_at&" +
      encodeURIComponent(field) +
      "=eq." +
      encodeURIComponent(value) +
      "&limit=1";

    var res = await fetch(url, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY,
        "Accept": "application/json"
      }
    });

    if (!res.ok) return null;
    var data = await res.json();
    if (!data || !data.length) return null;
    return data[0];
  }

  function getLocalDemoBalance() {
    try {
      if (window.DemoWallet && typeof window.DemoWallet.getSummary === "function") {
        var s = window.DemoWallet.getSummary();
        if (s && s.balances && s.balances.USDT != null) return Number(s.balances.USDT);
      }
      if (window.DemoWallet && typeof window.DemoWallet.getState === "function") {
        var st = window.DemoWallet.getState();
        if (st && st.balances && st.balances.USDT != null) return Number(st.balances.USDT);
      }
    } catch (e) {}
    return 0;
  }

  async function fetchBalance() {
    // Priority 1: uuid user_id
    var sbId = getSupabaseUserId();
    if (sbId) {
      try {
        var row1 = await fetchWalletBalancesBy("user_id", sbId);
        if (row1 && row1.usdt_balance != null) {
          updateUI(row1.usdt_balance);
          return;
        }
      } catch (e) {}
    }

    // If sb_user_id_v1 is not cached yet, try to resolve it via ExaAuth (maps demo user → public.users row)
    if (!sbId && window.ExaAuth && typeof window.ExaAuth.ensureSupabaseUserId === "function") {
      try {
        sbId = await window.ExaAuth.ensureSupabaseUserId();
        if (sbId) {
          var row1b = await fetchWalletBalancesBy("user_id", sbId);
          if (row1b && row1b.usdt_balance != null) {
            updateUI(row1b.usdt_balance);
            return;
          }
        }
      } catch (e) {}
    }


    // Priority 2: demo uid (text)
    var uid = getDemoUid();
    if (uid) {
      try {
        var row2 = await fetchWalletBalancesBy("uid", uid);
        if (row2 && row2.usdt_balance != null) {
          updateUI(row2.usdt_balance);
          return;
        }
      } catch (e) {}
    }

    // Fallback: local demo state
    updateUI(getLocalDemoBalance());
  }

  function init() {
    // Initial fetch
    fetchBalance();

    // Refresh when user returns to tab
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) fetchBalance();
    });

    // Gentle polling (keeps UI fresh after deposit/withdraw)
    setInterval(fetchBalance, 6000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
