const DAY = 86400000;

let state = {
  files:         [],
  folders:       [],
  currentFolder: 'root',
  activeFilter:  'all',
  searchQuery:   '',
  moveFileId:    null,
};

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
async function init() {
  bindEvents();
  await Promise.all([loadFolders(), loadFiles()]);
  render();
}

/* ═══════════════════════════════════════════════════════
   LOAD FOLDERS dari backend
═══════════════════════════════════════════════════════ */
async function loadFolders() {
  try {
    const res  = await fetch('/api/folders');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();
    // id disimpan sebagai string biar konsisten sama yang lama
    state.folders = data.folders.map(f => ({
      id:        String(f.id),
      name:      f.name,
      createdAt: f.createdAt,
    }));
  } catch (err) {
    console.error('Gagal load folders:', err);
  }
}

/* ═══════════════════════════════════════════════════════
   LOAD FILES dari backend
═══════════════════════════════════════════════════════ */
async function loadFiles() {
  try {
    const res  = await fetch('/api/materials');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();
    state.files = data.materials.map(m => ({
      id:         m.id,
      name:       m.name,
      type:       m.type,
      size:       m.size,
      folderId:   m.folder || null,
      uploadedAt: m.uploadedAt,
    }));
  } catch (err) {
    showToast('Gagal memuat materi.', 'error');
  }
}

function render() {
  renderBreadcrumb();
  renderFolders();
  renderFiles();
}

function renderBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  if (state.currentFolder === 'root') {
    bc.innerHTML = `<span class="breadcrumb-item active"><i class="fa-solid fa-house"></i> Semua Materi</span>`;
    return;
  }
  const folder = state.folders.find(f => f.id === state.currentFolder);
  bc.innerHTML = `
    <span class="breadcrumb-item" data-folder-id="root">
      <i class="fa-solid fa-house"></i> Semua Materi
    </span>
    <i class="fa-solid fa-chevron-right breadcrumb-sep"></i>
    <span class="breadcrumb-item active">
      <i class="fa-solid fa-folder"></i> ${folder ? folder.name : ''}
    </span>`;
  bc.querySelector('[data-folder-id="root"]').addEventListener('click', () => {
    state.currentFolder = 'root';
    render();
  });
}

function renderFolders() {
  const row = document.getElementById('foldersRow');
  if (state.currentFolder !== 'root') { row.innerHTML = ''; return; }
  let folders = [...state.folders];
  if (state.searchQuery) folders = folders.filter(f => f.name.toLowerCase().includes(state.searchQuery));
  if (!folders.length) { row.innerHTML = ''; return; }
  row.innerHTML = folders.map((f, i) => {
    const count = state.files.filter(file => file.folderId === f.name).length;
    return `
      <div class="folder-card" data-folder-id="${f.id}" style="animation-delay:${i*0.06}s">
        <button class="folder-delete" data-delete-folder="${f.id}"><i class="fa-solid fa-xmark"></i></button>
        <i class="fa-solid fa-folder folder-icon"></i>
        <span class="folder-name">${escHtml(f.name)}</span>
        <span class="folder-count">${count} file</span>
      </div>`;
  }).join('');
  row.querySelectorAll('.folder-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.folder-delete')) return;
      state.currentFolder = card.dataset.folderId;
      state.searchQuery = '';
      document.getElementById('searchInput').value = '';
      updateSearchClear();
      render();
    });
  });
  row.querySelectorAll('.folder-delete').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteFolder(btn.dataset.deleteFolder); });
  });
}

