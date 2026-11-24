(function (root) {
  'use strict';
  const endpoint = 'https://network.slipmeter.app/api/appsumo/redeem';

  function parseCodes(value) {
    const codes = [...new Set(String(value || '').split(/[,\r\n]+/).map(code => code.trim().toUpperCase().replace(/[-\s]/g, '')).filter(Boolean))];
    if (!codes.length || codes.length > 10 || codes.some(code => !/^SMAS[0-9A-F]{32}$/.test(code))) {
      throw new Error('Enter one to ten valid SlipMeter AppSumo codes, separated by commas or new lines.');
    }
    return codes;
  }

  function confirmedLicense(result) {
    const plan = result?.entitlement;
    if (result?.ok !== true || plan?.source !== 'appsumo' || plan.lifetime !== true
      || ![1, 3, 6, 10].includes(plan.tier) || !Number.isInteger(plan.namedUsers) || plan.namedUsers < 1
      || !Number.isInteger(plan.maxMacs) || plan.maxMacs < 1 || !Number.isInteger(plan.ownerMacLimit) || plan.ownerMacLimit < 1) {
      throw new Error('The service did not confirm your license. Request a new verification email or contact support.');
    }
    return { tier: plan.tier, seats: plan.namedUsers, maxMacs: plan.maxMacs, ownerMacLimit: plan.ownerMacLimit, email: plan.email, codeCount: plan.codeCount };
  }

  async function request({ body, fetchImpl = fetch }) {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST', redirect: 'error', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
      });
    } catch { throw new Error('No confirmation received. Check your connection and retry.'); }
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      const messages = {
        invalid_email: 'Enter a valid owner email address.',
        invalid_code: 'Check your SlipMeter AppSumo codes.',
        code_unavailable: 'One or more codes are unavailable. Check the codes and original owner email.',
        stack_limit: 'An entitlement supports up to ten codes.',
        invalid_account: 'Complete every account field. Passwords must contain at least 12 characters.',
        account_conflict: 'That email already has an account. Enter its existing password or use a different owner email.',
        email_unavailable: 'Your codes were saved, but the email could not be sent. Retry with the same email and codes.'
      };
      throw new Error(messages[result?.code] || (response.status === 429 ? 'Too many attempts. Please wait an hour before retrying.' : 'The activation service is unavailable. Retry with the same email and codes later.'));
    }
    return result;
  }

  async function redeemCodes({ name, organizationName, email, password, codes, fetchImpl = fetch }) {
    name = String(name || '').trim();
    organizationName = String(organizationName || '').trim();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    if (!name || name.length > 120) throw new Error('Enter the owner name.');
    if (!organizationName || organizationName.length > 160) throw new Error('Enter the business or team name.');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid owner email.');
    if (password.length < 12 || password.length > 256) throw new Error('Create a password containing 12 to 256 characters.');
    const pending = parseCodes(codes);
    const result = await request({ body: { name, organizationName, email, password, codes: pending }, fetchImpl });
    if (result.confirmationEmailSent !== true) throw new Error('The service did not confirm the activation email. Activation is not complete.');
    return { verificationRequired: result.verificationRequired === true, message: result.message, license: confirmedLicense(result) };
  }

  async function prepareDownload({ name, email, fetchImpl = fetch }) {
    const response = await fetchImpl('https://network.slipmeter.app/api/download/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, source: 'slipmeter.app/appsumo' }),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    const url = new URL(result.downloadUrl);
    if (!response.ok || url.origin !== 'https://network.slipmeter.app' || !url.pathname.startsWith('/api/download/') || url.username || url.password) {
      throw new Error('Installer link unavailable.');
    }
    return url.href;
  }

  const client = { parseCodes, confirmedLicense, redeemCodes, prepareDownload };
  if (typeof module !== 'undefined' && module.exports) module.exports = client;
  else root.AppSumoClient = client;
})(globalThis);
