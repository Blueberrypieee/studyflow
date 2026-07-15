const loginForm      = document.getElementById('loginForm');
const usernameInput  = document.getElementById('username');
const passwordInput  = document.getElementById('password');
const toggleBtn      = document.getElementById('togglePassword');
const eyeIcon        = document.getElementById('eyeIcon');
const loginBtn       = document.getElementById('loginBtn');
const rememberMe     = document.getElementById('rememberMe');
const toastContainer = document.getElementById('toastContainer');

toggleBtn.addEventListener('click', () => {
  const isHidden = passwordInput.type === 'password';
  passwordInput.type = isHidden ? 'text' : 'password';
  eyeIcon.className  = isHidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  passwordInput.focus();
});

(function restoreSession() {
  const saved = localStorage.getItem('sf_remember_username');
  if (saved) { usernameInput.value = saved; rememberMe.checked = true; }
})();

usernameInput.addEventListener('input', () => clearError('usernameGroup', 'usernameError'));
passwordInput.addEventListener('input', () => clearError('passwordGroup', 'passwordError'));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  let valid = true;

  if (!username) { showError('usernameGroup', 'usernameError', 'Username tidak boleh kosong.'); valid = false; }
  else if (username.length < 6) { showError('usernameGroup', 'usernameError', 'Username minimal 6 karakter.'); valid = false; }

  if (!password) { showError('passwordGroup', 'passwordError', 'Password tidak boleh kosong.'); valid = false; }
  else if (password.length < 6) { showError('passwordGroup', 'passwordError', 'Password minimal 6 karakter.'); valid = false; }

  if (!valid) { shakeCard(); return; }

  if (rememberMe.checked) localStorage.setItem('sf_remember_username', username);
  else localStorage.removeItem('sf_remember_username');

  setLoading(true);

  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal.');
    localStorage.setItem('sf_username', data.user.username);
    showToast('Login berhasil! Selamat belajar 🚀', 'success');
    setTimeout(() => { window.location.href = '/menu'; }, 1200);
  } catch (err) {
    setLoading(false);
    showToast(err.message, 'error');
    shakeCard();
  }
});

function showError(groupId, errorId, message) {
  document.getElementById(groupId).classList.add('has-error');
  document.getElementById(errorId).textContent = message;
}
function clearError(groupId, errorId) {
  document.getElementById(groupId).classList.remove('has-error');
  document.getElementById(errorId).textContent = '';
}
function setLoading(state) {
  loginBtn.classList.toggle('loading', state);
  loginBtn.disabled = state;
}
function shakeCard() {
  const card = document.querySelector('.auth-card');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'shake .4s ease';
  card.addEventListener('animationend', () => { card.style.animation = ''; }, { once: true });
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
(function() {
  const s = document.createElement('style');
  s.textContent = `@keyframes shake {0%,100%{transform:translateX(0)}18%{transform:translateX(-8px)}36%{transform:translateX(8px)}54%{transform:translateX(-6px)}72%{transform:translateX(6px)}88%{transform:translateX(-3px)}}`;
  document.head.appendChild(s);
})();
