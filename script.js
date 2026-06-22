// ============ FALLBACK DEMO DATA ============
// Used only when Supabase keys aren't configured yet,
// so the site still looks alive during setup.
const DEMO_PRODUCTS = [
  { id: 'd1', name: 'KZ-01 Classic', spec: '18g · aluminum · silicone grip',
    price: 32, tag: 'BESTSELLER', images: [],
    cap_color: 'linear-gradient(180deg, #00ffd1, #00b894)' },
  { id: 'd2', name: 'KZ Sleek', spec: '15g · low-friction · charge-tuned',
    price: 36, tag: 'NEW', images: [],
    cap_color: 'linear-gradient(180deg, #6e5cff, #4a3fc7)' },
  { id: 'd3', name: 'KZ Heavy', spec: '28g · brass core · sonic-tuned',
    price: 42, tag: 'PRO', images: [],
    cap_color: 'linear-gradient(180deg, #ff2e93, #c01874)' },
  { id: 'd4', name: 'KZ Neon', spec: '17g · glow inserts · LED cap',
    price: 52, tag: 'LIMITED', images: [],
    cap_color: 'linear-gradient(180deg, #f0ff00, #c4d100)' },
  { id: 'd5', name: 'KZ Shadow', spec: '19g · matte black · stealth',
    price: 39, tag: null, images: [],
    cap_color: 'linear-gradient(180deg, #2a2a34, #0a0a14)' },
  { id: 'd6', name: 'KZ Chrome', spec: '20g · mirror finish · titanium tip',
    price: 56, tag: 'PREMIUM', images: [],
    cap_color: 'linear-gradient(180deg, #e8e8ec, #b8b8c0)' },
];

let products = [];

// ============ LOAD PRODUCTS ============
async function loadProducts() {
  if (!window.SUPABASE_CONFIGURED) {
    products = DEMO_PRODUCTS;
    renderProducts();
    return;
  }

  productGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-faint); padding:60px 20px;">Loading pens…</div>`;

  const { data, error } = await window.sb
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    productGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--accent-2); padding:60px 20px;">Couldn't load products. Check console.</div>`;
    return;
  }

  products = data || [];
  if (products.length === 0) {
    productGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-faint); padding:60px 20px;">No pens yet. <a href="admin.html" style="color:var(--accent)">Add some in admin</a>.</div>`;
    return;
  }
  renderProducts();
}

// ============ RENDER PRODUCTS ============
const productGrid = document.getElementById('productGrid');
const shopCount   = document.getElementById('shopCount');

let currentSort = 'default';

function getSortedProducts() {
  const copy = [...products];
  if (currentSort === 'asc')  copy.sort((a, b) => a.price - b.price);
  if (currentSort === 'desc') copy.sort((a, b) => b.price - a.price);
  return copy;
}

// Sort buttons
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentSort = btn.dataset.sort;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts();
  });
});

function renderProducts() {
  const sorted = getSortedProducts();
  if (shopCount) shopCount.textContent = `${sorted.length} pen${sorted.length !== 1 ? 's' : ''}`;
  // swap products for render then restore
  const _orig = products;
  products = sorted;
  productGrid.innerHTML = products.map(p => {
    const firstImage = p.images && p.images.length > 0 ? p.images[0] : null;
    const imageContent = firstImage
      ? `<img src="${firstImage}" alt="${escapeHtml(p.name)}" style="width:100%;height:auto;display:block;border-radius:10px;" />`
      : `<div class="product-pen">
           <div class="p-cap" style="background: ${p.cap_color || 'linear-gradient(180deg,#00ffd1,#00b894)'}"></div>
           <div class="p-body"></div>
           <div class="p-tip"></div>
         </div>`;
    return `
    <article class="product-card" data-id="${p.id}" style="cursor:pointer;">
      <div class="product-img">
        ${p.tag ? `<span class="product-tag">${escapeHtml(p.tag)}</span>` : ''}
        ${imageContent}
      </div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-spec">${escapeHtml(p.spec || '')}</div>
        <div class="product-foot">
          <div class="product-price">$${(p.price || 0).toLocaleString()}</div>
          <button class="add-btn" data-id="${p.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add</span>
          </button>
        </div>
      </div>
    </article>`;
  }).join('');

  products = _orig; // restore original order

  document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      addToCart(btn.dataset.id, btn);
    });
  });

  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', () => openPdp(card.dataset.id));
  });

  attachReveal();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ============ CART ============
const cart = new Map();

const cartBtn = document.getElementById('cartBtn');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const cartClose = document.getElementById('cartClose');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const cartCheckout = document.getElementById('cartCheckout');

function addToCart(id, btn) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  const existing = cart.get(id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.set(id, { ...product, qty: 1 });
  }

  renderCart();
  flyToCart(btn);

  if (btn) {
    btn.classList.add('added');
    const label = btn.querySelector('span');
    const original = label.textContent;
    label.textContent = 'Added';
    setTimeout(() => {
      btn.classList.remove('added');
      label.textContent = original;
    }, 1200);
  }
}

function removeFromCart(id) {
  cart.delete(id);
  renderCart();
}

function updateQty(id, delta) {
  const item = cart.get(id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart.delete(id);
  renderCart();
}

function renderCart() {
  let count = 0;
  let total = 0;
  cart.forEach(item => {
    count += item.qty;
    total += item.qty * item.price;
  });

  cartCount.textContent = count;
  cartTotal.textContent = `$${total.toLocaleString()}`;

  if (cart.size === 0) {
    cartItems.innerHTML = `<div class="cart-empty">Your cart is empty.<br/>Pick a pen — they spin themselves.</div>`;
    cartCheckout.disabled = true;
    cartCheckout.style.opacity = 0.4;
    cartCheckout.style.pointerEvents = 'none';
    return;
  }

  cartCheckout.disabled = false;
  cartCheckout.style.opacity = 1;
  cartCheckout.style.pointerEvents = 'auto';

  cartItems.innerHTML = [...cart.values()].map(item => `
    <div class="cart-item">
      <div class="cart-item-img">${
        item.images && item.images[0]
          ? `<img src="${item.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" />`
          : '✒️'
      }</div>
      <div>
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-price">$${item.price.toLocaleString()}</div>
        <div class="cart-item-qty">
          <button class="qty-btn" data-action="dec" data-id="${item.id}">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${item.id}">+</button>
        </div>
      </div>
      <button class="cart-item-remove" data-id="${item.id}">×</button>
    </div>
  `).join('');

  cartItems.querySelectorAll('.qty-btn').forEach(b => {
    b.addEventListener('click', () => {
      updateQty(b.dataset.id, b.dataset.action === 'inc' ? 1 : -1);
    });
  });
  cartItems.querySelectorAll('.cart-item-remove').forEach(b => {
    b.addEventListener('click', () => removeFromCart(b.dataset.id));
  });
}

function openCart() {
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('cart-open');
}
function closeCart() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('cart-open');
}

