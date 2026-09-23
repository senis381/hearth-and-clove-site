/* Hearth & Clove — nav overlay, reveal, lightbox, demo-link toasts. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- toast ---------- */

  var toastEl = document.getElementById('toast');
  var toastTimer;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 3200);
  }

  /* ---------- nav overlay ---------- */

  var overlay = document.getElementById('nav-overlay');
  var openBtn = document.querySelector('[data-nav-open]');

  function setNav(open) {
    if (!overlay) return;
    overlay.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      var first = overlay.querySelector('.overlay__links a');
      if (first) first.focus();
    } else if (openBtn) {
      openBtn.focus();
    }
  }

  if (overlay) {
    overlay.removeAttribute('hidden'); // CSS handles visibility; hidden would kill the fade
    if (openBtn) openBtn.addEventListener('click', function () { setNav(true); });
    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-nav-close]') || e.target.closest('a')) setNav(false);
    });
  }

  /* ---------- lightbox ---------- */

  var lightbox = document.getElementById('lightbox');
  var lightboxImg = lightbox && lightbox.querySelector('img');
  var lightboxCaption = lightbox && lightbox.querySelector('.lightbox__caption');

  function setLightbox(img) {
    if (!lightbox) return;
    if (img) {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxCaption.textContent = img.alt;
    }
    lightbox.classList.toggle('is-open', Boolean(img));
    document.body.classList.toggle('is-locked', Boolean(img));
  }

  if (lightbox) {
    lightbox.removeAttribute('hidden');
    lightbox.addEventListener('click', function () { setLightbox(null); });
    document.querySelectorAll('[data-lightbox] .frame').forEach(function (frame) {
      frame.addEventListener('click', function () { setLightbox(frame.querySelector('img')); });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    setLightbox(null);
    setNav(false);
  });

  /* ---------- dead demo links ---------- */

  document.addEventListener('click', function (e) {
    var demo = e.target.closest('[data-demo]');
    if (!demo) return;
    e.preventDefault();
    toast('Demo site — ' + (demo.textContent.trim() || 'this link') + ' goes nowhere.');
  });

  /* ---------- reveal on scroll ---------- */

  var revealables = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    revealables.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- ?selftest=1 ---------- */

  if (new URLSearchParams(location.search).get('selftest') !== '1') return;

  window.addEventListener('load', function () {
    var fails = [];
    function check(name, ok) { if (!ok) fails.push(name); }

    document.querySelectorAll('main img, footer img').forEach(function (img) {
      check('alt missing: ' + img.getAttribute('src'), img.alt.trim().length > 8);
      check('broken image: ' + img.getAttribute('src'), !img.complete || img.naturalWidth > 0); // lazy images may not have started yet
    });

    if (overlay) {
      setNav(true);
      check('overlay opens', overlay.classList.contains('is-open'));
      setNav(false);
      check('overlay closes', !overlay.classList.contains('is-open'));
      check('body unlocked', !document.body.classList.contains('is-locked'));
    }

    var frame = document.querySelector('[data-lightbox] .frame');
    if (frame) {
      frame.click();
      check('lightbox opens', lightbox.classList.contains('is-open'));
      check('lightbox has a source', Boolean(lightboxImg.src));
      setLightbox(null);
      check('lightbox closes', !lightbox.classList.contains('is-open'));
    }

    var demo = document.querySelector('[data-demo]');
    if (demo) {
      demo.click();
      check('demo link toasts', toastEl.classList.contains('is-visible'));
      toastEl.classList.remove('is-visible');
    }

    check('no cart left behind', !document.querySelector('[class*="cart"], [id*="cart"]'));
    check('no forms left behind', document.querySelectorAll('form').length === 0);

    var report = fails.length ? 'SELFTEST FAILED:\n- ' + fails.join('\n- ') : 'SELFTEST PASSED';
    console.log(report);
    toast(fails.length ? fails.length + ' selftest failure(s) — see console' : 'Selftest passed');
    document.title = (fails.length ? '[FAIL] ' : '[PASS] ') + document.title;
  });
})();
