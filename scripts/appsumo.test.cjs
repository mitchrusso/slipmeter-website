const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseCodes, redeemCodes, prepareDownload } = require('../appsumo/client.js');
const code = 'SMAS' + 'A'.repeat(32);
const secondCode = 'SMAS' + 'B'.repeat(32);
const entitlement = { source: 'appsumo', lifetime: true, tier: 6, namedUsers: 15, maxMacs: 30, ownerMacLimit: 2, email: 'owner@example.com', codeCount: 6 };
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const inputs = { name: 'Owner', organizationName: 'Owner Company', email: ' Owner@Example.com ', password: 'correct horse battery staple', codes: `${code},\n${secondCode}` };

test('newline/comma parsing canonicalizes and deduplicates codes', () => {
  assert.deepEqual(parseCodes(`${code.toLowerCase()},\r\n${secondCode},${code}`), [code, secondCode]);
  assert.deepEqual(parseCodes(`SMAS-${'AAAA-'.repeat(8)}`), [code]);
  assert.throws(() => parseCodes(''), /one to ten/);
  assert.throws(() => parseCodes('invalid'), /valid/);
  assert.throws(() => parseCodes(Array.from({ length: 11 }, (_, i) => 'SMAS' + i.toString(16).padStart(32, '0')).join(',')), /one to ten/);
});

test('batch redemption is one atomic request, not ten rate-limited emails', async () => {
  const calls = [];
  const result = await redeemCodes({ ...inputs, fetchImpl: async (url, options) => {
    calls.push({ url, ...options });
    return response({ ok: true, verificationRequired: true, confirmationEmailSent: true, entitlement }, 201);
  }});
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].body), { name: 'Owner', organizationName: 'Owner Company', email: 'owner@example.com', password: 'correct horse battery staple', codes: [code, secondCode] });
  assert.equal(calls[0].credentials, 'omit');
  assert.equal(result.license.tier, 6);
});

test('invalid identity never submits codes', async () => {
  let called = false;
  const fetchImpl = async () => { called = true; };
  await assert.rejects(redeemCodes({ ...inputs, name: ' ', fetchImpl }), /owner name/);
  await assert.rejects(redeemCodes({ ...inputs, organizationName: ' ', fetchImpl }), /business or team/);
  await assert.rejects(redeemCodes({ ...inputs, email: 'invalid', fetchImpl }), /email/);
  await assert.rejects(redeemCodes({ ...inputs, password: 'short', fetchImpl }), /12 to 256/);
  assert.equal(called, false);
});

test('HTTP 200 without API confirmation never reports success', async () => {
  for (const data of [null, {}, { ok: true }, { ok: false }, { ok: true, verificationRequired: true }]) {
    await assert.rejects(redeemCodes({ ...inputs, fetchImpl: async () => response(data) }));
  }
});

test('API errors and network failures never echo codes or server messages', async () => {
  for (const status of [400, 409, 429, 503]) {
    await assert.rejects(redeemCodes({ ...inputs, fetchImpl: async () => response({ ok: false, code: 'code_unavailable', message: code }, status) }), error => !error.message.includes(code));
  }
  await assert.rejects(redeemCodes({ ...inputs, fetchImpl: async () => { throw new Error(code); } }), /No confirmation/);
  await assert.rejects(redeemCodes({ ...inputs, fetchImpl: async () => response({ ok: false, code: 'email_unavailable' }, 503) }), /codes were saved/);
});

test('installer uses existing secure delivery and rejects untrusted links', async () => {
  const good = 'https://network.slipmeter.app/api/download/test-token';
  assert.equal(await prepareDownload({ name: 'Owner', email: 'owner@example.com', fetchImpl: async () => response({ downloadUrl: good }) }), good);
  for (const downloadUrl of ['javascript:alert(1)', 'https://evil.example/installer.dmg', 'https://network.slipmeter.app.evil.example/api/download/test', 'https://network.slipmeter.app/other']) {
    await assert.rejects(prepareDownload({ name: 'Owner', email: 'owner@example.com', fetchImpl: async () => response({ downloadUrl }) }));
  }
});

function pageHarness(client) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', hidden: true, disabled: false, dataset: {}, textContent: '',
      addEventListener(type, callback) { this[type] = callback; }, focus() {}, removeAttribute(name) { delete this[name]; } });
    return elements.get(id);
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../appsumo/page.js'), 'utf8'), { document: { getElementById: element }, AppSumoClient: client });
  element('owner-name').value = 'Owner';
  element('organization-name').value = 'Owner Company';
  element('owner-email').value = 'owner@example.com';
  element('owner-password').value = 'correct horse battery staple';
  element('appsumo-codes').value = code;
  return { element, submit: id => element(id).submit({ preventDefault() {} }) };
}

test('page shows reserved entitlement and verification next step', async () => {
  const h = pageHarness({ redeemCodes: async () => ({ verificationRequired: true, message: 'Check your email.', license: { tier: 3, seats: 5, maxMacs: 10, ownerMacLimit: 2, email: 'verified@example.com' } }) });
  await h.submit('appsumo-form');
  assert.equal(h.element('license-result').hidden, false);
  assert.equal(h.element('appsumo-codes').value, '');
  assert.equal(h.element('owner-password').value, '');
  assert.match(h.element('activation-status').textContent, /Check your email/);
  assert.equal(h.element('license-owner').textContent, 'verified@example.com');
  assert.equal(h.element('license-seats').textContent, '5');
});

test('page preserves failed batch for retry and hides stale successes', async () => {
  const h = pageHarness({ redeemCodes: async () => { throw new Error('Unavailable'); } });
  h.element('license-result').hidden = false;
  h.element('installer-link').href = 'old-link';
  await h.submit('appsumo-form');
  assert.equal(h.element('appsumo-codes').value, code);
  assert.equal(h.element('license-result').hidden, true);
  assert.equal(h.element('installer-link').href, undefined);
  assert.equal(h.element('activation-fields').disabled, false);
});

test('static page has all wired controls, no inline scripts or secret storage', () => {
  const html = fs.readFileSync(require.resolve('../appsumo/index.html'), 'utf8');
  const page = fs.readFileSync(require.resolve('../appsumo/page.js'), 'utf8');
  for (const [, id] of page.matchAll(/byId\('([^']+)'\)/g)) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /Code stacking: 1 \/ 3 \/ 6 \/ 10/);
  assert.match(html, /lifetime Network for included seats/i);
  assert.doesNotMatch(html, /<script(?![^>]*src=)/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\./);
});
