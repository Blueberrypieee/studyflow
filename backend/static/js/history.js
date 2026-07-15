/**
 * StudyFlow — history.js
 * Baca dari /api/quiz/sessions (real backend)
 * Tab: Riwayat Quiz + Bank Soal Salah
 * Filter: all / today / week / month
 */

const LETTERS = ['A', 'B', 'C', 'D'];
const DAY     = 86400000;

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
let state = {
  activeTab:    'sessions',
  activeFilter: 'all',
  pendingClear: null,
  sessions:     [],   // cache dari API
};

/* ═══════════════════════════════════════════════════════
   LOAD DATA dari backend
═══════════════════════════════════════════════════════ */
async function loadSessions() {
  try {
    const res  = await fetch('/api/quiz/sessions');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();
    state.sessions = data.sessions || [];
    render();
  } catch (err) {
    showToast('Gagal memuat riwayat.', 'error');
  }
}

function getSessions() {
  return state.sessions;
}

function getAllMistakes() {
  return state.sessions.flatMap(s => (s.mistakes || []).map(m => ({
    ...m,
    material: s.material,
    date:     s.date,
  })));
}

/* ═══════════════════════════════════════════════════════
   DATE FILTER
═══════════════════════════════════════════════════════ */
function applyFilter(items, dateKey = 'date') {
  if (state.activeFilter === 'all') return items;
  const now  = Date.now();
  const from = {
    today: startOfDay(),
    week:  now - 7 * DAY,
    month: now - 30 * DAY,
  }[state.activeFilter] ?? 0;
  return items.filter(i => i[dateKey] >= from);
}

function startOfDay() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

/* ═══════════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════════ */
function render() {
  if (state.activeTab === 'sessions') renderSessions();
  else renderMistakes();
}

/* ── Sessions tab ───────────────────────────────────── */
function renderSessions() {
  const all      = getSessions();
  const filtered = applyFilter(all);

  const totalQuiz  = filtered.length;
  const avgPct     = totalQuiz
    ? Math.round(filtered.reduce((s, x) => s + x.pct, 0) / totalQuiz) : 0;
  const totalWrong = filtered.reduce((s, x) => s + x.wrong, 0);

  document.getElementById('summaryRow').innerHTML = `
    <div class="summary-card">
      <span class="summary-val blue">${totalQuiz}</span>
      <span class="summary-key">Total Quiz</span>
    </div>
    <div class="summary-card">
      <span class="summary-val green">${avgPct}%</span>
      <span class="summary-key">Rata-rata Skor</span>
    </div>
    <div class="summary-card">
      <span class="summary-val amber">${totalWrong}</span>
      <span class="summary-key">Total Salah</span>
    </div>`;

  const listEl  = document.getElementById('sessionList');
  const emptyEl = document.getElementById('emptySession');

  if (!filtered.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';
  listEl.innerHTML = filtered.map((s, i) => buildSessionCard(s, i)).join('');

  listEl.querySelectorAll('.session-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.session-card').classList.toggle('open');
    });
  });
}

function buildSessionCard(s, i) {
  const dur     = formatDuration(s.durationSec);
  const dateStr = formatDate(s.date);

  const mistakesHtml = s.mistakes && s.mistakes.length
    ? s.mistakes.map(m => {
        const chosenText  = m.chosen !== null
          ? `${LETTERS[m.chosen]}. ${m.options[m.chosen]}`
          : 'Tidak dijawab';
        const correctText = `${LETTERS[m.answer]}. ${m.options[m.answer]}`;
        return `
          <div class="inline-mistake">
            <div class="inline-mistake-q">${escHtml(m.question)}</div>
            <div class="inline-mistake-answers">
              <span class="inline-mistake-answer user">
                <i class="fa-solid fa-xmark"></i> ${escHtml(chosenText)}
              </span>
              <span class="inline-mistake-answer right">
                <i class="fa-solid fa-check"></i> ${escHtml(correctText)}
              </span>
            </div>
          </div>`;
      }).join('')
    : `<div class="no-mistake-msg"><i class="fa-solid fa-circle-check"></i> Semua jawaban benar!</div>`;

  return `
    <div class="session-card" style="animation-delay:${i * 0.06}s">
      <div class="session-header">
        <div class="session-grade grade-${s.grade}">${s.grade}</div>
        <div class="session-info">
          <div class="session-material">${escHtml(s.material)}</div>
          <div class="session-meta">
            <span class="session-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
            <span class="session-duration"><i class="fa-solid fa-stopwatch"></i> ${dur}</span>
            <span class="badge correct"><i class="fa-solid fa-check"></i> ${s.correct}</span>
            <span class="badge wrong"><i class="fa-solid fa-xmark"></i> ${s.wrong}</span>
          </div>
        </div>
        <div class="session-score-wrap">
          <span class="session-pct">${s.pct}%</span>
          <i class="fa-solid fa-chevron-right session-chevron"></i>
        </div>
      </div>
      <div class="session-body">
        <div class="session-body-inner">
          ${mistakesHtml}
        </div>
      </div>
    </div>`;
}