cartBtn.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeCart();
});

cartCheckout.addEventListener('click', () => {
  if (cart.size === 0) return;
  openCheckout();
});

function showToast(msg) {}

// ============ FLY TO CART ============
function flyToCart(fromEl) {
  const cartBtn = document.getElementById('cartBtn');
  if (!cartBtn || !fromEl) return;
  const from = fromEl.getBoundingClientRect();
  const to   = cartBtn.getBoundingClientRect();
  const fromX = from.left + from.width  / 2;
  const fromY = from.top  + from.height / 2;
  const toX   = to.left   + to.width    / 2;
  const toY   = to.top    + to.height   / 2;

  const ball = document.createElement('div');
  ball.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:16px;height:16px;border-radius:50%;background:var(--accent);left:${fromX-8}px;top:${fromY-8}px;`;
  document.body.appendChild(ball);

  const duration = 650;
  const start = performance.now();
  const arcH  = -Math.abs(toX - fromX) * 0.5 - 60;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const x = fromX + (toX - fromX) * ease - 8;
    const y = fromY + (toY - fromY) * ease + arcH * 4 * t * (1 - t) - 8;
    ball.style.left    = x + 'px';
    ball.style.top     = y + 'px';
    ball.style.transform = `scale(${1 - t * 0.7})`;
    ball.style.opacity = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    if (t < 1) { requestAnimationFrame(step); }
    else {
      ball.remove();
      cartBtn.classList.add('cart-pop');
      setTimeout(() => cartBtn.classList.remove('cart-pop'), 400);
    }
  }
  requestAnimationFrame(step);
}

// ============ SCROLL REVEAL ============
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = 1;
      entry.target.style.transform = 'translateY(0)';
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

function attachReveal() {
  document.querySelectorAll('.product-card, .tech-card, .trick-card, .section-head').forEach((el, i) => {
    if (el.dataset.revealed) return;
    el.dataset.revealed = '1';
    el.style.opacity = 0;
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.6s ease ${i * 0.05}s, transform 0.6s ease ${i * 0.05}s`;
    io.observe(el);
  });
}

// ============ PRODUCT DETAIL MODAL (PDP) ============
const pdpOverlay = document.getElementById('pdpOverlay');
const pdpClose   = document.getElementById('pdpClose');
const pdpMainImg = document.getElementById('pdpMainImg');
const pdpThumbs  = document.getElementById('pdpThumbs');
const pdpTag     = document.getElementById('pdpTag');
const pdpName    = document.getElementById('pdpName');
const pdpSpec    = document.getElementById('pdpSpec');
const pdpPrice   = document.getElementById('pdpPrice');
const pdpDesc    = document.getElementById('pdpDesc');
const pdpQty     = document.getElementById('pdpQty');
const pdpDec     = document.getElementById('pdpDec');
const pdpInc     = document.getElementById('pdpInc');
const pdpAdd     = document.getElementById('pdpAdd');

let pdpProduct = null;
let pdpQuantity = 1;

function openPdp(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;
  pdpProduct = product;
  pdpQuantity = 1;

  if (product.tag) {
    pdpTag.textContent = product.tag;
    pdpTag.hidden = false;
  } else {
    pdpTag.hidden = true;
  }

  pdpName.textContent  = product.name;
  pdpSpec.textContent  = product.spec || '';
  pdpPrice.textContent = `$${(product.price || 0).toLocaleString()}`;
  pdpDesc.textContent  = product.description ||
    'A balanced, modded spinning pen — hand-tested before shipping.';
  pdpQty.textContent   = pdpQuantity;

  const imgs = (product.images && product.images.length) ? product.images : [];
  renderPdpGallery(imgs, 0, product);

  pdpOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePdp() {
  pdpOverlay.hidden = true;
  document.body.style.overflow = '';
  pdpProduct = null;
}

function renderPdpGallery(imgs, activeIndex, product) {
  if (imgs.length === 0) {
    pdpMainImg.innerHTML = `
      <div class="placeholder-pen">
        <div class="p-cap" style="background: ${product.cap_color || 'linear-gradient(180deg,#00ffd1,#00b894)'}"></div>
        <div class="p-body"></div>
        <div class="p-tip"></div>
      </div>`;
    pdpThumbs.innerHTML = '';
    return;
  }

  pdpMainImg.innerHTML = `<img src="${escapeHtml(imgs[activeIndex])}" alt="${escapeHtml(product.name)}" />`;

  if (imgs.length > 1) {
    pdpThumbs.innerHTML = imgs.map((url, i) => `
      <button class="pdp-thumb ${i === activeIndex ? 'active' : ''}" data-i="${i}" type="button">
        <img src="${escapeHtml(url)}" alt="" />
      </button>
    `).join('');
    pdpThumbs.querySelectorAll('.pdp-thumb').forEach(t =>
      t.addEventListener('click', () => renderPdpGallery(imgs, +t.dataset.i, product)));
  } else {
    pdpThumbs.innerHTML = '';
  }
}

pdpClose.addEventListener('click', closePdp);
pdpOverlay.addEventListener('click', e => {
  if (e.target === pdpOverlay) closePdp();
});

pdpDec.addEventListener('click', () => {
  if (pdpQuantity > 1) {
    pdpQuantity--;
    pdpQty.textContent = pdpQuantity;
  }
});
pdpInc.addEventListener('click', () => {
  pdpQuantity++;
  pdpQty.textContent = pdpQuantity;
});

pdpAdd.addEventListener('click', () => {
  if (!pdpProduct) return;
  for (let i = 0; i < pdpQuantity; i++) addToCart(pdpProduct.id);
  flyToCart(pdpAdd);
  closePdp();
});

// ============ ORDER MESSAGE BUILDER (for Messenger handoff) ============
function buildOrderMessage({ name, contact, address, shipping, items, subtotal, notes }) {
  const shop = (window.SHOP_NAME || 'NEW ORDER').toUpperCase();
  const lines = [
    `🛍 ${shop} — NEW ORDER`,
    '',
    `👤 ${name}`,
    `📞 ${contact}`,
    `📍 ${address}`,
    '',
    `📦 Shipping: ${shipping}`,
    '',
    '🖊 Items:',
    ...items.map(i => `• ${i.name} × ${i.qty} — $${(i.qty * i.price).toLocaleString()}`),
    '',
    `💰 Total: $${subtotal.toLocaleString()}`,
  ];
  if (notes) {
    lines.push('', `📝 Notes: ${notes}`);
  }
  return lines.join('\n');
}

// ============ CHECKOUT MODAL ============
const checkoutOverlay = document.getElementById('checkoutOverlay');
const checkoutClose   = document.getElementById('checkoutClose');
const checkoutBack    = document.getElementById('checkoutBack');
const checkoutSubmit  = document.getElementById('checkoutSubmit');
const checkoutSummary = document.getElementById('checkoutSummary');
const checkoutError   = document.getElementById('checkoutError');
const coName     = document.getElementById('coName');
const coContact  = document.getElementById('coContact');
const coAddress  = document.getElementById('coAddress');
const coShipOther = document.getElementById('coShipOther');
const coNotes    = document.getElementById('coNotes');
const shipOptions   = document.getElementById('shipOptions');
const shipOtherWrap = document.getElementById('shipOtherWrap');
const shipAvailNote = document.getElementById('shipAvailNote');

// Cambodia is UTC+7. Returns true if Grab/Direct delivery is available right now.
function isLocalDeliveryAvailable() {
  const now = new Date();
  const phnom = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' }));
  const day = phnom.getDay(); // 0=Sun, 6=Sat
  const h = phnom.getHours();
  const m = phnom.getMinutes();
  const isWeekend = day === 0 || day === 6;
  const afterHalf5 = h > 17 || (h === 17 && m >= 30);
  return isWeekend || afterHalf5;
}

function openCheckout() {
  if (cart.size === 0) return;
  closeCart();
  const first = shipOptions.querySelector('input[name="ship"]');
  if (first) first.checked = true;
  shipOtherWrap.hidden = true;
  shipAvailNote.hidden = true;
  renderCheckoutSummary(first ? first.value : null);
  checkoutError.textContent = '';
  checkoutOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => coName.focus(), 100);
}

