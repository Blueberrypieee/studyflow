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

    setTimeout(() => {
      window.location.href = '/quiz-play';
    }, 1000);

  } catch (err) {
    setLoading(false);
    showToast(err.message, 'error');
  }
});

/* ── Helpers ─────────────────────────────────────────────── */
function setLoading(state) {
  btnGenerate.classList.toggle('loading', state);
  btnGenerate.disabled = state;
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

/* ── Fix label upload zone CSS ───────────────────────────── */
(function() {
  const s = document.createElement('style');
  s.textContent = `
    label.upload-zone {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      cursor: pointer; width: 100%; text-align: center;
    }`;
  document.head.appendChild(s);
})();

