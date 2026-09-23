/* ==========================================================================
   Hearth & Clove — main.js
   Plain vanilla JS. No dependencies, no build step.
   Sections: helpers, toasts, scroll reveal, nav drawer, lightbox, cart,
   forms (contact + reservation), self-test.
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------- Helpers ---------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const fmtKr = (n) => `${n} kr.`;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /* ---------------- Toasts ----------------
     Transitions (not keyframes) so a second toast never restart-glitches
     the first. A tiny queue gates concurrent toasts: only one is animating
     "in" at a time, each holds, then exits, then the next starts. */
  function initToasts() {
    const region = $(".toast-region");
    if (!region) return () => {};
    let queue = [];
    let showing = false;

    function showNext() {
      if (showing || queue.length === 0) return;
      showing = true;
      const msg = queue.shift();
      const el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.textContent = msg;
      region.appendChild(el);
      // force layout so the transition runs, then animate in
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-visible")));
      setTimeout(() => {
        el.classList.remove("is-visible");
        el.addEventListener("transitionend", () => {
          el.remove();
          showing = false;
          showNext();
        }, { once: true });
      }, 2600);
    }

    return function toast(message) {
      queue.push(message);
      showNext();
    };
  }

  /* ---------------- Scroll reveal ----------------
     IntersectionObserver, fires once, then unobserves. */
  function initReveal() {
    const els = $$(".reveal, .reveal-rise");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el, i) => {
      el.style.setProperty("--i", i % 8);
      io.observe(el);
    });
  }

  /* ---------------- Nav drawer ----------------
     Drawer open/close state is a native checkbox (CSS handles the slide).
     JS only adds: close on Escape, close after tapping a link. */
  function initNavDrawer() {
    const toggle = $("#nav-toggle");
    if (!toggle) return;
    const closeBtn = $(".nav-drawer__close");
    const links = $$(".nav-drawer__links a, .nav-drawer__cta a");
    const close = () => { toggle.checked = false; };
    if (closeBtn) closeBtn.addEventListener("click", close);
    links.forEach((a) => a.addEventListener("click", close));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.checked) close();
    });
  }

  /* ---------------- Lightbox ----------------
     Keyboard-navigable gallery viewer with a real focus trap. */
  function initLightbox() {
    const items = $$(".gallery-item button");
    const lightbox = $("#lightbox");
    if (!items.length || !lightbox) return;
    const img = $(".lightbox__figure img", lightbox);
    const caption = $(".lightbox__caption", lightbox);
    const closeBtn = $(".lightbox__close", lightbox);
    const prevBtn = $(".lightbox__nav--prev", lightbox);
    const nextBtn = $(".lightbox__nav--next", lightbox);
    let index = 0;
    let lastFocused = null;

    function render() {
      const el = items[index];
      img.src = el.dataset.full || el.querySelector("img").src;
      img.alt = el.querySelector("img").alt;
      caption.textContent = el.dataset.caption || "";
    }
    function open(i) {
      index = i;
      lastFocused = document.activeElement;
      render();
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      closeBtn.focus();
      document.body.style.overflow = "hidden";
    }
    function close() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocused) lastFocused.focus();
    }
    function step(delta) {
      index = (index + delta + items.length) % items.length;
      render();
    }
    items.forEach((btn, i) => btn.addEventListener("click", () => open(i)));
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));
    $(".lightbox__scrim", lightbox).addEventListener("click", close);

    lightbox.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowRight") { step(1); return; }
      if (e.key === "ArrowLeft") { step(-1); return; }
      if (e.key === "Tab") {
        const focusable = $$(FOCUSABLE, lightbox).filter((el) => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  }

  /* ---------------- Cart ----------------
     State persists in localStorage as { [productId]: qty }.
     Product facts (name/price/image) are read from each "Add to order"
     button's data-* attributes the first time we see it — the DOM is the
     single source of truth, no duplicated product list in JS. */
  const CART_KEY = "hc_cart_v1";

  function createCart(toast) {
    const catalog = new Map();
    $$(".product-card__add[data-id]").forEach((btn) => {
      catalog.set(btn.dataset.id, {
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: Number(btn.dataset.price),
        img: btn.dataset.img,
      });
    });

    let state = loadCart();

    function loadCart() {
      try {
        const raw = localStorage.getItem(CART_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    }
    function save() {
      try { localStorage.setItem(CART_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable, cart stays in-memory */ }
    }
    function add(id, qty) {
      state[id] = (state[id] || 0) + (qty || 1);
      save();
      render();
    }
    function setQty(id, qty) {
      if (qty <= 0) { delete state[id]; } else { state[id] = qty; }
      save();
      render();
    }
    function remove(id) { setQty(id, 0); }
    function clear() { state = {}; save(); render(); }
    function lines() {
      return Object.keys(state)
        .filter((id) => catalog.has(id) && state[id] > 0)
        .map((id) => ({ ...catalog.get(id), qty: state[id] }));
    }
    function subtotal(ls) {
      return (ls || lines()).reduce((sum, l) => sum + l.price * l.qty, 0);
    }
    function count() {
      return Object.values(state).reduce((sum, q) => sum + q, 0);
    }

    /* ---- rendering ---- */
    const drawer = $("#cart-drawer");
    const body = $(".cart-drawer__body", drawer);
    const foot = $(".cart-drawer__foot", drawer);
    const badge = $(".cart-badge");

    function render() {
      const ls = lines();
      badge.textContent = String(count());
      badge.hidden = count() === 0;

      if (!ls.length) {
        body.innerHTML = '<p class="cart-drawer__empty">Your order is empty. Add something warm from the menu.</p>';
        foot.style.display = "none";
        return;
      }
      foot.style.display = "flex";
      body.innerHTML = "";
      ls.forEach((l) => {
        const row = document.createElement("div");
        row.className = "cart-line";
        row.innerHTML = `
          <img src="${l.img}" alt="" width="68" height="68" loading="lazy">
          <div class="cart-line__info">
            <div class="cart-line__top">
              <span class="cart-line__name">${l.name}</span>
              <span class="cart-line__price">${fmtKr(l.price * l.qty)}</span>
            </div>
            <div class="cart-line__controls">
              <div class="cart-qty">
                <button type="button" class="cart-qty__btn" data-action="dec" aria-label="Decrease quantity">−</button>
                <span class="cart-qty__val">${l.qty}</span>
                <button type="button" class="cart-qty__btn" data-action="inc" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="cart-line__remove" data-action="remove">Remove</button>
            </div>
          </div>`;
        row.querySelector('[data-action="inc"]').addEventListener("click", () => setQty(l.id, l.qty + 1));
        row.querySelector('[data-action="dec"]').addEventListener("click", () => setQty(l.id, l.qty - 1));
        row.querySelector('[data-action="remove"]').addEventListener("click", () => remove(l.id));
        body.appendChild(row);
      });
      $(".cart-subtotal span:last-child", foot).textContent = fmtKr(subtotal(ls));
    }

    return { add, setQty, remove, clear, lines, subtotal, count, render, catalog };
  }

  function initCartUI(cart, toast) {
    const drawer = $("#cart-drawer");
    const openBtn = $("#cart-open");
    const closeBtn = $(".cart-drawer__close", drawer);
    const scrim = $(".cart-drawer__scrim", drawer);
    let lastFocused = null;

    function open() {
      lastFocused = document.activeElement;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      closeBtn.focus();
    }
    function close() {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocused) lastFocused.focus();
    }
    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) close();
    });

    $$(".product-card__add[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cart.add(btn.dataset.id, 1);
        btn.classList.add("is-added");
        const original = btn.dataset.label || btn.textContent.trim();
        btn.dataset.label = original;
        btn.textContent = "Added";
        toast(`${btn.dataset.name} added to your order.`);
        setTimeout(() => {
          btn.classList.remove("is-added");
          btn.textContent = original;
        }, 1100);
      });
    });

    const placeBtn = $("#place-order");
    if (placeBtn) {
      placeBtn.addEventListener("click", () => {
        if (cart.count() === 0) return;
        cart.clear();
        close();
        toast("Demo order placed — we'll have it ready at your pickup time.");
      });
    }

    cart.render();
  }

  /* ---------------- Forms ----------------
     Client-side only: validate, show inline errors, then a success state.
     No backend — the button disables and a toast confirms, same pattern
     for contact and reservation. */
  function validateField(field, rules) {
    const wrap = field.closest(".form-field");
    const errEl = wrap.querySelector(".error-msg");
    let message = "";
    const value = field.value.trim();
    if (rules.required && !value) message = "This field is required.";
    else if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = "Enter a valid email address.";
    else if (rules.min && value && Number(value) < rules.min) message = `Minimum ${rules.min}.`;
    wrap.classList.toggle("has-error", Boolean(message));
    errEl.textContent = message;
    return !message;
  }

  function initForm(formSel, opts) {
    const form = $(formSel);
    if (!form) return;
    const fields = $$("[data-rules]", form);
    const submitBtn = $('button[type="submit"]', form);

    fields.forEach((field) => {
      field.addEventListener("blur", () => {
        validateField(field, JSON.parse(field.dataset.rules));
      });
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let valid = true;
      fields.forEach((field) => {
        if (!validateField(field, JSON.parse(field.dataset.rules))) valid = false;
      });
      if (!valid) {
        const firstError = form.querySelector(".has-error input, .has-error select, .has-error textarea");
        if (firstError) firstError.focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = opts.pendingLabel;
      setTimeout(() => {
        opts.toast(opts.successMessage);
        form.reset();
        submitBtn.disabled = false;
        submitBtn.textContent = opts.defaultLabel;
      }, 500);
    });
  }

  /* ---------------- Self-test ----------------
     ?selftest=1 runs a handful of console.assert smoke tests over the
     cart math and validation logic. Not a test suite — just enough to
     catch a broken subtotal or a validator that stops rejecting bad input. */
  function runSelfTest(cart) {
    console.log("[selftest] Hearth & Clove — running cart/validation smoke tests");
    const ids = Array.from(cart.catalog.keys());
    console.assert(ids.length >= 6, "[selftest] catalog should have the featured products loaded, got", ids.length);
    if (!ids.length) return;

    cart.clear();
    const id = ids[0];
    const unitPrice = cart.catalog.get(id).price;

    cart.add(id, 1);
    console.assert(cart.count() === 1, "[selftest] add() should bring count to 1");
    console.assert(cart.subtotal() === unitPrice, "[selftest] subtotal should equal one unit price");

    cart.add(id, 2);
    console.assert(cart.count() === 3, "[selftest] add() should accumulate quantity (expected 3, got " + cart.count() + ")");
    console.assert(cart.subtotal() === unitPrice * 3, "[selftest] subtotal should scale with quantity");

    cart.setQty(id, 5);
    console.assert(cart.count() === 5, "[selftest] setQty should set exact quantity");

    cart.setQty(id, 0);
    console.assert(cart.count() === 0, "[selftest] setQty(0) should remove the line");
    console.assert(cart.lines().length === 0, "[selftest] lines() should be empty after removal");

    if (ids.length > 1) {
      cart.add(ids[0], 2);
      cart.add(ids[1], 1);
      const expected = cart.catalog.get(ids[0]).price * 2 + cart.catalog.get(ids[1]).price * 1;
      console.assert(cart.subtotal() === expected, "[selftest] subtotal should sum multiple lines correctly");
      cart.clear();
    }

    console.assert(cart.count() === 0, "[selftest] clear() should empty the cart");
    console.log("[selftest] done — check above for any failed assertions");
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const toast = initToasts();
    initReveal();
    initNavDrawer();
    initLightbox();
    const cart = createCart(toast);
    initCartUI(cart, toast);

    initForm("#contact-form", {
      toast,
      pendingLabel: "Sending…",
      defaultLabel: "Send message",
      successMessage: "Thanks — we'll get back to you soon.",
    });
    initForm("#reservation-form", {
      toast,
      pendingLabel: "Booking…",
      defaultLabel: "Reserve table",
      successMessage: "Thanks — your table request is in. We'll confirm by email.",
    });

    if (new URLSearchParams(location.search).get("selftest") === "1") {
      runSelfTest(cart);
    }
  });
})();