function closeCheckout() {
  checkoutOverlay.hidden = true;
  document.body.style.overflow = '';
}

const SHIPPING_FEES = {
  'Virak Buntham': 2,
  'J&T':           2,
};

function getShippingFee(method) {
  return SHIPPING_FEES[method] ?? null; // null = varies/unknown
}

function renderCheckoutSummary(shippingMethod) {
  const items = [...cart.values()];
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const fee = shippingMethod ? getShippingFee(shippingMethod) : null;
  const total = fee !== null ? subtotal + fee : subtotal;

  const shippingRow = fee !== null
    ? `<div class="checkout-summary-row">
         <span>Shipping</span>
         <span>$${fee.toLocaleString()}</span>
       </div>`
    : fee === null && shippingMethod && shippingMethod !== 'Virak Buntham' && shippingMethod !== 'J&T'
      ? `<div class="checkout-summary-row">
           <span>Shipping</span>
           <span style="color:var(--text-dim);font-size:12px;">TBD · varies by location</span>
         </div>`
      : '';

  checkoutSummary.innerHTML = `
    ${items.map(i => `
      <div class="checkout-summary-row">
        <span>${escapeHtml(i.name)} × ${i.qty}</span>
        <span>$${(i.qty * i.price).toLocaleString()}</span>
      </div>
    `).join('')}
    <div class="checkout-summary-row subtotal-row">
      <span>Products</span>
      <span>$${subtotal.toLocaleString()}</span>
    </div>
    ${shippingRow}
    <div class="checkout-summary-row total">
      <span>Total</span>
      <span>$${total.toLocaleString()}${fee === null && shippingMethod ? ' + shipping' : ''}</span>
    </div>
  `;
}

shipOptions.addEventListener('change', () => {
  const selected = shipOptions.querySelector('input[name="ship"]:checked');
  if (!selected) return;
  const isLocal = selected.value === 'Grab' || selected.value === 'Direct';

  if (selected.value === '__other__') {
    shipOtherWrap.hidden = false;
    coShipOther.required = true;
    setTimeout(() => coShipOther.focus(), 50);
  } else {
    shipOtherWrap.hidden = true;
    coShipOther.required = false;
  }

  if (isLocal) {
    const avail = isLocalDeliveryAvailable();
    shipAvailNote.hidden = false;
    shipAvailNote.className = 'ship-avail-note ' + (avail ? 'avail-ok' : 'avail-warn');
    shipAvailNote.textContent = avail
      ? '✓ Available now · Weekdays from 5:30 PM, Saturday & Sunday anytime · Phnom Penh area only · Shipping fee depends on your location.'
      : '⚠ Not available right now · Available weekdays from 5:30 PM, Saturday & Sunday anytime · Phnom Penh area only · Shipping fee depends on your location.';
  } else {
    shipAvailNote.hidden = true;
  }

  renderCheckoutSummary(selected.value);
});

checkoutClose.addEventListener('click', closeCheckout);
checkoutBack.addEventListener('click', () => {
  closeCheckout();
  openCart();
});
checkoutOverlay.addEventListener('click', e => {
  if (e.target === checkoutOverlay) closeCheckout();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!checkoutOverlay.hidden) closeCheckout();
  else if (!pdpOverlay.hidden) closePdp();
});

