// wallet.js
// RPC helpers for your Supabase database functions.
// Requires: sb-config.js loaded AND @supabase/supabase-js v2 loaded.
;(function (w) {
  "use strict";

  function requireSupabase() {
    if (!w.supabase || !w.supabase.createClient) {
      throw new Error("Supabase JS not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    if (!w.SUPABASE_URL || !w.SUPABASE_ANON) {
      throw new Error("Supabase config missing. Load sb-config.js before wallet.js");
    }
    return w.supabase.createClient(w.SUPABASE_URL, w.SUPABASE_ANON);
  }

  function getUserId() {
    try { return localStorage.getItem("sb_user_id_v1"); } catch(e) { return null; }
  }

  async function rpc(name, params) {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc(name, params || {});
    if (error) throw error;
    return data;
  }

  w.SBWallet = {
    getUserId,
    rpc,

    // iPower action
    performIPowerAction: async function () {
      const uid = getUserId();
      if (!uid) throw new Error("Not logged in");
      return rpc("perform_ipower_action", { p_user: uid });
    },

    // Withdraw
    requestWithdrawal: async function (amount, currency, network, address) {
      const uid = getUserId();
      if (!uid) throw new Error("Not logged in");
      return rpc("request_withdrawal", {
        p_user: uid,
        p_amount: amount,
        p_currency: currency,
        p_network: network,
        p_address: address
      });
    },

    // Assets summaries (if you use these RPCs)
    getAssetsSummary: async function () {
      const uid = getUserId();
      if (!uid) throw new Error("Not logged in");
      return rpc("get_assets_summary", { p_user: uid });
    },
    getAssetsDashboard: async function () {
      const uid = getUserId();
      if (!uid) throw new Error("Not logged in");
      return rpc("get_assets_dashboard", { p_user: uid });
    },
    getPersonalIncome: async function () {
      const uid = getUserId();
      if (!uid) throw new Error("Not logged in");
      return rpc("get_personal_income", { p_user: uid });
    },
    getTeamIncome: async function () {
      const uid = getUserId();
      if (!uid) throw new Error("Not logged in");
      return rpc("get_team_income", { p_user: uid });
    }
  };
})(window);