function renderFiles() {
  const grid       = document.getElementById('filesGrid');
  const emptyState = document.getElementById('emptyState');
  let files = state.files.filter(f =>
    state.currentFolder === 'root' ? !f.folderId : (function(){ var fo = state.folders.find(function(x){ return x.id === state.currentFolder; }); return fo && f.folderId === fo.name; })()
  );
  files = applyDateFilter(files);
  if (state.searchQuery) files = files.filter(f => f.name.toLowerCase().includes(state.searchQuery));
  const folderCount = state.currentFolder === 'root'
    ? state.folders.filter(f => state.searchQuery ? f.name.toLowerCase().includes(state.searchQuery) : true).length : 0;
  if (!files.length && !folderCount) { emptyState.style.display='flex'; grid.innerHTML=''; return; }
  emptyState.style.display = 'none';
  grid.innerHTML = files.map((f, i) => {
    const folder = state.folders.find(fo => fo.name === f.folderId);
    return `
      <div class="file-card" style="animation-delay:${i*0.06}s">
        <div class="file-type-icon ${f.type}">
          <i class="fa-solid ${f.type==='pdf'?'fa-file-pdf':'fa-file-word'}"></i>
        </div>
        <div class="file-info">
          <div class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
          <div class="file-meta">
            <span class="file-date"><i class="fa-regular fa-clock"></i> ${formatDate(f.uploadedAt)}</span>
            <span class="file-size">${formatSize(f.size)}</span>
            ${folder ? `<span class="file-folder-tag"><i class="fa-solid fa-folder"></i> ${escHtml(folder.name)}</span>` : ''}
          </div>
        </div>
        <div class="file-actions">
          <button class="file-action-btn" title="Pindah ke folder" data-action="move" data-id="${f.id}" data-name="${escHtml(f.name)}">
            <i class="fa-solid fa-right-to-bracket"></i>
          </button>
          <button class="file-action-btn" title="Unduh" data-action="download" data-id="${f.id}">
            <i class="fa-solid fa-download"></i>
          </button>
          <button class="file-action-btn delete" title="Hapus" data-action="delete" data-id="${f.id}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.file-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id, name } = btn.dataset;
      if (action === 'delete')   deleteFile(id);
      if (action === 'download') downloadFile(id);
      if (action === 'move')     openMoveModal(id, name);
    });
  });
}

/* ── Move file to folder ──────────────────────────────── */
function openMoveModal(fileId, fileName) {
  state.moveFileId = fileId;
  document.getElementById('moveFileName').textContent = fileName;

  const optionsEl = document.getElementById('folderOptions');

  if (!state.folders.length) {
    optionsEl.innerHTML = `<p class="no-folders-msg">Belum ada folder. Buat folder dulu!</p>`;
  } else {
    optionsEl.innerHTML = `
      <button class="folder-option-btn" data-folder-id="root">
        <i class="fa-solid fa-house"></i> Semua Materi (root)
      </button>
      ${state.folders.map(f => `
        <button class="folder-option-btn" data-folder-id="${f.id}">
          <i class="fa-solid fa-folder"></i> ${escHtml(f.name)}
        </button>`).join('')}`;

    optionsEl.querySelectorAll('.folder-option-btn').forEach(btn => {
      btn.addEventListener('click', () => moveFile(fileId, btn.dataset.folderId));
    });
  }

  document.getElementById('moveModalOverlay').classList.add('open');
}

function closeMoveModal() {
  document.getElementById('moveModalOverlay').classList.remove('open');
  state.moveFileId = null;
}

async function moveFile(fileId, folderId) {
  try {
    const folder     = folderId === 'root' ? null : state.folders.find(f => f.id === folderId);
    const folderName = folder ? folder.name : null;

    const res  = await fetch(`/api/materials/${fileId}/move`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ folder: folderName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal pindah file.');

    closeMoveModal();
    await loadFiles();
    render();
    showToast(folder ? `File dipindah ke "${folder.name}"` : 'File dipindah ke root.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Upload ───────────────────────────────────────────── */
function handleFiles(fileList) {
  Array.from(fileList).forEach(file => {
    const ext  = file.name.split('.').pop().toLowerCase();
    const type = ext==='pdf'?'pdf':ext==='docx'?'docx':null;
    // Validasi di frontend cuma buat UX cepat (biar user langsung tau kalau salah format).
    // Validasi SEBENARNYA (cek isi file / magic bytes) tetap dilakukan di backend,
    // karena validasi frontend selalu bisa dilewati orang yang paham DevTools.
    if (!type) { showToast(`${file.name}: hanya PDF & DOCX.`,'error'); return; }
    uploadFile(file, type);
  });
}

async function uploadFile(file, type) {
  const queueEl = document.getElementById('uploadQueue');
  const itemId  = `uq-${Date.now()}`;
  const item    = document.createElement('div');
  item.className = 'upload-item';
  item.id = itemId;
  item.innerHTML = `
    <i class="fa-solid ${type==='pdf'?'fa-file-pdf':'fa-file-word'} upload-item-icon ${type}"></i>
    <div class="upload-item-info">
      <div class="upload-item-name">${escHtml(file.name)}</div>
      <div class="upload-item-meta">${formatSize(file.size)} · Mengupload...</div>
      <div class="upload-progress-bar"><div class="upload-progress-fill" id="fill-${itemId}" style="width:0%"></div></div>
    </div>
    <span class="upload-item-status" id="status-${itemId}"><i class="fa-solid fa-circle-notch fa-spin"></i></span>
    <button class="upload-item-remove" id="remove-${itemId}" title="Hapus dari daftar">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
  queueEl.appendChild(item);

  // Tombol X — selalu bisa dipakai buat nyingkirin item dari daftar,
  // baik pas masih loading, sukses, atau gagal (misal file ditolak validasi backend)
  const removeItem = () => {
    item.style.transition = 'opacity .3s ease';
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 300);
  };
  document.getElementById(`remove-${itemId}`).addEventListener('click', removeItem);

  let pct = 0;
  const fill = document.getElementById(`fill-${itemId}`);
  const iv = setInterval(() => { pct=Math.min(pct+Math.random()*15+5,90); fill.style.width=`${pct}%`; },200);
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (state.currentFolder !== 'root') {
      const folder = state.folders.find(f => f.id === state.currentFolder);
      if (folder) formData.append('folder', folder.name);
    }
    const res  = await fetch('/api/materials/upload', { method:'POST', body:formData });
    const data = await res.json();
    clearInterval(iv);
    if (!res.ok) throw new Error(data.error||'Upload gagal.');
    fill.style.width='100%';
    document.getElementById(`status-${itemId}`).className='upload-item-status done';
    document.getElementById(`status-${itemId}`).innerHTML='<i class="fa-solid fa-circle-check"></i>';
    item.querySelector('.upload-item-meta').textContent=`${formatSize(file.size)} · Selesai`;
    showToast(`${file.name} berhasil diupload!`,'success');
    await loadFiles();
    render();
    setTimeout(removeItem, 2000);
  } catch(err) {
    clearInterval(iv);
    fill.style.background='#EF4444';
    fill.style.width='100%';
    document.getElementById(`status-${itemId}`).className='upload-item-status error';
    document.getElementById(`status-${itemId}`).innerHTML='<i class="fa-solid fa-circle-xmark"></i>';
    item.querySelector('.upload-item-meta').textContent = err.message;
    showToast(err.message,'error');
  }
}