checkoutSubmit.addEventListener('click', async () => {
  checkoutError.textContent = '';

  const name    = coName.value.trim();
  const contact = coContact.value.trim();
  const address = coAddress.value.trim();
  const shipChoice = shipOptions.querySelector('input[name="ship"]:checked');

  if (!name)    { checkoutError.textContent = 'Please enter your name.';    coName.focus();    return; }
  if (!contact) { checkoutError.textContent = 'Phone or Telegram is required.'; coContact.focus(); return; }
  if (!address) { checkoutError.textContent = 'Delivery address is required.';  coAddress.focus(); return; }
  if (!shipChoice) { checkoutError.textContent = 'Pick a shipping option.'; return; }

  let shippingMethod = shipChoice.value;
  if (shippingMethod === '__other__') {
    shippingMethod = coShipOther.value.trim();
    if (!shippingMethod) {
      checkoutError.textContent = 'Please specify the carrier name.';
      coShipOther.focus();
      return;
    }
  }

  const items = [...cart.values()].map(i => ({
    id: i.id, name: i.name, price: i.price, qty: i.qty
  }));
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const shippingFee = getShippingFee(shippingMethod) ?? 0;
  const grandTotal = subtotal + shippingFee;
  const notesValue = coNotes.value.trim();

  checkoutSubmit.disabled = true;
  checkoutSubmit.querySelector('span').textContent = 'Placing order…';

  const savedOrderId = crypto.randomUUID();

  if (window.SUPABASE_CONFIGURED) {
    const { error } = await window.sb.from('orders').insert({
      id:              savedOrderId,
      customer_name:   name,
      contact:         contact,
      address:         address,
      shipping_method: shippingMethod,
      items:           items,
      subtotal:        subtotal,
      shipping_fee:    shippingFee,
      notes:           notesValue || null,
      status:          'awaiting_payment',
    });

    if (error) {
      console.error('Order failed:', error);
      checkoutError.textContent = `Order failed: ${error.message}`;
      checkoutSubmit.disabled = false;
      checkoutSubmit.querySelector('span').textContent = 'Place order';
      return;
    }
  }

  // Reset form
  coName.value = '';
  coContact.value = '';
  coAddress.value = '';
  coNotes.value = '';
  coShipOther.value = '';
  shipAvailNote.hidden = true;
  shipOtherWrap.hidden = true;
  const first = shipOptions.querySelector('input[name="ship"]');
  if (first) first.checked = true;
  checkoutSubmit.disabled = false;
  checkoutSubmit.querySelector('span').textContent = 'Place order';

  closeCheckout();
  openPaymentModal(savedOrderId, grandTotal);
});

// ============ PAYMENT MODAL ============
const ABA_PAYWAY_URL = 'https://link.payway.com.kh/wS464008C';

const paymentOverlay  = document.getElementById('paymentOverlay');
const paymentAmountLabel = document.getElementById('paymentAmountLabel');
const paymentScreenshot  = document.getElementById('paymentScreenshot');
const paymentUploadLabel = document.getElementById('paymentUploadLabel');
const paymentUploadText  = document.getElementById('paymentUploadText');
const paymentPreview     = document.getElementById('paymentPreview');
const paymentError       = document.getElementById('paymentError');
const paymentSubmit      = document.getElementById('paymentSubmit');

let _pendingOrderId = null;

function openPaymentModal(orderId, subtotal) {
  _pendingOrderId = orderId;
  paymentAmountLabel.textContent = `Amount: $${subtotal.toLocaleString()} · ABA PayWay`;
  paymentError.textContent = '';
  paymentPreview.hidden = true;
  paymentPreview.src = '';
  paymentUploadText.textContent = 'Choose screenshot';
  paymentScreenshot.value = '';
  paymentSubmit.disabled = true;
  paymentOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
  paymentOverlay.hidden = true;
  document.body.style.overflow = '';
}

// Preview selected screenshot
paymentScreenshot.addEventListener('change', () => {
  const file = paymentScreenshot.files[0];
  if (!file) return;
  paymentUploadText.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    paymentPreview.src = e.target.result;
    paymentPreview.hidden = false;
  };
  reader.readAsDataURL(file);
  paymentSubmit.disabled = false;
});

paymentSubmit.addEventListener('click', async () => {
  const file = paymentScreenshot.files[0];
  if (!file) { paymentError.textContent = 'Please choose your payment screenshot.'; return; }

  paymentError.textContent = '';
  paymentSubmit.disabled = true;
  paymentSubmit.querySelector('span').textContent = 'Uploading…';

  try {
    let screenshotUrl = '(no-storage)';

    if (window.SUPABASE_CONFIGURED) {
      const ext = file.name.split('.').pop();
      const path = `${_pendingOrderId || Date.now()}-${Date.now()}.${ext}`;

      const { error: upErr } = await window.sb.storage
        .from('payment-screenshots')
        .upload(path, file, { upsert: false });

      if (upErr) throw upErr;

      const { data: urlData } = window.sb.storage
        .from('payment-screenshots')
        .getPublicUrl(path);

      screenshotUrl = urlData.publicUrl;

      // Save to payments table
      const { error: payErr } = await window.sb.from('payments').insert({
        order_id:       _pendingOrderId,
        screenshot_url: screenshotUrl,
      });
      if (payErr) throw payErr;
    }

    // Save order reference to localStorage for tracking
    try {
      const saved = JSON.parse(localStorage.getItem('kz_orders') || '[]');
      if (!saved.includes(_pendingOrderId)) {
        saved.unshift(_pendingOrderId);
        localStorage.setItem('kz_orders', JSON.stringify(saved.slice(0, 10)));
      }
    } catch(_) {}

    // Clear cart now that payment proof submitted
    cart.clear();
    renderCart();

    closePaymentModal();
    showToast('Payment proof submitted — track your order with the Track button ✓');
  } catch (err) {
    console.error('Payment upload failed:', err);
    paymentError.textContent = `Upload failed: ${err.message}`;
    paymentSubmit.disabled = false;
    paymentSubmit.querySelector('span').textContent = 'Submit payment proof';
  }
});

