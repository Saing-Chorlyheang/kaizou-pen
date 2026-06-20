// ============ STATE ============
let currentUser = null;
let currentImages = [];     // array of image URLs in the edit modal
let pendingUploads = 0;     // upload counter

// ============ DOM ============
const loginScreen   = document.getElementById('loginScreen');
const adminApp      = document.getElementById('adminApp');
const loginForm     = document.getElementById('loginForm');
const loginEmail    = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError    = document.getElementById('loginError');
const loginSubmit   = document.getElementById('loginSubmit');
const adminEmail    = document.getElementById('adminEmail');
const logoutBtn     = document.getElementById('logoutBtn');
const newProductBtn = document.getElementById('newProductBtn');
const adminTable    = document.getElementById('adminTable');
const productCount  = document.getElementById('productCount');
const configWarning = document.getElementById('configWarning');

const modalOverlay = document.getElementById('modalOverlay');
const modalClose   = document.getElementById('modalClose');
const modalTitle   = document.getElementById('modalTitle');
const productForm  = document.getElementById('productForm');
const cancelBtn    = document.getElementById('cancelBtn');
const saveBtn      = document.getElementById('saveBtn');
const deleteBtn    = document.getElementById('deleteBtn');

const pId          = document.getElementById('pId');
const pName        = document.getElementById('pName');
const pSpec        = document.getElementById('pSpec');
const pDescription = document.getElementById('pDescription');
const pPrice       = document.getElementById('pPrice');
const pTag         = document.getElementById('pTag');
const pCapColor    = document.getElementById('pCapColor');
const pSortOrder   = document.getElementById('pSortOrder');
const pIsActive    = document.getElementById('pIsActive');
const photoGrid    = document.getElementById('photoGrid');
const photoInput   = document.getElementById('photoInput');
const uploadStatus = document.getElementById('uploadStatus');

// ============ HELPERS ============
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ============ CONFIG CHECK ============
if (!window.SUPABASE_CONFIGURED) {
  configWarning.hidden = false;
  loginError.textContent = 'Supabase keys not set — see SETUP.md';
  loginSubmit.disabled = true;
  loginSubmit.style.opacity = 0.5;
}

// ============ AUTH ============
async function checkSession() {
  if (!window.SUPABASE_CONFIGURED) return;
  const { data } = await window.sb.auth.getSession();
  if (data.session) enterApp(data.session.user);
}

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!window.SUPABASE_CONFIGURED) return;

  loginError.textContent = '';
  loginSubmit.disabled = true;
  loginSubmit.querySelector('span').textContent = 'Signing in…';

  const { data, error } = await window.sb.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value,
  });

  loginSubmit.disabled = false;
  loginSubmit.querySelector('span').textContent = 'Sign in';

  if (error) {
    loginError.textContent = error.message;
    return;
  }
  enterApp(data.user);
});

logoutBtn.addEventListener('click', async () => {
  await window.sb.auth.signOut();
  currentUser = null;
  adminApp.hidden = true;
  loginScreen.hidden = false;
  loginEmail.value = '';
  loginPassword.value = '';
});

function enterApp(user) {
  currentUser = user;
  loginScreen.hidden = true;
  adminApp.hidden = false;
  adminEmail.textContent = user.email;
  loadProducts();
  loadBlocks();
}

// ============ TABS ============
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    document.querySelectorAll('.admin-tab-pane').forEach(p => {
      p.hidden = p.dataset.pane !== target;
    });
  });
});