/* ── Delete & Download ────────────────────────────────── */
async function deleteFile(fileId) {
  try {
    const res = await fetch(`/api/materials/${fileId}`, { method:'DELETE' });
    if (!res.ok) { const d=await res.json(); throw new Error(d.error||'Gagal hapus.'); }
    await loadFiles();
    render();
    showToast('File dihapus.','info');
  } catch(err) { showToast(err.message,'error'); }
}

function downloadFile(fileId) { window.location.href=`/api/materials/${fileId}/download`; }

/* ── Folder CRUD — real API ────────────────────────────── */
function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('folderName').value='';
  document.getElementById('folderError').textContent='';
  setTimeout(()=>document.getElementById('folderName').focus(),200);
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

async function createFolder() {
  const nameInput = document.getElementById('folderName');
  const errEl     = document.getElementById('folderError');
  const name      = nameInput.value.trim();

  if (!name) { errEl.textContent='Nama folder tidak boleh kosong.'; return; }
  if (name.length<2) { errEl.textContent='Minimal 2 karakter.'; return; }

  try {
    const res  = await fetch('/api/folders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Gagal membuat folder.'; return; }

    closeModal();
    await loadFolders();
    render();
    showToast(`Folder "${name}" berhasil dibuat!`,'success');
  } catch (err) {
    errEl.textContent = 'Terjadi kesalahan. Coba lagi.';
  }
}