// ============ CUSTOM HOMEPAGE BLOCKS ============
async function loadBlocks() {
  if (!window.SUPABASE_CONFIGURED) return;
  const { data, error } = await window.sb
    .from('homepage_blocks')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('homepage_blocks load failed:', error.message);
    return;
  }

  const section = document.getElementById('blocks');
  const wrap    = document.getElementById('blocksWrap');
  if (!data || data.length === 0) {
    section.hidden = true;
    return;
  }

  wrap.innerHTML = data.map(b => {
    const hasImage = !!b.image_url;
    const body = b.body ? sanitizeHTML(b.body) : '';
    const cta  = b.cta_label && b.cta_url ? `
      <a href="${escapeHtml(b.cta_url)}" class="block-cta" ${/^https?:/i.test(b.cta_url) ? 'target="_blank" rel="noopener noreferrer"' : ''}>
        <span>${escapeHtml(b.cta_label)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </a>` : '';

    return `
      <article class="block-card ${hasImage ? 'with-image' : ''}">
        <div class="block-content">
          ${b.heading ? `<h2 class="block-heading">${escapeHtml(b.heading)}</h2>` : ''}
          <div class="block-body">${body}</div>
          ${cta}
        </div>
        ${hasImage ? `<div class="block-image"><img src="${escapeHtml(b.image_url)}" alt="${escapeHtml(b.heading || '')}" /></div>` : ''}
      </article>
    `;
  }).join('');

  section.hidden = false;
}

// ============ INLINE CONTENT EDITING ============
// Loads editable text from Supabase, applies it to [data-edit-key] elements,
// and shows an inline editor bar if an admin is logged in.

const editBar         = document.getElementById('editBar');
const toggleEditBtn   = document.getElementById('toggleEditBtn');
const toggleEditLabel = document.getElementById('toggleEditLabel');
const editBarLogout   = document.getElementById('editBarLogout');
const editBarLabel    = document.getElementById('editBarLabel');

let editMode = false;
let dirty = new Map();      // key -> latest pending value
let saveTimer = null;

async function loadSiteContent() {
  if (!window.SUPABASE_CONFIGURED) return;
  const { data, error } = await window.sb.from('site_content').select('*');
  if (error) {
    console.warn('site_content load failed:', error.message);
    return;
  }
  const map = new Map((data || []).map(r => [r.key, r.value]));
  document.querySelectorAll('[data-edit-key]').forEach(el => {
    const v = map.get(el.dataset.editKey);
    if (v !== undefined && v !== null) el.innerHTML = sanitizeHTML(v);
  });
  refreshOptionalSlots();
}

// ============ DYNAMIC TEXT BLOCKS ============
// Admin can insert new editable text below any existing editable element.
// Stored in dynamic_blocks table, anchored to a data-edit-key.
async function loadDynamicBlocks() {
  if (!window.SUPABASE_CONFIGURED) return;
  const { data, error } = await window.sb
    .from('dynamic_blocks')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.warn('dynamic_blocks load failed:', error.message);
    return;
  }

  // Group by anchor_key
  const byAnchor = new Map();
  (data || []).forEach(b => {
    if (!byAnchor.has(b.anchor_key)) byAnchor.set(b.anchor_key, []);
    byAnchor.get(b.anchor_key).push(b);
  });

  // Insert each dynamic block after its anchor element
  byAnchor.forEach((blocks, anchorKey) => {
    const anchor = document.querySelector(`[data-edit-key="${CSS.escape(anchorKey)}"]`);
    if (!anchor) return; // anchor was removed from HTML
    let prev = anchor;
    blocks.forEach(b => {
      const el = createDynamicBlockElement(b);
      prev.after(el);
      prev = el;
    });
  });
}

function createDynamicBlockElement(block) {
  const el = document.createElement('div');
  el.className = 'dynamic-block';
  el.dataset.dynamicId = block.id;
  el.dataset.editKey   = `dyn.${block.id}`;
  el.innerHTML = sanitizeHTML(block.content || '');
  return el;
}

async function insertDynamicBlock(anchorEl) {
  const anchorKey = anchorEl.dataset.editKey;
  if (!anchorKey) return;

  // Find sort_order: place after any existing dynamic blocks anchored here
  let sort_order = 0;
  let lastSibling = anchorEl;
  while (lastSibling.nextElementSibling &&
         lastSibling.nextElementSibling.classList.contains('dynamic-block') &&
         lastSibling.nextElementSibling.dataset.dynamicAnchor === anchorKey) {
    lastSibling = lastSibling.nextElementSibling;
    sort_order++;
  }

  const { data, error } = await window.sb
    .from('dynamic_blocks')
    .insert({ anchor_key: anchorKey, sort_order, content: '' })
    .select()
    .single();

  if (error) {
    showToast(`Insert failed: ${error.message}`);
    return;
  }

  const el = createDynamicBlockElement(data);
  el.dataset.dynamicAnchor = anchorKey;
  lastSibling.after(el);

  // Make it editable immediately and focus
  if (editMode) {
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.addEventListener('blur', handleDynamicBlur);
    el.addEventListener('keydown', handleEditKey);
    setTimeout(() => el.focus(), 30);
  }

  attachDynamicChrome(el);
  showToast('Block added — type to fill it');
}

async function deleteDynamicBlock(el) {
  const id = el.dataset.dynamicId;
  if (!id) return;
  if (!confirm('Remove this text block?')) return;

  const { error } = await window.sb.from('dynamic_blocks').delete().eq('id', id);
  if (error) {
    showToast(`Delete failed: ${error.message}`);
    return;
  }
  el.remove();
  showToast('Block removed');
}

async function handleDynamicBlur(e) {
  const el = e.currentTarget;
  const id = el.dataset.dynamicId;
  if (!id) return;
  const value = sanitizeHTML(el.innerHTML).trim();
  el.innerHTML = value;
  const { error } = await window.sb
    .from('dynamic_blocks')
    .update({ content: value })
    .eq('id', id);
  if (error) {
    showToast(`Save failed: ${error.message}`);
  } else {
    showToast('Saved ✓');
  }
}

// Adds the floating "+ Add text" and "×" chrome to editable elements in edit mode.
function attachDynamicChrome(el) {
  if (el._chromeAttached) return;
  el._chromeAttached = true;

  // "+ Add text below" button — only on real edit-keys, not on dyn.xxx
  if (!el.dataset.editKey.startsWith('dyn.')) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'dyn-add-btn';
    addBtn.title = 'Add a new text block here';
    addBtn.innerHTML = '<span>+ Add text below</span>';
    addBtn.addEventListener('mousedown', e => e.preventDefault());
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      insertDynamicBlock(el);
    });
    el._addBtn = addBtn;
    el.parentNode.insertBefore(addBtn, el.nextSibling);
  }

  // "×" delete button — only on dynamic blocks
  if (el.classList.contains('dynamic-block')) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'dyn-del-btn';
    delBtn.title = 'Remove this block';
    delBtn.innerHTML = '×';
    delBtn.addEventListener('mousedown', e => e.preventDefault());
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      deleteDynamicBlock(el);
    });
    el._delBtn = delBtn;
    el.appendChild(delBtn);
  }
}

