(function () {
  const menu = document.getElementById('menu-button');
  const nav = document.getElementById('nav-links');
  if (!menu || !nav) return;
  menu.addEventListener('click', function () {
    const open = nav.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', function (event) {
    if (!event.target.closest('a')) return;
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
  });
})();

(function () {
  const coupon = document.getElementById('slipmeter-coupon');
  const status = document.querySelector('.coupon-status');
  const endpoint = 'https://new.clickcoach.io/api/slipmeter/coupons/redeem';

  function fieldValue(form, selector) {
    const field = form.querySelector(selector);
    return field ? String(field.value || '').trim() : '';
  }

  window.redeemSlipMeterCoupon = async function (form) {
    const code = coupon ? coupon.value.trim() : '';
    if (!code) return true;
    if (status) {
      status.textContent = 'Checking coupon code...';
      status.className = 'coupon-status';
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          couponCode: code,
          coupon_code: code,
          firstName: fieldValue(form, '[name="first_name"]'),
          lastName: fieldValue(form, '[name="last_name"]'),
          email: fieldValue(form, '[name="email"]'),
          source: 'slipmeter-standalone-web'
        })
      });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.applied) throw new Error(result.message || 'That coupon code could not be applied.');
      if (status) {
        status.textContent = result.message || 'Coupon code applied.';
        status.className = 'coupon-status status-success';
      }
      return true;
    } catch (error) {
      if (status) {
        status.textContent = error.message || 'We could not verify that coupon code. Please check it and try again.';
        status.className = 'coupon-status status-error';
      }
      return false;
    }
  };
})();

(function () {
  const form = document.getElementById('download-form');
  if (!form) return;
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('download-status');
  const coupon = document.getElementById('slipmeter-coupon');
  const ready = document.getElementById('download-ready');
  const secureLink = document.getElementById('secure-download-link');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparing secure download...';
    }
    if (status) {
      status.textContent = '';
      status.className = 'download-status';
    }
    try {
      const couponApproved = await window.redeemSlipMeterCoupon(form);
      if (!couponApproved) return;
      const values = new FormData(form);
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${values.get('first_name') || ''} ${values.get('last_name') || ''}`.trim(),
          email: values.get('email'),
          source: 'slipmeter.app'
        })
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok || !payload.downloadUrl) throw new Error(payload.error || 'Secure download preparation failed.');
      secureLink.href = payload.downloadUrl;
      ready.hidden = false;
      if (status) {
        status.textContent = payload.message || 'Registration complete. Your secure download is ready.';
        status.className = 'download-status status-success';
      }
      form.reset();
      if (coupon) coupon.value = '';
    } catch (error) {
      if (status) {
        status.textContent = error.message || 'Something went wrong. Please check your details and try again.';
        status.className = 'download-status status-error';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Register and download';
      }
    }
  });

  if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
    const heading = document.querySelector('.download-card-head span');
    if (heading) heading.textContent = 'Subscription confirmed. Register your email for a secure installer link.';
    document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' });
  }
})();
