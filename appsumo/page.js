(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const form = byId('appsumo-form');
  const fields = byId('activation-fields');
  const status = byId('activation-status');
  const licenseResult = byId('license-result');
  const download = byId('prepare-download');
  let confirmedOwner = null;
  let busy = false;

  function setBusy(value) {
    busy = value;
    fields.disabled = value;
    download.disabled = value;
  }
  function clearResult() {
    licenseResult.hidden = true;
    byId('installer-link').hidden = true;
    byId('installer-link').removeAttribute('href');
    byId('installer-status').textContent = '';
    confirmedOwner = null;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    clearResult();
    status.dataset.tone = '';
    status.textContent = 'Submitting codes for email verification...';
    try {
      const result = await AppSumoClient.redeemCodes({
        name: byId('owner-name').value,
        organizationName: byId('organization-name').value,
        email: byId('owner-email').value,
        password: byId('owner-password').value,
        codes: byId('appsumo-codes').value,
      });
      const license = result.license;
      confirmedOwner = { name: byId('owner-name').value.trim(), email: license.email };
      byId('license-tier').textContent = `${license.tier}-code`;
      byId('license-seats').textContent = String(license.seats);
      byId('license-macs').textContent = String(license.maxMacs);
      byId('license-owner').textContent = license.email;
      licenseResult.hidden = false;
      byId('appsumo-codes').value = '';
      byId('owner-password').value = '';
      status.dataset.tone = 'success';
      status.textContent = result.message || 'Verification email sent. Confirm your address to finish account activation.';
      licenseResult.focus();
    } catch (error) {
      status.dataset.tone = 'error';
      status.textContent = error.message || 'Activation was not confirmed.';
    } finally { setBusy(false); }
  });

  download.addEventListener('click', async () => {
    if (!confirmedOwner || busy) return;
    setBusy(true);
    const message = byId('installer-status');
    const link = byId('installer-link');
    link.hidden = true;
    message.dataset.tone = '';
    message.textContent = 'Preparing secure installer link...';
    try {
      link.href = await AppSumoClient.prepareDownload(confirmedOwner);
      link.hidden = false;
      message.textContent = 'Current installer ready. This secure link expires; request another here if needed.';
    } catch {
      message.dataset.tone = 'error';
      message.textContent = 'Your license is confirmed, but the installer link is unavailable. Try again or visit SlipMeter downloads.';
    } finally { setBusy(false); }
  });
})();