function detachDynamicChrome(el) {
  if (el._addBtn) { el._addBtn.remove(); el._addBtn = null; }
  if (el._delBtn) { el._delBtn.remove(); el._delBtn = null; }
  el._chromeAttached = false;
}

// Mark optional slots as empty/not so CSS can hide them or show the placeholder.
function refreshOptionalSlots() {
  document.querySelectorAll('.optional-slot[data-edit-key]').forEach(el => {
    const txt = (el.textContent || '').replace(/​/g, '').trim();
    const hasMedia = el.querySelector('img, svg, a');
    el.dataset.empty = (!txt && !hasMedia) ? 'true' : 'false';
  });
}

// ============ HTML SANITIZER ============
// Strict allowlist: keeps only formatting tags + safe attributes.
const ALLOWED_TAGS = new Set(['B', 'I', 'U', 'S', 'STRIKE', 'STRONG', 'EM', 'A', 'SPAN', 'BR', 'FONT']);
const ALLOWED_ATTRS = {
  A:    ['href', 'target', 'rel'],
  SPAN: ['class', 'style'],
  FONT: ['color'],  // execCommand legacy
};
const ALLOWED_CLASSES = new Set([
  'size-s', 'size-l',
  'font-default', 'font-serif', 'font-mono', 'font-display', 'font-hand',
  'gradient-text', 'logo-accent',
]);
const ALLOWED_STYLE_PROPS = ['color', 'font-size', 'font-family', 'background-color'];

function sanitizeHTML(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  cleanNode(root);
  return root.innerHTML;
}

function cleanNode(node) {
  [...node.childNodes].forEach(child => {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const tag = child.tagName;
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: keep its children, drop the tag
      while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
      child.remove();
      return;
    }

    // Strip disallowed attributes
    const allowed = ALLOWED_ATTRS[tag] || [];
    [...child.attributes].forEach(attr => {
      if (!allowed.includes(attr.name)) child.removeAttribute(attr.name);
    });

    // Sanitize href (no javascript: URLs)
    if (tag === 'A') {
      const href = child.getAttribute('href') || '';
      if (/^\s*javascript:/i.test(href)) child.removeAttribute('href');
      // Add rel/target for external links
      if (/^https?:/i.test(href)) {
        child.setAttribute('target', '_blank');
        child.setAttribute('rel', 'noopener noreferrer');
      }
    }

    // Sanitize class list
    if (child.hasAttribute('class')) {
      const cls = child.getAttribute('class').split(/\s+/).filter(c => ALLOWED_CLASSES.has(c));
      if (cls.length) child.setAttribute('class', cls.join(' '));
      else child.removeAttribute('class');
    }

    // Sanitize inline style — keep only allowlisted props
    if (child.hasAttribute('style')) {
      const keep = {};
      ALLOWED_STYLE_PROPS.forEach(p => {
        const v = child.style.getPropertyValue(p);
        if (v) keep[p] = v;
      });
      child.removeAttribute('style');
      Object.entries(keep).forEach(([k, v]) => child.style.setProperty(k, v));
      if (!child.getAttribute('style')) child.removeAttribute('style');
    }

    cleanNode(child);
  });
}

async function checkAdminSession() {
  if (!window.SUPABASE_CONFIGURED) return;
  const { data } = await window.sb.auth.getSession();
  if (data.session) {
    editBar.hidden = false;
    editBarLabel.textContent = data.session.user.email;
  }
}

function setEditMode(on) {
  editMode = on;
  document.body.classList.toggle('edit-mode', on);
  toggleEditLabel.textContent = on ? 'Done editing' : 'Edit text';
  toggleEditBtn.classList.toggle('active', on);

  document.querySelectorAll('[data-edit-key]').forEach(el => {
    const isDynamic = el.classList.contains('dynamic-block');
    if (on) {
      el.contentEditable = 'true';
      el.spellcheck = false;
      el.addEventListener('blur', isDynamic ? handleDynamicBlur : handleEditBlur);
      el.addEventListener('keydown', handleEditKey);
      attachDynamicChrome(el);
    } else {
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur', isDynamic ? handleDynamicBlur : handleEditBlur);
      el.removeEventListener('keydown', handleEditKey);
      detachDynamicChrome(el);
    }
  });

  if (!on) hideFmtToolbar();
  refreshOptionalSlots();
}

function handleEditKey(e) {
  // Escape blurs to commit
  if (e.key === 'Escape') {
    e.currentTarget.blur();
    return;
  }
  // Enter commits for short single-line fields; Shift+Enter adds a line break
  const tag = e.currentTarget.tagName;
  const isShortField = tag === 'SPAN' || tag === 'A' || tag === 'H4' ||
    e.currentTarget.classList.contains('stat-num') ||
    e.currentTarget.classList.contains('stat-label') ||
    e.currentTarget.classList.contains('about-stat-num') ||
    e.currentTarget.classList.contains('about-stat-label');
  if (e.key === 'Enter' && !e.shiftKey && isShortField) {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

function handleEditBlur(e) {
  const el = e.currentTarget;
  const key = el.dataset.editKey;
  if (!key) return;
  let value = sanitizeHTML(el.innerHTML).trim();
  // Treat "<br>" or zero-width chars alone as truly empty for optional slots
  if (el.classList.contains('optional-slot')) {
    const stripped = value.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').replace(/\s+/g, '');
    if (!stripped) value = '';
  }
  // Reapply sanitized HTML so what's saved == what's shown
  el.innerHTML = value;
  dirty.set(key, value);
  scheduleSave();
  refreshOptionalSlots();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDirty, 250);
}

async function flushDirty() {
  if (dirty.size === 0) return;
  const rows = [...dirty.entries()].map(([key, value]) => ({ key, value }));
  dirty.clear();

  const { error } = await window.sb
    .from('site_content')
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    showToast(`Save failed: ${error.message}`);
    console.error(error);
    return;
  }
  showToast(`Saved ${rows.length === 1 ? '1 change' : rows.length + ' changes'} ✓`);
}

