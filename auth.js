// Authentication and user registration module
//
// This script defines a global `ExaAuth` object that provides methods
// for registering new users and logging existing users in using the
// Supabase REST API. It stores minimal session information in the
// browser's localStorage so that other pages can identify the current
// user. Passwords are stored locally on the device and are never
// transmitted to Supabase; the backend keeps no record of user
// passwords. Invitation codes are validated by database triggers in
// Supabase.

;(function () {
  'use strict';

  // Ensure configuration is present
  var SB = window.SB_CONFIG;
  if (!SB) {
    console.error('SB_CONFIG is not defined. Ensure sb-config.js is loaded before auth.js.');
    return;
  }

  /**
   * Normalize a phone number by concatenating the area code prefix and
   * the number's digits. Leading plus signs in the prefix are removed.
   *
   * @param {string} prefix The international dialing code, e.g. "+961"
   * @param {string} digits The phone number digits, e.g. "70123456"
   * @returns {string} The full phone number (e.g. "96170123456")
   */
  function fullPhone(prefix, digits) {
    var pre = String(prefix || '').replace(/^\+/, '');
    var num = String(digits || '').replace(/\D/g, '');
    return pre + num;
  }

  /**
   * Helper to fetch a user row by phone number. Returns the first match
   * or null if no user exists.
   *
   * @param {string} phone The full phone number (no spaces or plus sign)
   * @returns {Promise<object|null>} The user record or null
   */
  async function fetchUserByPhone(phone) {
    if (!phone) return null;
    var url = SB.url + '/rest/v1/users?select=id,phone,invite_code,public_id,created_at&phone=eq.' + encodeURIComponent(phone);
    var res = await fetch(url, { method: 'GET', headers: SB.headers() });
    if (!res.ok) return null;
    var rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  /**
   * Register a new user using an invitation code. The phone number must
   * be unique. When the first user registers the invitation code can
   * be omitted; subsequent users must provide a valid invitation code
   * belonging to an existing user. On success the newly created user
   * record is returned and localStorage is updated with the current
   * user's ID and phone. The password typed by the user should be
   * stored by the caller in localStorage under the key `pw:{userId}`.
   *
   * @param {{phone:string, usedInviteCode:string}} opts
   * @returns {Promise<{id:string, phone:string, inviteCode:string, publicId:number, createdAt:string}>}
   */
  async function registerWithInvite(opts) {
    var phone = opts && opts.phone ? String(opts.phone).trim() : '';
    var usedInviteCode = opts && opts.usedInviteCode ? String(opts.usedInviteCode).trim() : null;
    if (!phone) throw new Error('Phone is required');

    // Prepare payload; omit used_invite_code if blank so that the
    // database triggers can handle the root user case gracefully.
    var payload = { phone: phone };
    if (usedInviteCode) payload.used_invite_code = usedInviteCode;

    var res = await fetch(SB.url + '/rest/v1/users', {
      method: 'POST',
      headers: Object.assign({}, SB.headers(), { 'Prefer': 'return=representation' }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      var errText;
      try { errText = await res.text(); } catch (_) {}
      throw new Error(errText || 'Failed to register');
    }
    var data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Unexpected signup response');
    var user = data[0];
    try {
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('currentPhone', user.phone);
    } catch (e) {
      // ignore storage errors
    }
    return {
      id: user.id,
      phone: user.phone,
      inviteCode: user.invite_code,
      publicId: user.public_id,
      createdAt: user.created_at
    };
  }

  /**
   * Log an existing user in by phone number. The password is compared
   * against the value stored locally under `pw:{userId}`. If no
   * stored password exists (e.g. first login after registration), the
   * typed password becomes the stored password for that user. On
   * success the user is considered logged in and their ID/phone are
   * saved in localStorage.
   *
   * @param {{phone:string}} opts
   * @returns {Promise<{id:string, phone:string}>}
   */
  async function loginWithPhone(opts) {
    var phone = opts && opts.phone ? String(opts.phone).trim() : '';
    if (!phone) throw new Error('Phone is required');
    var user = await fetchUserByPhone(phone);
    if (!user) throw new Error('Account not found');
    // Read password from the password field on the page. This avoids
    // passing the password through the function call.
    var pwdInput = document.querySelector('.password-wrapper input');
    var typed = pwdInput ? String(pwdInput.value || '') : '';
    if (!typed) throw new Error('Password required');
    var storageKey = 'pw:' + user.id;
    var stored = '';
    try { stored = localStorage.getItem(storageKey) || ''; } catch (_) {}
    if (stored && stored !== typed) {
      throw new Error('Incorrect password');
    }
    // Persist typed password if none exists
    try {
      if (!stored) localStorage.setItem(storageKey, typed);
      localStorage.setItem('currentUserId', user.id);
      localStorage.setItem('currentPhone', user.phone);
    } catch (e) {}
    return { id: user.id, phone: user.phone };
  }

  /**
   * Return the currently logged-in user's ID from localStorage. If
   * nothing is stored returns null. This returns a promise for
   * compatibility with async usage in other scripts.
   *
   * @returns {Promise<string|null>}
   */
  async function ensureSupabaseUserId() {
    var id = null;
    try { id = localStorage.getItem('currentUserId') || null; } catch (e) {}
    return id;
  }

  /**
   * Clear the current login session. This removes the stored user ID
   * and phone number from localStorage. Password entries remain
   * untouched to allow the user to log in again without retyping.
   */
  function logout() {
    try {
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('currentPhone');
    } catch (e) {}
  }

  // Expose ExaAuth
  window.ExaAuth = {
    fullPhone: fullPhone,
    registerWithInvite: registerWithInvite,
    loginWithPhone: loginWithPhone,
    ensureSupabaseUserId: ensureSupabaseUserId,
    logout: logout
  };
})();