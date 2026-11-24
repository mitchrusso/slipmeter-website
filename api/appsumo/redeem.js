'use strict';

const upstream = 'https://network.slipmeter.app/api/appsumo/redeem';
const maximumBodyBytes = 16 * 1024;

function reply(response, status, body) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  return response.status(status).send(JSON.stringify(body));
}

module.exports = async function redeemAppSumo(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return reply(response, 405, { ok: false, code: 'method_not_allowed', error: 'Use POST.' });
  }

  const contentLength = Number(request.headers?.['content-length'] || 0);
  if (contentLength > maximumBodyBytes) {
    return reply(response, 413, { ok: false, code: 'request_too_large', error: 'The activation request is too large.' });
  }

  let body = request.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maximumBodyBytes) {
      return reply(response, 413, { ok: false, code: 'request_too_large', error: 'The activation request is too large.' });
    }
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reply(response, 400, { ok: false, code: 'invalid_request', error: 'Enter the required activation details.' });
  }

  try {
    const result = await fetch(upstream, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await result.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return reply(response, 502, { ok: false, code: 'upstream_unavailable', error: 'The activation service did not return a valid response.' });
    }
    return reply(response, result.status, payload);
  } catch {
    return reply(response, 502, { ok: false, code: 'upstream_unavailable', error: 'The activation service is temporarily unavailable.' });
  }
};