// ============ LOAD / RENDER PRODUCTS ============
async function loadProducts() {
  adminTable.innerHTML = `<div class="admin-empty">Loading…</div>`;

  const { data, error } = await window.sb
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    adminTable.innerHTML = `<div class="admin-empty" style="color:var(--accent-2)">Error: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    adminTable.innerHTML = `<div class="admin-empty">No products yet. Click <strong>New product</strong> to add your first.</div>`;
    productCount.textContent = '';
    return;
  }

  productCount.textContent = `(${data.length})`;

  adminTable.innerHTML = `
    <div class="admin-row header">
      <div></div>
      <div>Name</div>
      <div>Tag</div>
      <div>Price</div>
      <div>Order</div>
      <div>Status</div>
      <div></div>
    </div>
    ${data.map(p => {
      const cover = p.images && p.images[0];
      return `
        <div class="admin-row" data-id="${p.id}">
          <div class="row-thumb">${
            cover
              ? `<img src="${escapeHtml(cover)}" alt="" />`
              : `<span>✒️</span>`
          }</div>
          <div>
            <div class="row-name">${escapeHtml(p.name)}</div>
            <div class="row-spec">${escapeHtml(p.spec || '—')}</div>
          </div>
          <div>${p.tag ? `<span class="row-tag">${escapeHtml(p.tag)}</span>` : '<span style="color:var(--text-faint)">—</span>'}</div>
          <div class="row-price">$${(p.price || 0).toLocaleString()}</div>
          <div style="font-family:var(--font-mono);color:var(--text-dim);">${p.sort_order ?? 0}</div>
          <div><span class="row-status ${p.is_active ? 'active' : 'inactive'}">${p.is_active ? '● Live' : '○ Hidden'}</span></div>
          <div class="row-actions">
            <button class="icon-btn" data-edit="${p.id}" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <button class="icon-btn danger" data-delete="${p.id}" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('')}
  `;

  adminTable.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openEdit(b.dataset.edit, data)));
  adminTable.querySelectorAll('[data-delete]').forEach(b =>
    b.addEventListener('click', () => deleteProduct(b.dataset.delete)));
}

// ============ MODAL: open / close ============
function openModal() {
  modalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = '';
}
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

newProductBtn.addEventListener('click', () => openEdit(null));

// ============ EDIT FORM ============
function openEdit(id, allProducts) {
  currentImages = [];
  uploadStatus.textContent = '';
  productForm.reset();
  pIsActive.checked = true;

  if (!id) {
    modalTitle.textContent = 'New product';
    deleteBtn.hidden = true;
    pId.value = '';
    pSortOrder.value = 0;
    pCapColor.value = 'linear-gradient(180deg, #00ffd1, #00b894)';
    renderPhotos();
    openModal();
    return;
  }

  const product = (allProducts || []).find(p => p.id === id);
  if (!product) return;

  modalTitle.textContent = `Edit · ${product.name}`;
  deleteBtn.hidden = false;
  pId.value          = product.id;
  pName.value        = product.name || '';
  pSpec.value        = product.spec || '';
  pDescription.value = product.description || '';
  pPrice.value       = product.price || 0;
  pTag.value         = product.tag || '';
  pCapColor.value    = product.cap_color || '';
  pSortOrder.value   = product.sort_order ?? 0;
  pIsActive.checked  = product.is_active !== false;
  currentImages      = [...(product.images || [])];
  renderPhotos();
  openModal();
}

function renderPhotos() {
  photoGrid.innerHTML = currentImages.map((url, i) => `
    <div class="photo-tile ${i === 0 ? 'primary' : ''}" data-i="${i}">
      <img src="${escapeHtml(url)}" alt="" />
      <button type="button" class="photo-remove" data-remove="${i}" title="Remove">×</button>
    </div>
  `).join('');

  photoGrid.querySelectorAll('[data-remove]').forEach(b =>
    b.addEventListener('click', () => {
      const i = +b.dataset.remove;
      currentImages.splice(i, 1);
      renderPhotos();
    }));

  // Drag to reorder — first photo is the cover
  photoGrid.querySelectorAll('.photo-tile').forEach(tile => {
    tile.setAttribute('draggable', 'true');
    tile.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', tile.dataset.i);
    });
    tile.addEventListener('dragover', e => e.preventDefault());
    tile.addEventListener('drop', e => {
      e.preventDefault();
      const from = +e.dataTransfer.getData('text/plain');
      const to   = +tile.dataset.i;
      if (from === to) return;
      const [moved] = currentImages.splice(from, 1);
      currentImages.splice(to, 0, moved);
      renderPhotos();
    });
  });
}

