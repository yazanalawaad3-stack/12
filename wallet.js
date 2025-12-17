// Wallet and membership helper module
//
// This script defines a global `DemoWallet` object containing
// asynchronous functions for retrieving a user's wallet balance,
// membership level information and team statistics from Supabase.
//
// Functions return plain JavaScript objects; callers should catch
// thrown errors to handle failures gracefully.

;(function () {
  'use strict';
  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before wallet.js.');
    return;
  }

  // -------------------------------------------------------------------------
  // Internal state and caching
  //
  // Some pages expect synchronous wallet operations. To support that we
  // maintain a cached balance and reserved amount that are updated
  // asynchronously from Supabase. On script load we trigger an initial
  // refresh; subsequent calls to `refreshWallet()` can be scheduled
  // manually. Total income (used by the AI Power page to track runs)
  // persists in localStorage under the key `aiIncome`.

  var __walletCache = {
    balance: 0,
    reserved: 0,
    totalIncome: 0
  };
  // Load persisted total income
  try {
    var storedInc = localStorage.getItem('aiIncome');
    if (storedInc != null) {
      var n = parseInt(storedInc, 10);
      if (!isNaN(n)) __walletCache.totalIncome = n;
    }
  } catch (_) {}

  /**
   * Fetch the latest wallet balances from Supabase and update the
   * internal cache. This function is called on page load and can be
   * invoked again to force a refresh. It does not return anything.
   */
  async function refreshWallet() {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) return;
    var url = SB.url + '/rest/v1/wallet_balances'
      + '?select=usdt_balance,usdt_reserved'
      + '&user_id=eq.' + encodeURIComponent(userId)
      + '&limit=1';
    try {
      var res = await fetch(url, { method: 'GET', headers: SB.headers() });
      if (!res.ok) return;
      var rows = await res.json();
      if (Array.isArray(rows) && rows.length) {
        var row = rows[0];
        var bal = parseFloat(row.usdt_balance);
        var resv = parseFloat(row.usdt_reserved);
        if (!isNaN(bal)) __walletCache.balance = bal;
        if (!isNaN(resv)) __walletCache.reserved = resv;
      }
    } catch (e) {
      // ignore network errors
    }
  }

  // Immediately initiate a refresh on script load
  refreshWallet();

  /**
   * Synchronously return the cached wallet object. Contains balance,
   * reserved and totalIncome fields. For up-to-date data call
   * `refreshWallet()` before calling this function or use
   * `getWalletAsync()`.
   *
   * @returns {{balance:number, reserved:number, totalIncome:number}}
   */
  function getWalletSync() {
    return {
      balance: __walletCache.balance,
      reserved: __walletCache.reserved,
      totalIncome: __walletCache.totalIncome
    };
  }

  /**
   * Asynchronously fetch wallet balances from Supabase and return the
   * current cache. Useful when you need the freshest data but don't
   * require synchronous return.
   *
   * @returns {Promise<{balance:number, reserved:number, totalIncome:number}>}
   */
  async function getWalletAsync() {
    await refreshWallet();
    return getWalletSync();
  }

  /**
   * Fetch VIP/membership related information for the current user. The
   * Supabase table `user_state` stores whether the account is
   * activated/funded and the current VIP level. This function also
   * returns the wallet balance and a basic rules table to help
   * front-end logic determine requirements for each level. The
   * `effectiveUsers` field is derived from the team summary.
   *
   * @returns {Promise<{currentLevel:string, nextLevel:string|null, isActivated:boolean, isFunded:boolean, isLocked:boolean, balance:number, effectiveUsers:number, rulesByLevel:object}>}
   */
  async function getVipInfo() {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) return {
      currentLevel: 'V0', nextLevel: null, isActivated: false, isFunded: false,
      isLocked: false, balance: 0, effectiveUsers: 0, rulesByLevel: {}
    };
    // Retrieve user_state row
    var url = SB.url + '/rest/v1/user_state'
      + '?select=current_level,is_activated,is_funded,is_locked'
      + '&user_id=eq.' + encodeURIComponent(userId)
      + '&limit=1';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    var stateRows = [];
    if (res.ok) stateRows = await res.json();
    var state = Array.isArray(stateRows) && stateRows[0] ? stateRows[0] : {};
    var balanceObj = await getWalletAsync();
    var team = await getTeamSummary();
    var effUsers = 0;
    if (team && Array.isArray(team.members)) {
      effUsers = team.members.filter(function (m) { return m.depth && m.depth >= 1; }).length;
    }
    // Basic level requirements, consistent with SQL rules (for front-end comparison)
    var rulesByLevel = {
      'V1': { minBalance: 50, minUsers: 0 },
      'V2': { minBalance: 500, minUsers: 5 },
      'V3': { minBalance: 3000, minUsers: 10 },
      'V4': { minBalance: 10000, minUsers: 30 },
      'V5': { minBalance: 30000, minUsers: 50 },
      'V6': { minBalance: 100000, minUsers: 75 }
    };
    // Determine next level based on current level
    var order = ['V0','V1','V2','V3','V4','V5','V6'];
    var idx = order.indexOf(state.current_level || 'V0');
    var next = null;
    if (idx >= 0 && idx < order.length - 1) next = order[idx + 1];
    return {
      currentLevel: state.current_level || 'V0',
      nextLevel: next,
      isActivated: !!state.is_activated,
      isFunded: !!state.is_funded,
      isLocked: !!state.is_locked,
      balance: balanceObj.balance,
      effectiveUsers: effUsers,
      rulesByLevel: rulesByLevel
    };
  }

  /**
   * Fetch a summary of the current user's referral tree. The
   * `invite_edges` table stores rows for each ancestor/descendant
   * relationship. We query up to depth 3 to assemble an array of
   * members with their respective generation (depth). The front-end
   * can interpret this list as needed.
   *
   * @returns {Promise<{members:Array<{id:string, depth:number}>}>}
   */
  async function getTeamSummary() {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) return { members: [] };
    var url = SB.url + '/rest/v1/invite_edges'
      + '?select=descendant_id,depth'
      + '&ancestor_id=eq.' + encodeURIComponent(userId)
      + '&depth=lt.4';
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return { members: [] };
    var rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
    return {
      members: rows.map(function (r) {
        return { id: r.descendant_id, depth: r.depth };
      })
    };
  }

  /**
   * List all payout addresses saved by the current user. Each row
   * includes the currency (usdt/usdc), network (trc20/bep20/erc20),
   * the address itself and whether it is locked. Locked addresses
   * cannot be used to withdraw until unlocked by an administrator.
   *
   * @returns {Promise<Array<object>>}
   */
  async function listPayoutAddresses() {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) return [];
    var url = SB.url + '/rest/v1/user_payout_addresses'
      + '?select=currency,network,address,is_locked,locked_at'
      + '&user_id=eq.' + encodeURIComponent(userId);
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return [];
    var rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * Create a new payout address for the current user. The currency and
   * network are lowercased before sending. Returns the created row on
   * success.
   *
   * @param {string} currency Either "usdt" or "usdc"
   * @param {string} network One of "trc20","bep20","erc20"
   * @param {string} address The wallet address
   * @returns {Promise<object>}
   */
  async function addPayoutAddress(currency, network, address) {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) throw new Error('Not logged in');
    var payload = {
      user_id: userId,
      currency: String(currency || '').toLowerCase(),
      network: String(network || '').toLowerCase(),
      address: String(address || '')
    };
    var res = await fetch(SB.url + '/rest/v1/user_payout_addresses', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var msg;
      try { msg = await res.text(); } catch (_) {}
      throw new Error(msg || 'Failed to add address');
    }
    var data = await res.json();
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  /**
   * Submit a new withdrawal request. The payload mirrors the
   * `withdraw_requests` table. The caller must specify currency,
   * network, amount and destination address. The fee can be passed
   * explicitly or left undefined to allow the backend to calculate.
   *
   * @param {{currency:string, network:string, address:string, amount:number, fee?:number}} opts
   * @returns {Promise<object>}
   */
  async function requestWithdraw(opts) {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) throw new Error('Not logged in');
    var payload = {
      user_id: userId,
      currency: String(opts.currency || '').toLowerCase(),
      network: String(opts.network || '').toLowerCase(),
      to_address: String(opts.address || ''),
      amount: Number(opts.amount),
      address: String(opts.address || ''),
      fee: opts.fee != null ? Number(opts.fee) : 0
    };
    var res = await fetch(SB.url + '/rest/v1/withdraw_requests', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var err;
      try { err = await res.text(); } catch (_) {}
      throw new Error(err || 'Withdrawal failed');
    }
    var data = await res.json();
    return Array.isArray(data) && data.length ? data[0] : null;
  }

  /**
   * Record a deposit amount locally and in Supabase. The cached
   * balance is increased immediately for a snappy user experience.
   * A PATCH request is sent to Supabase to update the wallet row.
   * Errors are logged silently. Amounts must be positive numbers.
   *
   * @param {number} amount The amount to credit to the wallet
   * @param {string} currency Currently ignored (supports only USDT)
   */
  function recordDeposit(amount, currency) {
    var amt = Number(amount);
    if (!amt || !isFinite(amt) || amt <= 0) return;
    __walletCache.balance += amt;
    // persist change to Supabase asynchronously
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId) return;
    var updateUrl = SB.url + '/rest/v1/wallet_balances?user_id=eq.' + encodeURIComponent(userId);
    // Build the patch payload to increment the balance
    var patch = { usdt_balance: __walletCache.balance, updated_at: new Date().toISOString() };
    fetch(updateUrl, {
      method: 'PATCH',
      headers: SB.headers(),
      body: JSON.stringify(patch)
    }).catch(function () { /* silent */ });
  }

  /**
   * Submit a deposit transaction hash to Supabase. This function
   * creates a record in the `deposit_ledger` table. It runs
   * asynchronously and does not wait for completion.
   *
   * @param {string} txHash The transaction hash
   * @param {string} network The network used (e.g. "BEP20")
   * @param {string} currency The currency (e.g. "USDT")
   */
  function submitDepositTx(txHash, network, currency) {
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (!userId || !txHash) return;
    var payload = {
      user_id: userId,
      provider: 'manual',
      payment_id: txHash,
      currency: String(currency || 'usdt').toLowerCase(),
      network: String(network || 'bep20').toLowerCase(),
      amount: 0,
      status: 'confirmed'
    };
    fetch(SB.url + '/rest/v1/deposit_ledger', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
      body: JSON.stringify(payload)
    }).catch(function () { /* silent */ });
  }

  /**
   * Increase the total income counter. This is used by the AI Power
   * page to track how many computing tasks a user has completed.
   * The value is persisted to localStorage.
   *
   * @param {number} n Number of additional runs to add (default 1)
   */
  function addIncome(n) {
    var inc = Number(n);
    if (!inc || !isFinite(inc) || inc <= 0) inc = 1;
    __walletCache.totalIncome += inc;
    try { localStorage.setItem('aiIncome', String(__walletCache.totalIncome)); } catch (_) {}
  }

  /**
   * Submit a withdrawal request synchronously. The cached balance is
   * reduced immediately. A background request to Supabase creates the
   * withdraw_requests row. Returns an object describing the new
   * balance and totalIncome fields on success or null on failure.
   *
   * @param {number} amount The amount to withdraw (without fee)
   * @returns {{balance:number, totalIncome:number}|null}
   */
  function withdraw(amount) {
    var amt = Number(amount);
    if (!amt || !isFinite(amt) || amt <= 0) return null;
    var fee = amt * 0.05;
    var toDeduct = amt + fee;
    if (__walletCache.balance < amt) return null;
    // Update local cache
    __walletCache.balance -= amt;
    // Persist the change asynchronously and create withdraw request
    var userId = null;
    try { userId = localStorage.getItem('currentUserId') || null; } catch (e) {}
    if (userId) {
      // update wallet balance
      var patchUrl = SB.url + '/rest/v1/wallet_balances?user_id=eq.' + encodeURIComponent(userId);
      var patch = { usdt_balance: __walletCache.balance, updated_at: new Date().toISOString() };
      fetch(patchUrl, {
        method: 'PATCH',
        headers: SB.headers(),
        body: JSON.stringify(patch)
      }).catch(function () {});
      // create withdraw request
      var payload = {
        user_id: userId,
        currency: 'usdt',
        network: 'trc20',
        to_address: '',
        amount: amt,
        fee: fee,
        address: ''
      };
      fetch(SB.url + '/rest/v1/withdraw_requests', {
        method: 'POST',
        headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
        body: JSON.stringify(payload)
      }).catch(function () {});
    }
    return { balance: __walletCache.balance, totalIncome: __walletCache.totalIncome };
  }

  /**
   * Return a simple representation of the current user. Contains
   * `id` and `phone` properties or null if not logged in.
   *
   * @returns {{id:string|null, phone:string|null}}
   */
  function getUser() {
    var uid = null;
    var phone = null;
    try {
      uid = localStorage.getItem('currentUserId') || null;
      phone = localStorage.getItem('currentPhone') || null;
    } catch (e) {}
    return { id: uid, phone: phone };
  }

  // Export DemoWallet API
  window.DemoWallet = {
    // Synchronous wallet getter
    getWallet: getWalletSync,
    // Asynchronous wallet getter
    getWalletAsync: getWalletAsync,
    // VIP and team helpers
    getVipInfo: getVipInfo,
    getTeamSummary: getTeamSummary,
    // Payout addresses
    listPayoutAddresses: listPayoutAddresses,
    addPayoutAddress: addPayoutAddress,
    // Withdraw request (async, returns Promise)
    requestWithdraw: requestWithdraw,
    // Local deposit/withdraw helpers for demo purposes
    recordDeposit: recordDeposit,
    submitDepositTx: submitDepositTx,
    withdraw: withdraw,
    addIncome: addIncome,
    getUser: getUser
  };
})();