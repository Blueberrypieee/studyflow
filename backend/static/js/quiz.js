/**
 * StudyFlow — quiz.js
 * Upload file → fetch /api/quiz/generate → redirect ke quiz-play
 */

const fileInput     = document.getElementById('fileInput');
const filePreview   = document.getElementById('filePreview');
const previewIcon   = document.getElementById('previewIcon');
const previewTypeIcon = document.getElementById('previewTypeIcon');
const previewName   = document.getElementById('previewName');
const previewSize   = document.getElementById('previewSize');
const btnRemove     = document.getElementById('btnRemoveFile');
const btnGenerate   = document.getElementById('btnGenerate');
const uploadZone    = document.getElementById('uploadZone');
const toastContainer= document.getElementById('toastContainer');

let selectedFile = null;

/* ── File input ─────────────────────────────────────────── */
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
  fileInput.value = '';
});

/* ── Drag & drop ─────────────────────────────────────────── */
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

/* ── Handle file ─────────────────────────────────────────── */
function handleFile(file) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : null;

  if (!type) {
    showToast('Format tidak didukung. Gunakan PDF atau DOCX.', 'error');
    return;
  }

  selectedFile = { file, type };

  previewIcon.className     = `file-preview-icon ${type}`;
  previewTypeIcon.className = `fa-solid ${type === 'pdf' ? 'fa-file-pdf' : 'fa-file-word'}`;
  previewName.textContent   = file.name;
  previewSize.textContent   = formatSize(file.size);

  filePreview.classList.add('visible');
  btnGenerate.disabled = false;

  showToast(`${file.name} siap diproses!`, 'success');
}

/* ── Remove file ─────────────────────────────────────────── */
btnRemove.addEventListener('click', () => {
  selectedFile = null;
  filePreview.classList.remove('visible');
  btnGenerate.disabled = true;
});

/* ── Generate quiz → fetch API ───────────────────────────── */
btnGenerate.addEventListener('click', async () => {
  if (!selectedFile) return;

  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.file);

    const res  = await fetch('/api/quiz/generate', {
      method: 'POST',
      body:   formData,
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Gagal membuat quiz.');

    // Simpan soal ke sessionStorage → dibaca quiz-play.js
    sessionStorage.setItem('sf_quiz_questions', JSON.stringify(data.questions));
    sessionStorage.setItem('sf_quiz_material',  data.material);

    showToast('Quiz berhasil dibuat! Memulai...', 'success');

    // Biarkan loading tetap aktif sampai redirect, biar ga sempet
    // keliatan tombol balik normal sepersekian detik sebelum pindah halaman
    setTimeout(() => {
      window.location.href = '/quiz-play';
    }, 800);

  } catch (err) {
    setLoading(false);
    showToast(err.message, 'error');
  }
});

/* ── Helpers ─────────────────────────────────────────────── */
function setLoading(state) {
  btnGenerate.classList.toggle('loading', state);
  btnGenerate.disabled = state;

  // Kunci file input & tombol hapus selama proses generate,
  // biar user ga bisa ganti file di tengah jalan
  btnRemove.disabled  = state;
  fileInput.disabled  = state;
  uploadZone.classList.toggle('locked', state);
}

function formatSize(bytes) {
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function showToast(message, type = 'info', duration = 3200) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${message}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ── Loading state untuk tombol Generate Quiz ────────────── */
(function() {
  const s = document.createElement('style');
  s.textContent = `
    label.upload-zone {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      cursor: pointer; width: 100%; text-align: center;
      transition: opacity 0.2s ease;
    }
    label.upload-zone.locked {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* Sembunyikan konten normal, tampilkan loader saat class .loading aktif */
    .btn-generate .btn-loader {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .btn-generate.loading .btn-icon,
    .btn-generate.loading .btn-text {
      display: none;
    }
    .btn-generate.loading .btn-loader {
      display: flex;
    }
    .btn-generate.loading {
      opacity: 0.85;
      cursor: not-allowed;
    }

    #btnRemoveFile:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
})();