// ============ IMAGE UPLOAD ============
photoInput.addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length) return;
  photoInput.value = '';

  for (const file of files) {
    pendingUploads++;
    uploadStatus.textContent = `Uploading ${pendingUploads} file(s)…`;

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;

    const { error } = await window.sb.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '31536000', upsert: false });

    pendingUploads--;

    if (error) {
      uploadStatus.textContent = `Upload failed: ${error.message}`;
      console.error(error);
      continue;
    }

    const { data: pub } = window.sb.storage
      .from('product-images')
      .getPublicUrl(path);

    currentImages.push(pub.publicUrl);
    renderPhotos();
    uploadStatus.textContent = pendingUploads > 0
      ? `Uploading ${pendingUploads} more…`
      : 'Uploaded ✓';
  }
});

// ============ SAVE ============
saveBtn.addEventListener('click', async () => {
  if (!pName.value.trim()) {
    showToast('Name is required');
    pName.focus();
    return;
  }
  if (pendingUploads > 0) {
    showToast('Wait for uploads to finish');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.querySelector('span').textContent = 'Saving…';

  const payload = {
    name:        pName.value.trim(),
    spec:        pSpec.value.trim() || null,
    description: pDescription.value.trim() || null,
    price:       parseInt(pPrice.value, 10) || 0,
    tag:         pTag.value.trim() || null,
    cap_color:   pCapColor.value.trim() || null,
    sort_order:  parseInt(pSortOrder.value, 10) || 0,
    is_active:   pIsActive.checked,
    images:      currentImages,
  };

  let result;
  if (pId.value) {
    result = await window.sb.from('products').update(payload).eq('id', pId.value);
  } else {
    result = await window.sb.from('products').insert(payload);
  }

  saveBtn.disabled = false;
  saveBtn.querySelector('span').textContent = 'Save';

  if (result.error) {
    showToast(`Error: ${result.error.message}`);
    console.error(result.error);
    return;
  }

  showToast(pId.value ? 'Product updated ✓' : 'Product created ✓');
  closeModal();
  loadProducts();
});

// ============ DELETE ============
deleteBtn.addEventListener('click', async () => {
  if (!pId.value) return;
  if (!confirm(`Delete "${pName.value}"? This cannot be undone.`)) return;

  const { error } = await window.sb.from('products').delete().eq('id', pId.value);
  if (error) {
    showToast(`Error: ${error.message}`);
    return;
  }
  showToast('Product deleted');
  closeModal();
  loadProducts();
});

async function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  const { error } = await window.sb.from('products').delete().eq('id', id);
  if (error) {
    showToast(`Error: ${error.message}`);
    return;
  }
  showToast('Product deleted');
  loadProducts();
}

// ============ CUSTOM BLOCKS ============
const blocksTable      = document.getElementById('blocksTable');
const blockCount       = document.getElementById('blockCount');
const newBlockBtn      = document.getElementById('newBlockBtn');
const blockModalOverlay = document.getElementById('blockModalOverlay');
const blockModalClose  = document.getElementById('blockModalClose');
const blockModalTitle  = document.getElementById('blockModalTitle');
const bId              = document.getElementById('bId');
const bHeading         = document.getElementById('bHeading');
const bBody            = document.getElementById('bBody');
const bCtaLabel        = document.getElementById('bCtaLabel');
const bCtaUrl          = document.getElementById('bCtaUrl');
const bPhotoGrid       = document.getElementById('bPhotoGrid');
const bPhotoInput      = document.getElementById('bPhotoInput');
const bUploadStatus    = document.getElementById('bUploadStatus');
const bSortOrder       = document.getElementById('bSortOrder');
const bIsActive        = document.getElementById('bIsActive');
const bSaveBtn         = document.getElementById('bSaveBtn');
const bCancelBtn       = document.getElementById('bCancelBtn');
const bDeleteBtn       = document.getElementById('bDeleteBtn');