// ============ FORMAT TOOLBAR ============
const fmtToolbar    = document.getElementById('fmtToolbar');
const fmtColorInput = document.getElementById('fmtColorInput');
const fmtSwatch     = document.getElementById('fmtSwatch');
let lastSelectionRange = null;

function showFmtToolbar(range) {
  const rect = range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return hideFmtToolbar();

  // Make sure the toolbar can measure itself
  fmtToolbar.hidden = false;
  const tbRect = fmtToolbar.getBoundingClientRect();
  const tbW = tbRect.width || 320;
  const tbH = tbRect.height || 42;

  let top  = window.scrollY + rect.top - tbH - 10;
  let left = window.scrollX + rect.left + rect.width / 2 - tbW / 2;
  // Clamp to viewport
  const minLeft = window.scrollX + 8;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - tbW - 8;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;
  if (top < window.scrollY + 8) {
    // Flip below
    top = window.scrollY + rect.bottom + 10;
  }
  fmtToolbar.style.top  = top + 'px';
  fmtToolbar.style.left = left + 'px';

  updateToolbarState();
}

function hideFmtToolbar() {
  fmtToolbar.hidden = true;
  lastSelectionRange = null;
}

function getEditableAncestor(node) {
  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute && node.hasAttribute('data-edit-key')) {
      return node;
    }
    node = node.parentNode;
  }
  return null;
}

document.addEventListener('selectionchange', () => {
  if (!editMode) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hideFmtToolbar();

  const range = sel.getRangeAt(0);
  const anchorEditable = getEditableAncestor(range.startContainer);
  const focusEditable  = getEditableAncestor(range.endContainer);
  // Hide if selection isn't fully inside one editable element
  if (!anchorEditable || anchorEditable !== focusEditable) return hideFmtToolbar();

  lastSelectionRange = range.cloneRange();
  showFmtToolbar(range);
});

function restoreSelection() {
  if (!lastSelectionRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(lastSelectionRange);
}

function updateToolbarState() {
  fmtToolbar.querySelectorAll('.fmt-btn').forEach(b => {
    const cmd = b.dataset.cmd;
    let active = false;
    try {
      if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') {
        active = document.queryCommandState(cmd);
      }
    } catch {}
    b.classList.toggle('active', active);
  });
}

function applyInlineStyle(prop, value) {
  restoreSelection();
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.setProperty(prop, value);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  // Reselect inside the new span
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
  lastSelectionRange = r.cloneRange();
}

function applySizeClass(cls) {
  restoreSelection();
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.appendChild(range.extractContents());
  range.insertNode(span);
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
  lastSelectionRange = r.cloneRange();
}

function runCommand(cmd) {
  restoreSelection();
  switch (cmd) {
    case 'bold':
    case 'italic':
    case 'underline':
      document.execCommand(cmd, false);
      break;
    case 'strike':
      document.execCommand('strikeThrough', false);
      break;
    case 'size-s': applySizeClass('size-s'); break;
    case 'size-l': applySizeClass('size-l'); break;
    case 'size-reset': applySizeClass(''); break;
    case 'color':
      fmtColorInput.click();
      return; // color input change handler does the work
    case 'link': {
      const url = prompt('Enter URL:', 'https://');
      if (!url) return;
      // Use HTTPS if no scheme
      const safe = /^[a-z]+:/i.test(url) ? url : 'https://' + url;
      document.execCommand('createLink', false, safe);
      break;
    }
    case 'unlink':
      document.execCommand('unlink', false);
      break;
    case 'clear':
      document.execCommand('removeFormat', false);
      document.execCommand('unlink', false);
      // Also strip our size classes from the selection
      if (lastSelectionRange) {
        const container = lastSelectionRange.commonAncestorContainer;
        const root = container.nodeType === Node.ELEMENT_NODE ? container : container.parentNode;
        root.querySelectorAll('.size-s, .size-l').forEach(s => {
          while (s.firstChild) s.parentNode.insertBefore(s.firstChild, s);
          s.remove();
        });
      }
      break;
  }

  // Trigger save by faking a blur on the active editable
  const editable = getEditableAncestor(window.getSelection().anchorNode);
  if (editable) {
    handleEditBlur({ currentTarget: editable });
    // Keep editable focused so user can keep editing
    editable.focus();
  }
  updateToolbarState();
}

fmtToolbar.addEventListener('mousedown', e => {
  // Prevent the toolbar click from blurring the editable
  e.preventDefault();
});
fmtToolbar.addEventListener('click', e => {
  const btn = e.target.closest('.fmt-btn');
  if (!btn) return;
  runCommand(btn.dataset.cmd);
});
// Font family selector
const fmtFont = document.getElementById('fmtFont');
fmtFont.addEventListener('mousedown', e => e.stopPropagation());
fmtFont.addEventListener('change', () => {
  const choice = fmtFont.value;
  fmtFont.value = ''; // reset so the user can re-pick the same option
  if (!choice) return;

  restoreSelection();
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;

  // Strip any existing font-* class from the selection first
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.className = 'font-' + choice;
  span.appendChild(range.extractContents());
  // Unwrap nested font-* spans inside to avoid stacking
  span.querySelectorAll('[class*="font-"]').forEach(inner => {
    if (inner === span) return;
    const keep = [...inner.classList].filter(c => !c.startsWith('font-'));
    if (keep.length) inner.className = keep.join(' ');
    else inner.removeAttribute('class');
  });
  range.insertNode(span);

  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  sel.addRange(r);
  lastSelectionRange = r.cloneRange();

  const editable = getEditableAncestor(window.getSelection().anchorNode);
  if (editable) {
    handleEditBlur({ currentTarget: editable });
    editable.focus();
  }
});

fmtColorInput.addEventListener('input', () => {
  const color = fmtColorInput.value;
  fmtSwatch.style.background = color;
  restoreSelection();
  applyInlineStyle('color', color);
  // Save
  const editable = getEditableAncestor(window.getSelection().anchorNode);
  if (editable) {
    handleEditBlur({ currentTarget: editable });
    editable.focus();
  }
});

// Keyboard shortcuts inside edit mode (Ctrl+B / I / U just work via execCommand,
// but trigger our save logic afterwards).
document.addEventListener('keyup', e => {
  if (!editMode) return;
  if (!e.ctrlKey && !e.metaKey) return;
  if (['b', 'i', 'u'].includes(e.key.toLowerCase())) {
    const editable = getEditableAncestor(window.getSelection().anchorNode);
    if (editable) handleEditBlur({ currentTarget: editable });
  }
});

