/**
 * Heart Break Kids (HBK) Apparel - Master Theme JavaScript
 * Handles AJAX Cart Drawer, Free Shipping Bar, Quick-Add Size, Drawers & Anti-Collision
 */

(function () {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    freeShippingThresholdCents: 7500, // $75.00
    currencySymbol: '$'
  };

  // --- DOM Elements Cache ---
  const DOM = {
    cartDrawer: document.getElementById('HbkCartDrawer'),
    cartBtn: document.getElementById('HbkCartBtn'),
    cartCountBadges: document.querySelectorAll('#HbkCartCount, #HbkDockCartCount, #HbkDrawerCount'),
    cartItemsContainer: document.getElementById('HbkCartItemsContainer'),
    cartSubtotal: document.getElementById('HbkCartSubtotal'),
    shippingMeter: document.getElementById('HbkShippingMeter'),
    shippingText: document.getElementById('HbkShippingText'),
    shippingFill: document.getElementById('HbkShippingFill'),
    mobileDrawer: document.getElementById('HbkMobileDrawer'),
    searchModal: document.getElementById('HbkSearchModal'),
    countdownTimer: document.getElementById('HbkCountdownTimer')
  };

  // --- Helper: Format Money ---
  function formatMoney(cents) {
    return CONFIG.currencySymbol + (cents / 100).toFixed(2);
  }

  // --- Cart Drawer Controller ---
  const CartDrawer = {
    isOpen: false,

    open() {
      if (!DOM.cartDrawer) return;
      DOM.cartDrawer.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.isOpen = true;
    },

    close() {
      if (!DOM.cartDrawer) return;
      DOM.cartDrawer.classList.remove('active');
      document.body.style.overflow = '';
      this.isOpen = false;
    },

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    // Fetch current cart from Shopify Cart API
    async refresh() {
      try {
        const response = await fetch('/cart.js');
        if (!response.ok) return;
        const cart = await response.json();
        this.renderCart(cart);
      } catch (err) {
        console.warn('Shopify Cart API not reachable (local mode fallback):', err);
      }
    },

    // Add item via AJAX
    async addItem(variantId, quantity = 1, extraData = {}) {
      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: variantId, quantity: quantity })
        });

        if (response.ok) {
          await this.refresh();
          this.open();
        } else {
          // Fallback simulation for local preview mode
          this.simulateLocalAdd(extraData, quantity);
          this.open();
        }
      } catch (err) {
        // Fallback simulation for local preview mode
        this.simulateLocalAdd(extraData, quantity);
        this.open();
      }
    },

    // Change quantity of line item
    async changeQuantity(lineKey, delta) {
      try {
        const currentItem = document.querySelector(`.hbk-cart-item[data-key="${lineKey}"]`);
        if (!currentItem) return;
        const qtyEl = currentItem.querySelector('.hbk-qty-val');
        const currentQty = parseInt(qtyEl?.textContent || '1', 10);
        const newQty = Math.max(0, currentQty + delta);

        const response = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lineKey, quantity: newQty })
        });

        if (response.ok) {
          await this.refresh();
        } else {
          this.simulateLocalQtyChange(lineKey, newQty);
        }
      } catch (err) {
        this.simulateLocalQtyChange(lineKey, delta);
      }
    },

    // Update Shipping Meter
    updateShippingMeter(totalCents) {
      if (!DOM.shippingFill || !DOM.shippingText) return;
      const limit = CONFIG.freeShippingThresholdCents;
      const percentage = Math.min(100, Math.round((totalCents / limit) * 100));

      DOM.shippingFill.style.width = `${percentage}%`;

      if (totalCents >= limit) {
        DOM.shippingText.innerHTML = `
          <span class="hbk-shipping-meter__unlocked">
            <span class="hbk-tag hbk-tag--lime">UNLOCKED</span> You earned <strong>FREE Express Shipping</strong>!
          </span>
        `;
      } else {
        const remaining = formatMoney(limit - totalCents);
        DOM.shippingText.innerHTML = `
          <span>Add <strong>${remaining}</strong> more for <strong>FREE Express Shipping</strong>!</span>
        `;
      }
    },

    // Render Cart HTML
    renderCart(cart) {
      // Update badge counts
      DOM.cartCountBadges.forEach(badge => {
        badge.textContent = cart.item_count;
      });

      // Update Subtotal
      if (DOM.cartSubtotal) {
        DOM.cartSubtotal.textContent = formatMoney(cart.total_price);
      }

      // Update Shipping Bar
      this.updateShippingMeter(cart.total_price);

      // Render Items
      if (!DOM.cartItemsContainer) return;

      if (!cart.items || cart.items.length === 0) {
        DOM.cartItemsContainer.innerHTML = `
          <div class="hbk-cart-empty">
            <div class="hbk-cart-empty__icon">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#FF2A4D" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path></svg>
            </div>
            <h4 class="hbk-cart-empty__title">YOUR STASH IS EMPTY</h4>
            <p class="hbk-cart-empty__desc">Don't miss the latest Season 2026 limited monster drops.</p>
            <a href="/collections/all" class="hbk-btn hbk-btn--primary js-toggle-cart">
              EXPLORE NEW DROPS &rarr;
            </a>
          </div>
        `;
        return;
      }

      let itemsHtml = '<div class="hbk-cart-items-list">';
      cart.items.forEach((item, index) => {
        itemsHtml += `
          <div class="hbk-cart-item" data-line="${index + 1}" data-key="${item.key}">
            <div class="hbk-cart-item__media">
              <img src="${item.image}" alt="${item.title}" width="80" height="100">
            </div>
            <div class="hbk-cart-item__details">
              <h4 class="hbk-cart-item__title">
                <a href="${item.url}">${item.product_title || item.title}</a>
              </h4>
              ${item.variant_title ? `<div class="hbk-cart-item__variant">${item.variant_title}</div>` : ''}
              <div class="hbk-cart-item__price">${formatMoney(item.final_line_price || item.price * item.quantity)}</div>
              <div class="hbk-cart-item__actions">
                <div class="hbk-qty-stepper">
                  <button type="button" class="hbk-qty-btn js-qty-change" data-delta="-1" data-key="${item.key}">-</button>
                  <span class="hbk-qty-val">${item.quantity}</span>
                  <button type="button" class="hbk-qty-btn js-qty-change" data-delta="1" data-key="${item.key}">+</button>
                </div>
                <button type="button" class="hbk-cart-item__remove js-remove-item" data-key="${item.key}">REMOVE</button>
              </div>
            </div>
          </div>
        `;
      });
      itemsHtml += '</div>';

      DOM.cartItemsContainer.innerHTML = itemsHtml;
    },

    // Local simulation fallback for interactive previewing
    localCart: { items: [], total_price: 0, item_count: 0 },
    simulateLocalAdd(productData, quantity) {
      const priceCents = Math.round(parseFloat((productData.price || '$35.00').replace(/[^0-9.]/g, '')) * 100);
      const existing = this.localCart.items.find(i => i.product_title === productData.productTitle && i.variant_title === productData.variantTitle);
      
      if (existing) {
        existing.quantity += quantity;
      } else {
        this.localCart.items.push({
          key: 'item_' + Date.now(),
          product_title: productData.productTitle || 'HBK Monster Hoodie',
          variant_title: productData.variantTitle || 'Size L',
          price: priceCents,
          quantity: quantity,
          image: productData.img || 'https://heartbreakkidsli.com/cdn/shop/files/SliderP_7c2ce295-02a4-40e9-a12c-270e279dc7da_1400x.jpg'
        });
      }

      this.recalcLocalCart();
      this.renderCart(this.localCart);
    },

    simulateLocalQtyChange(key, newQtyOrDelta) {
      const item = this.localCart.items.find(i => i.key === key);
      if (!item) return;

      if (typeof newQtyOrDelta === 'number' && newQtyOrDelta <= 0) {
        this.localCart.items = this.localCart.items.filter(i => i.key !== key);
      } else if (typeof newQtyOrDelta === 'number') {
        item.quantity = newQtyOrDelta;
      }

      this.recalcLocalCart();
      this.renderCart(this.localCart);
    },

    recalcLocalCart() {
      let count = 0;
      let total = 0;
      this.localCart.items.forEach(i => {
        count += i.quantity;
        total += i.price * i.quantity;
      });
      this.localCart.item_count = count;
      this.localCart.total_price = total;
    }
  };

  // --- Initial Event Delegations ---
  function initEvents() {
    // 1. Cart Toggle Triggers
    document.addEventListener('click', (e) => {
      if (e.target.closest('.js-toggle-cart')) {
        e.preventDefault();
        CartDrawer.toggle();
      }

      // 2. Mobile Menu Toggle
      if (e.target.closest('.js-toggle-menu')) {
        e.preventDefault();
        if (DOM.mobileDrawer) {
          DOM.mobileDrawer.classList.toggle('active');
        }
      }

      // 3. Search Modal Toggle
      if (e.target.closest('.js-toggle-search')) {
        e.preventDefault();
        if (DOM.searchModal) {
          DOM.searchModal.classList.toggle('active');
          const input = DOM.searchModal.querySelector('.hbk-search-input');
          if (DOM.searchModal.classList.contains('active') && input) {
            setTimeout(() => input.focus(), 150);
          }
        }
      }

      // 4. Quick Add Size Button
      const quickAddBtn = e.target.closest('.js-quick-add');
      if (quickAddBtn) {
        e.preventDefault();
        const variantId = quickAddBtn.dataset.variantId || 'sample_var';
        const productTitle = quickAddBtn.dataset.productTitle || 'HBK Monster Item';
        const variantTitle = quickAddBtn.dataset.variantTitle || quickAddBtn.textContent.trim();
        const price = quickAddBtn.dataset.price || '$35.00';
        const img = quickAddBtn.dataset.img || '';

        // Add subtle animation
        quickAddBtn.style.transform = 'scale(0.92)';
        setTimeout(() => quickAddBtn.style.transform = '', 150);

        CartDrawer.addItem(variantId, 1, { productTitle, variantTitle, price, img });
      }

      // 5. In-Cart Quantity Stepper
      const qtyBtn = e.target.closest('.js-qty-change');
      if (qtyBtn) {
        const delta = parseInt(qtyBtn.dataset.delta || '1', 10);
        const key = qtyBtn.dataset.key;
        CartDrawer.changeQuantity(key, delta);
      }

      // 6. In-Cart Remove Button
      const removeBtn = e.target.closest('.js-remove-item');
      if (removeBtn) {
        const key = removeBtn.dataset.key;
        CartDrawer.changeQuantity(key, 0);
      }

      // 7. In-Cart Upsell Add
      const upsellBtn = e.target.closest('.js-add-upsell');
      if (upsellBtn) {
        e.preventDefault();
        upsellBtn.textContent = 'ADDED ✓';
        upsellBtn.disabled = true;
        CartDrawer.addItem('upsell_stickers', 1, {
          productTitle: 'HBK Die-Cut Sticker Pack',
          variantTitle: 'Pack of 5',
          price: '$8.00',
          img: 'https://heartbreakkidsli.com/cdn/shop/files/ezgif.com-resize_360x.webp'
        });
      }

      // 8. 1-Click Copy Promo Code
      const copyBtn = e.target.closest('.js-copy-code');
      if (copyBtn) {
        const code = copyBtn.dataset.code || 'HBK25';
        navigator.clipboard?.writeText(code).then(() => {
          const textEl = copyBtn.querySelector('.js-copy-text');
          if (textEl) {
            const original = textEl.textContent;
            textEl.textContent = 'COPIED TO CLIPBOARD! ✓';
            setTimeout(() => textEl.textContent = original, 2500);
          }
        });
      }

      // 9. PDP Size Pill Selection
      const sizePill = e.target.closest('.hbk-size-pill');
      if (sizePill && !sizePill.classList.contains('sold-out')) {
        const parent = sizePill.closest('.hbk-size-pills');
        if (parent) {
          parent.querySelectorAll('.hbk-size-pill').forEach(p => p.classList.remove('selected'));
          sizePill.classList.add('selected');
        }
        const variantInput = document.getElementById('HbkVariantId');
        if (variantInput && sizePill.dataset.variantId) {
          variantInput.value = sizePill.dataset.variantId;
        }
      }

      // 10. PDP Image Thumbnail Swap
      const thumbBtn = e.target.closest('.hbk-pdp__thumb-btn');
      if (thumbBtn) {
        const mainImg = document.getElementById('HbkMainProductImg');
        const newSrc = thumbBtn.dataset.imgSrc;
        if (mainImg && newSrc) {
          mainImg.src = newSrc;
          const parent = thumbBtn.closest('.hbk-pdp__thumbs');
          if (parent) {
            parent.querySelectorAll('.hbk-pdp__thumb-btn').forEach(b => b.classList.remove('active'));
            thumbBtn.classList.add('active');
          }
        }
      }

      // 11. Homepage Filter Tabs
      const tabBtn = e.target.closest('.hbk-tab-btn');
      if (tabBtn) {
        const filter = tabBtn.dataset.filter;
        const parent = tabBtn.closest('.hbk-filter-tabs');
        if (parent) {
          parent.querySelectorAll('.hbk-tab-btn').forEach(b => b.classList.remove('active'));
          tabBtn.classList.add('active');
        }

        const cards = document.querySelectorAll('.hbk-card');
        cards.forEach(card => {
          if (filter === 'all') {
            card.style.display = '';
          } else {
            const text = (card.innerText || '').toLowerCase();
            if (text.includes(filter)) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          }
        });
      }
    });

    // Handle PDP Add To Cart Form
    const pdpForm = document.getElementById('HbkAddToCartForm');
    if (pdpForm) {
      pdpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const variantId = document.getElementById('HbkVariantId')?.value || 'pdp_var';
        const qty = parseInt(document.getElementById('HbkPdpQty')?.value || '1', 10);
        const title = document.querySelector('.hbk-pdp__title')?.textContent || 'HBK Drop';
        const price = document.getElementById('HbkPdpPrice')?.textContent || '$35.00';
        const img = document.getElementById('HbkMainProductImg')?.src || '';

        CartDrawer.addItem(variantId, qty, { productTitle: title, variantTitle: 'Standard', price, img });
      });
    }

    // PDP Quantity Buttons
    document.querySelectorAll('.js-pdp-qty-change').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('HbkPdpQty');
        if (!input) return;
        const delta = parseInt(btn.dataset.delta || '1', 10);
        const current = parseInt(input.value || '1', 10);
        input.value = Math.max(1, current + delta);
      });
    });

    // Close on Escape Key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        CartDrawer.close();
        DOM.mobileDrawer?.classList.remove('active');
        DOM.searchModal?.classList.remove('active');
      }
    });
  }

  // --- Drop Countdown Timer ---
  function initCountdown() {
    const hoursEl = document.getElementById('TimerHours');
    const minsEl = document.getElementById('TimerMins');
    const secsEl = document.getElementById('TimerSecs');
    if (!hoursEl || !minsEl || !secsEl) return;

    let totalSeconds = 47 * 3600 + 58 * 60 + 45;

    setInterval(() => {
      if (totalSeconds <= 0) return;
      totalSeconds--;
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      hoursEl.textContent = String(h).padStart(2, '0');
      minsEl.textContent = String(m).padStart(2, '0');
      secsEl.textContent = String(s).padStart(2, '0');
    }, 1000);
  }

  // --- Anti-Collision Watcher for Third-Party Chat/Rewards Widgets ---
  function enforceAntiCollision() {
    const isMobile = window.innerWidth <= 768;
    const selectors = [
      '#shopify-chat',
      'shopify-chat',
      '#dummy-chat-button-iframe',
      '.fera-floating-widget',
      '#privy-container',
      '.klaviyo-form'
    ];

    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        if (isMobile) {
          el.style.setProperty('bottom', '74px', 'important');
        } else {
          el.style.removeProperty('bottom');
        }
      }
    });
  }

  // --- Initialize on DOM Ready ---
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    initCountdown();
    CartDrawer.refresh();
    enforceAntiCollision();
    window.addEventListener('resize', enforceAntiCollision);
  });

})();
