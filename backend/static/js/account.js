/**
 * StudyFlow — account.js
 * Fetch user data + stats dari backend
 * Ganti password, logout
 */

/* ── DOM refs ────────────────────────────────────────────── */
const profileAvatar    = document.getElementById('profileAvatar');
const profileUsername  = document.getElementById('profileUsername');
const joinDateText      = document.getElementById('joinDateText');

const statTotalFocus   = document.getElementById('statTotalFocus');
const statTotalRest    = document.getElementById('statTotalRest');
const statBestStreak   = document.getElementById('statBestStreak');
const statAvgGrade     = document.getElementById('statAvgGrade');

const btnChangePassword = document.getElementById('btnChangePassword');
const btnLogoutAccount  = document.getElementById('btnLogoutAccount');

const toastContainer    = document.getElementById('toastContainer');

const dash = '---';

/* ═══════════════════════════════════════════════════════
   LOAD PROFILE + STATS
═══════════════════════════════════════════════════════ */
async function loadAccountData() {
  try {
    const res = await fetch('/api/account/me');
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) throw new Error('Gagal memuat data akun.');

    const data = await res.json();
    renderProfile(data);
  } catch (err) {
    console.error(err);
    showToast('Gagal memuat data akun.', 'error');
  }
}

function renderProfile(data) {
  const name = data.username || null;

  profileAvatar.textContent   = name ? name.charAt(0).toUpperCase() : '—';
  profileUsername.textContent = name || dash;
  joinDateText.textContent    = data.joinDate
    ? `Bergabung sejak ${formatJoinDate(data.joinDate)}`
    : 'Bergabung sejak ---';

  statTotalFocus.textContent = data.totalFocusSeconds != null
    ? formatDuration(data.totalFocusSeconds) : dash;
  statTotalRest.textContent  = data.totalRestSeconds != null
    ? formatDuration(data.totalRestSeconds) : dash;
  statBestStreak.textContent = data.bestStreak != null
    ? `${data.bestStreak} hari` : dash;
  statAvgGrade.textContent   = data.averageGrade || dash;
}

/* ═══════════════════════════════════════════════════════
   GANTI PASSWORD
═══════════════════════════════════════════════════════ */
const passwordModalOverlay = document.getElementById('passwordModalOverlay');
const oldPasswordInput     = document.getElementById('oldPassword');
const newPasswordInput     = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const passwordSubmit       = document.getElementById('passwordSubmit');

function openPasswordModal() {
  oldPasswordInput.value = '';
  newPasswordInput.value = '';
  confirmPasswordInput.value = '';
  ['oldPasswordGroup', 'newPasswordGroup', 'confirmPasswordGroup'].forEach(id => {
    document.getElementById(id).classList.remove('has-error');
    document.getElementById(id.replace('Group', 'Error')).textContent = '';
  });
  passwordModalOverlay.classList.add('open');
}

function closePasswordModal() {
  passwordModalOverlay.classList.remove('open');
}

btnChangePassword.addEventListener('click', openPasswordModal);
document.getElementById('passwordModalClose').addEventListener('click', closePasswordModal);
document.getElementById('passwordCancel').addEventListener('click', closePasswordModal);
passwordModalOverlay.addEventListener('click', e => {
  if (e.target === passwordModalOverlay) closePasswordModal();
});

// Toggle show/hide password di semua input modal ganti password
document.querySelectorAll('.input-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const icon   = btn.querySelector('i');
    const hidden = target.type === 'password';
    target.type  = hidden ? 'text' : 'password';
    icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  });
});

passwordSubmit.addEventListener('click', async () => {
  const oldPassword     = oldPasswordInput.value.trim();
  const newPassword     = newPasswordInput.value.trim();
  const confirmPassword = confirmPasswordInput.value.trim();
  let valid = true;

  clearFieldError('oldPasswordGroup', 'oldPasswordError');
  clearFieldError('newPasswordGroup', 'newPasswordError');
  clearFieldError('confirmPasswordGroup', 'confirmPasswordError');

  if (!oldPassword) {
    showFieldError('oldPasswordGroup', 'oldPasswordError', 'Password lama wajib diisi.');
    valid = false;
  }
  if (!newPassword) {
    showFieldError('newPasswordGroup', 'newPasswordError', 'Password baru wajib diisi.');
    valid = false;
  } else if (newPassword.length < 6) {
    showFieldError('newPasswordGroup', 'newPasswordError', 'Minimal 6 karakter.');
    valid = false;
  }
  if (newPassword && confirmPassword !== newPassword) {
    showFieldError('confirmPasswordGroup', 'confirmPasswordError', 'Konfirmasi tidak cocok.');
    valid = false;
  }

  if (!valid) return;

  setBtnLoading(passwordSubmit, true);

  try {
    const res  = await fetch('/api/account/change-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ oldPassword, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      showFieldError('oldPasswordGroup', 'oldPasswordError', data.error || 'Gagal mengubah password.');
      return;
    }

    closePasswordModal();
    showToast('Password berhasil diubah!', 'success');

  } catch (err) {
    showToast('Terjadi kesalahan. Coba lagi.', 'error');
  } finally {
    setBtnLoading(passwordSubmit, false);
  }
});

/* ═══════════════════════════════════════════════════════
   LOGOUT
═══════════════════════════════════════════════════════ */
const logoutModalOverlay = document.getElementById('logoutModalOverlay');

btnLogoutAccount.addEventListener('click', () => logoutModalOverlay.classList.add('open'));
document.getElementById('logoutCancel').addEventListener('click', () => logoutModalOverlay.classList.remove('open'));
logoutModalOverlay.addEventListener('click', e => {
  if (e.target === logoutModalOverlay) logoutModalOverlay.classList.remove('open');
});

document.getElementById('logoutConfirm').addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch(e) {}
  window.location.href = '/login';
});

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function showFieldError(groupId, errorId, msg) {
  document.getElementById(groupId).classList.add('has-error');
  document.getElementById(errorId).textContent = msg;
}
function clearFieldError(groupId, errorId) {
  document.getElementById(groupId).classList.remove('has-error');
  document.getElementById(errorId).textContent = '';
}

function setBtnLoading(btn, state) {
  btn.classList.toggle('loading', state);
  btn.disabled = state;
}

function formatJoinDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
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

/* ═══════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════ */
loadAccountData();