let bCurrentImage = '';
let bPendingUploads = 0;
let blocksCache = [];

async function loadBlocks() {
  blocksTable.innerHTML = `<div class="admin-empty">Loading…</div>`;

  const { data, error } = await window.sb
    .from('homepage_blocks')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    blocksTable.innerHTML = `<div class="admin-empty" style="color:var(--accent-2)">Error: ${escapeHtml(error.message)}</div>`;
    return;
  }

  blocksCache = data || [];
  if (blocksCache.length === 0) {
    blocksTable.innerHTML = `<div class="admin-empty">No blocks yet. Click <strong>New block</strong> to add an announcement bar, banner, story, etc.</div>`;
    blockCount.textContent = '';
    return;
  }

  blockCount.textContent = `(${blocksCache.length})`;

  blocksTable.innerHTML = `
    <div class="admin-row header">
      <div></div>
      <div>Heading</div>
      <div>CTA</div>
      <div>Order</div>
      <div></div>
      <div>Status</div>
      <div></div>
    </div>
    ${blocksCache.map(b => `
      <div class="admin-row" data-id="${b.id}">
        <div class="row-thumb">${
          b.image_url
            ? `<img src="${escapeHtml(b.image_url)}" alt="" />`
            : `<span>📝</span>`
        }</div>
        <div>
          <div class="row-name">${escapeHtml(b.heading || '(no heading)')}</div>
          <div class="row-spec">${escapeHtml((b.body || '').replace(/<[^>]+>/g, '').slice(0, 80))}${(b.body || '').length > 80 ? '…' : ''}</div>
        </div>
        <div>${b.cta_label ? `<span class="row-tag">${escapeHtml(b.cta_label)}</span>` : '<span style="color:var(--text-faint)">—</span>'}</div>
        <div style="font-family:var(--font-mono);color:var(--text-dim);">${b.sort_order ?? 0}</div>
        <div></div>
        <div><span class="row-status ${b.is_active ? 'active' : 'inactive'}">${b.is_active ? '● Live' : '○ Hidden'}</span></div>
        <div class="row-actions">
          <button class="icon-btn" data-bedit="${b.id}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="icon-btn danger" data-bdelete="${b.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `).join('')}
  `;

  blocksTable.querySelectorAll('[data-bedit]').forEach(b =>
    b.addEventListener('click', () => openBlockEdit(b.dataset.bedit)));
  blocksTable.querySelectorAll('[data-bdelete]').forEach(b =>
    b.addEventListener('click', () => deleteBlock(b.dataset.bdelete)));
}