toggleEditBtn.addEventListener('click', () => setEditMode(!editMode));

editBarLogout.addEventListener('click', async () => {
  await window.sb.auth.signOut();
  setEditMode(false);
  editBar.hidden = true;
  showToast('Signed out');
});

// Keep edit bar in sync if auth state changes (e.g. user logs in via admin.html)
if (window.SUPABASE_CONFIGURED) {
  window.sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      editBar.hidden = false;
      editBarLabel.textContent = session.user.email;
    } else {
      if (editMode) setEditMode(false);
      editBar.hidden = true;
    }
  });
}

// ============ THEME TOGGLE ============
(function () {
  const btn = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  if (!btn) return;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    icon.textContent = theme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('kz-theme', theme);
  }

  // Sync icon with whatever the inline script already set
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current);

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
})();

// ============ ORDER TRACKING ============
const trackOverlay  = document.getElementById('trackOverlay');
const trackClose    = document.getElementById('trackClose');
const trackInput    = document.getElementById('trackInput');
const trackLookupBtn= document.getElementById('trackLookupBtn');
const trackError    = document.getElementById('trackError');
const trackResults  = document.getElementById('trackResults');
const trackOrderList= document.getElementById('trackOrderList');
const trackOrderBtn = document.getElementById('trackOrderBtn');

const STATUS_STEPS = [
  { key: 'awaiting_payment', label: 'Payment sent',     icon: '💳' },
  { key: 'confirmed',        label: 'Payment confirmed', icon: '✅' },
  { key: 'shipped',          label: 'On the way',        icon: '🚚' },
  { key: 'delivered',        label: 'Delivered',         icon: '🎉' },
];

const STATUS_MSG = {
  awaiting_payment: "We've received your order. Payment proof is under review.",
  confirmed:        "Payment confirmed! We're preparing your pen.",
  shipped:          "Your pen is on the way! Check your contact for tracking info.",
  delivered:        "Delivered! Enjoy your pen. 🖊",
  cancelled:        "This order has been cancelled. Contact us for help.",
};

function renderTrackingCard(order) {
  const stepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const date = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const stepsHtml = STATUS_STEPS.map((s, i) => {
    const done    = !isCancelled && i <= stepIndex;
    const current = !isCancelled && i === stepIndex;
    return `<div class="ts-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
      <div class="ts-dot">${done ? s.icon : ''}</div>
      <div class="ts-label">${s.label}</div>
    </div>`;
  }).join('<div class="ts-line"></div>');

  const items = Array.isArray(order.items)
    ? order.items.map(it => `<span class="track-item">${escapeHtml(it.name)} ×${it.qty}</span>`).join('')
    : '';

  return `
  <div class="track-card ${isCancelled ? 'cancelled' : ''}">
    <div class="track-card-head">
      <div>
        <div class="track-order-id">Order #${order.id.slice(0,8).toUpperCase()}</div>
        <div class="track-order-date">${date}</div>
      </div>
      <div class="track-status-badge status-${order.status}">${order.status.replace('_', ' ')}</div>
    </div>
    ${items ? `<div class="track-items">${items}</div>` : ''}
    <div class="track-timeline">${stepsHtml}</div>
    <div class="track-msg ${isCancelled ? 'track-msg-cancel' : ''}">${STATUS_MSG[order.status] || ''}</div>
    <div class="track-total">Total: <strong>$${((order.subtotal || 0) + (order.shipping_fee || 0)).toLocaleString()}</strong>${order.shipping_fee ? ` (incl. $${order.shipping_fee} shipping)` : ''}</div>
  </div>`;
}

async function lookupOrders(contact) {
  if (!window.SUPABASE_CONFIGURED) {
    trackError.textContent = 'Supabase not configured.';
    trackError.hidden = false;
    return;
  }

  trackLookupBtn.disabled = true;
  trackLookupBtn.querySelector('span').textContent = 'Searching…';
  trackError.hidden = true;
  trackResults.hidden = true;

  const { data, error } = await window.sb
    .from('orders')
    .select('*')
    .ilike('contact', `%${contact.trim()}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  trackLookupBtn.disabled = false;
  trackLookupBtn.querySelector('span').textContent = 'Search';

  if (error) {
    trackError.textContent = 'Could not fetch orders. Try again.';
    trackError.hidden = false;
    return;
  }

  if (!data || data.length === 0) {
    trackError.textContent = 'No orders found for that phone / Telegram. Check the number and try again.';
    trackError.hidden = false;
    return;
  }

  trackOrderList.innerHTML = data.map(renderTrackingCard).join('');
  trackResults.hidden = false;
}

async function lookupByIds(ids) {
  if (!window.SUPABASE_CONFIGURED || !ids.length) return;
  const { data } = await window.sb
    .from('orders')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (data && data.length) {
    trackOrderList.innerHTML = data.map(renderTrackingCard).join('');
    trackResults.hidden = false;
  }
}

function openTrackModal() {
  trackOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  trackError.hidden = true;
  trackResults.hidden = true;
  trackOrderList.innerHTML = '';

  // Auto-load from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('kz_orders') || '[]');
    if (saved.length) lookupByIds(saved);
  } catch(_) {}
}

function closeTrackModal() {
  trackOverlay.hidden = true;
  document.body.style.overflow = '';
}

trackOrderBtn.addEventListener('click', openTrackModal);
trackClose.addEventListener('click', closeTrackModal);
trackOverlay.addEventListener('click', e => { if (e.target === trackOverlay) closeTrackModal(); });

trackLookupBtn.addEventListener('click', () => {
  const val = trackInput.value.trim();
  if (!val) { trackError.textContent = 'Please enter your phone or Telegram username.'; trackError.hidden = false; return; }
  lookupOrders(val);
});
trackInput.addEventListener('keydown', e => { if (e.key === 'Enter') trackLookupBtn.click(); });

// ============ INIT ============
(async () => {
  await loadSiteContent();    // base text first, so flash is minimal
  await loadDynamicBlocks();  // insert admin-added text blocks
  loadProducts();
  loadBlocks();
  renderCart();
  attachReveal();
  checkAdminSession();
})();
