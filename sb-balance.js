// Wallet balance updater
//
// Pages that need to display the user's wallet balance can include
// this script. It queries the DemoWallet module to retrieve the
// current USDT balance and writes it into any element with the class
// `.assets-usdt-balance`. The displayed value is formatted to two
// decimal places followed by the currency ticker.

;(function () {
  'use strict';
  async function update() {
    if (!window.DemoWallet || !window.ExaAuth) return;
    var userId = await window.ExaAuth.ensureSupabaseUserId();
    if (!userId) return;
    try {
      var wallet = await window.DemoWallet.getWallet();
      var amountEl = document.querySelector('.assets-usdt-balance');
      if (amountEl) {
        var bal = wallet && typeof wallet.balance === 'number' ? wallet.balance : 0;
        amountEl.textContent = bal.toFixed(2) + ' USDT';
      }
    } catch (e) {
      // ignore fetch errors
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
})();