async function deleteFolder(folderId) {
  try {
    const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal hapus folder.'); }

    await Promise.all([loadFolders(), loadFiles()]);

    // Kalau lagi di dalam folder yang dihapus, balik ke root
    if (state.currentFolder === folderId) state.currentFolder = 'root';

    render();
    showToast('Folder dihapus.','info');
  } catch(err) {
    showToast(err.message, 'error');
  }
}

/* ── Date filter ──────────────────────────────────────── */
function applyDateFilter(files) {
  if (state.activeFilter==='all') return files;
  const now=Date.now();
  const from={today:startOfDay(),week:now-7*DAY,month:now-30*DAY}[state.activeFilter]??0;
  return files.filter(f=>f.uploadedAt>=from);
}
function startOfDay() { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }

/* ── Bind events ──────────────────────────────────────── */
function bindEvents() {
  const zone=document.getElementById('uploadZone'), fileInput=document.getElementById('fileInput');
  fileInput.addEventListener('change',()=>{ handleFiles(fileInput.files); fileInput.value=''; });
  zone.addEventListener('dragover',e=>{ e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
  zone.addEventListener('drop',e=>{ e.preventDefault(); zone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });

  const searchInput=document.getElementById('searchInput'), searchClear=document.getElementById('searchClear');
  searchInput.addEventListener('input',()=>{ state.searchQuery=searchInput.value.trim().toLowerCase(); updateSearchClear(); render(); });
  searchClear.addEventListener('click',()=>{ searchInput.value=''; state.searchQuery=''; updateSearchClear(); render(); });

  document.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active'); state.activeFilter=btn.dataset.filter; render();
    });
  });

  document.getElementById('btnNewFolder').addEventListener('click',openModal);
  document.getElementById('modalClose').addEventListener('click',closeModal);
  document.getElementById('btnCancel').addEventListener('click',closeModal);
  document.getElementById('btnCreate').addEventListener('click',createFolder);
  document.getElementById('modalOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('modalOverlay')) closeModal(); });
  document.getElementById('folderName').addEventListener('keydown',e=>{ if(e.key==='Enter') createFolder(); if(e.key==='Escape') closeModal(); });

  document.getElementById('moveModalClose').addEventListener('click',closeMoveModal);
  document.getElementById('moveModalOverlay').addEventListener('click',e=>{ if(e.target===document.getElementById('moveModalOverlay')) closeMoveModal(); });
}

function updateSearchClear() {
  document.getElementById('searchClear').classList.toggle('visible',document.getElementById('searchInput').value.length>0);
}

/* ── Utils ────────────────────────────────────────────── */
function formatDate(ts) {
  const d=new Date(ts), diff=Date.now()-ts;
  if(diff<DAY&&d.getDate()===new Date().getDate()) return 'Hari ini';
  if(diff<2*DAY) return 'Kemarin';
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}
function formatSize(bytes) {
  if(bytes<1024) return `${bytes} B`;
  if(bytes<1048576) return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}
function escHtml(str) {
  return str.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function showToast(message,type='info',duration=3000) {
  const icons={success:'fa-circle-check',error:'fa-circle-xmark',info:'fa-circle-info'};
  const toast=document.createElement('div');
  toast.className=`toast ${type}`;
  toast.innerHTML=`<i class="fa-solid ${icons[type]}"></i> ${message}`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(()=>{ toast.classList.add('fade-out'); toast.addEventListener('animationend',()=>toast.remove(),{once:true}); },duration);
}

init();