/* ── Mistakes tab ───────────────────────────────────── */
function renderMistakes() {
  const all      = getAllMistakes();
  const filtered = applyFilter(all);

  document.getElementById('mistakesSub').textContent =
    `${filtered.length} soal yang pernah dijawab salah`;

  const listEl  = document.getElementById('mistakeList');
  const emptyEl = document.getElementById('emptyMistake');

  if (!filtered.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';
  listEl.innerHTML = filtered.map((m, i) => buildMistakeCard(m, i)).join('');
}

function buildMistakeCard(m, i) {
  const chosenText  = m.chosen !== null
    ? `${LETTERS[m.chosen]}. ${m.options[m.chosen]}`
    : 'Tidak dijawab (timeout)';
  const correctText = `${LETTERS[m.answer]}. ${m.options[m.answer]}`;

  return `
    <div class="mistake-card" style="animation-delay:${i * 0.05}s">
      <div class="mistake-card-top">
        <div class="mistake-icon"><i class="fa-solid fa-xmark"></i></div>
        <div class="mistake-q-text">${escHtml(m.question)}</div>
      </div>
      <div class="mistake-answers">
        <div class="mistake-answer-row user-wrong">
          <i class="fa-solid fa-xmark"></i>
          Jawabanmu: ${escHtml(chosenText)}
        </div>
        <div class="mistake-answer-row correct">
          <i class="fa-solid fa-circle-check"></i>
          Jawaban benar: ${escHtml(correctText)}
        </div>
      </div>
      <div class="mistake-meta-row">
        <span class="mistake-from">
          <i class="fa-solid fa-file"></i> ${escHtml(m.material || '')}
        </span>
        <span class="mistake-date">${formatDate(m.date)}</span>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════
   CLEAR ALL → API DELETE
═══════════════════════════════════════════════════════ */
function openConfirm(titleText, descText, onConfirm) {
  document.getElementById('modalTitle').textContent = titleText;
  document.getElementById('modalDesc').textContent  = descText;
  document.getElementById('modalOverlay').classList.add('open');
  state.pendingClear = onConfirm;
}

function closeConfirm() {
  document.getElementById('modalOverlay').classList.remove('open');
  state.pendingClear = null;
}

document.getElementById('btnClearAll').addEventListener('click', () => {
  openConfirm(
    'Hapus semua riwayat?',
    'Semua sesi quiz dan soal salah akan terhapus permanen.',
    async () => {
      try {
        const res = await fetch('/api/quiz/sessions', { method: 'DELETE' });
        if (!res.ok) throw new Error('Gagal hapus.');
        state.sessions = [];
        render();
        showToast('Semua riwayat dihapus.', 'info');
      } catch(err) {
        showToast(err.message, 'error');
      }
    }
  );
});

document.getElementById('btnConfirm').addEventListener('click', () => {
  if (typeof state.pendingClear === 'function') state.pendingClear();
  closeConfirm();
});

document.getElementById('btnCancel').addEventListener('click', closeConfirm);
document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeConfirm();
});

/* ═══════════════════════════════════════════════════════
   TABS & FILTERS
═══════════════════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeTab = btn.dataset.tab;
    document.getElementById('tabSessions').classList.toggle('hidden', state.activeTab !== 'sessions');
    document.getElementById('tabMistakes').classList.toggle('hidden', state.activeTab !== 'mistakes');
    render();
  });
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeFilter = btn.dataset.filter;
    render();
  });
});

/* ═══════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════ */
function formatDate(ts) {
  const d    = new Date(ts);
  const diff = Date.now() - ts;
  if (diff < DAY && d.getDate() === new Date().getDate()) return 'Hari ini';
  if (diff < 2 * DAY) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function escHtml(str = '') {
  return String(str).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

function showToast(message, type = 'info', duration = 3000) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${message}`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ═══════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════ */
loadSessions();