function openBlockModal() {
  blockModalOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeBlockModal() {
  blockModalOverlay.hidden = true;
  document.body.style.overflow = '';
}
blockModalClose.addEventListener('click', closeBlockModal);
bCancelBtn.addEventListener('click', closeBlockModal);
blockModalOverlay.addEventListener('click', e => {
  if (e.target === blockModalOverlay) closeBlockModal();
});

newBlockBtn.addEventListener('click', () => openBlockEdit(null));

function openBlockEdit(id) {
  bCurrentImage = '';
  bUploadStatus.textContent = '';
  // reset form
  bId.value = '';
  bHeading.value = '';
  bBody.value = '';
  bCtaLabel.value = '';
  bCtaUrl.value = '';
  bSortOrder.value = 0;
  bIsActive.checked = true;

  if (!id) {
    blockModalTitle.textContent = 'New block';
    bDeleteBtn.hidden = true;
    renderBlockImage();
    openBlockModal();
    return;
  }

  const block = blocksCache.find(b => b.id === id);
  if (!block) return;

  blockModalTitle.textContent = `Edit · ${block.heading || '(no heading)'}`;
  bDeleteBtn.hidden = false;
  bId.value         = block.id;
  bHeading.value    = block.heading || '';
  bBody.value       = block.body || '';
  bCtaLabel.value   = block.cta_label || '';
  bCtaUrl.value     = block.cta_url || '';
  bSortOrder.value  = block.sort_order ?? 0;
  bIsActive.checked = block.is_active !== false;
  bCurrentImage     = block.image_url || '';
  renderBlockImage();
  openBlockModal();
}

function renderBlockImage() {
  if (!bCurrentImage) {
    bPhotoGrid.innerHTML = '';
    return;
  }
  bPhotoGrid.innerHTML = `
    <div class="photo-tile primary">
      <img src="${escapeHtml(bCurrentImage)}" alt="" />
      <button type="button" class="photo-remove" id="bRemoveImage" title="Remove">×</button>
    </div>
  `;
  document.getElementById('bRemoveImage').addEventListener('click', () => {
    bCurrentImage = '';
    renderBlockImage();
  });
}

bPhotoInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  bPhotoInput.value = '';
  bPendingUploads++;
  bUploadStatus.textContent = 'Uploading…';

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `blocks/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;

  const { error } = await window.sb.storage
    .from('product-images')
    .upload(path, file, { cacheControl: '31536000', upsert: false });

  bPendingUploads--;

  if (error) {
    bUploadStatus.textContent = `Upload failed: ${error.message}`;
    console.error(error);
    return;
  }

  const { data: pub } = window.sb.storage
    .from('product-images')
    .getPublicUrl(path);

  bCurrentImage = pub.publicUrl;
  renderBlockImage();
  bUploadStatus.textContent = 'Uploaded ✓';
});

bSaveBtn.addEventListener('click', async () => {
  if (bPendingUploads > 0) {
    showToast('Wait for uploads to finish');
    return;
  }

  bSaveBtn.disabled = true;
  bSaveBtn.querySelector('span').textContent = 'Saving…';

  const payload = {
    heading:    bHeading.value.trim() || null,
    body:       bBody.value.trim() || null,
    cta_label:  bCtaLabel.value.trim() || null,
    cta_url:    bCtaUrl.value.trim() || null,
    image_url:  bCurrentImage || null,
    sort_order: parseInt(bSortOrder.value, 10) || 0,
    is_active:  bIsActive.checked,
  };

  let result;
  if (bId.value) {
    result = await window.sb.from('homepage_blocks').update(payload).eq('id', bId.value);
  } else {
    result = await window.sb.from('homepage_blocks').insert(payload);
  }

  bSaveBtn.disabled = false;
  bSaveBtn.querySelector('span').textContent = 'Save';

  if (result.error) {
    showToast(`Error: ${result.error.message}`);
    console.error(result.error);
    return;
  }

  showToast(bId.value ? 'Block updated ✓' : 'Block created ✓');
  closeBlockModal();
  loadBlocks();
});

bDeleteBtn.addEventListener('click', async () => {
  if (!bId.value) return;
  if (!confirm(`Delete this block? This cannot be undone.`)) return;

  const { error } = await window.sb.from('homepage_blocks').delete().eq('id', bId.value);
  if (error) {
    showToast(`Error: ${error.message}`);
    return;
  }
  showToast('Block deleted');
  closeBlockModal();
  loadBlocks();
});

async function deleteBlock(id) {
  if (!confirm('Delete this block? This cannot be undone.')) return;
  const { error } = await window.sb.from('homepage_blocks').delete().eq('id', id);
  if (error) {
    showToast(`Error: ${error.message}`);
    return;
  }
  showToast('Block deleted');
  loadBlocks();
}

// ============ INIT ============
checkSession();
