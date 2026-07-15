const registerForm   = document.getElementById('registerForm');
const usernameInput  = document.getElementById('username');
const passwordInput  = document.getElementById('password');
const toggleBtn      = document.getElementById('togglePassword');
const eyeIcon        = document.getElementById('eyeIcon');
const registerBtn    = document.getElementById('registerBtn');
const toastContainer = document.getElementById('toastContainer');
const strengthFill   = document.getElementById('strengthFill');
const strengthLabel  = document.getElementById('strengthLabel');
const strengthWrap   = document.getElementById('strengthWrap');

toggleBtn.addEventListener('click', () => {
  const hidden = passwordInput.type === 'password';
  passwordInput.type = hidden ? 'text' : 'password';
  eyeIcon.className  = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
  passwordInput.focus();
});

usernameInput.addEventListener('input', () => clearError('usernameGroup', 'usernameError'));
passwordInput.addEventListener('input', () => {
  clearError('passwordGroup', 'passwordError');
  updateStrength(passwordInput.value);
});

function updateStrength(val) {
  if (!val) { strengthWrap.classList.remove('visible'); return; }
  strengthWrap.classList.add('visible');
  let score = 0;
  if (val.length >= 6) score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { pct:'25%', color:'#EF4444', label:'Lemah', textColor:'#EF4444' },
    { pct:'50%', color:'#F59E0B', label:'Cukup', textColor:'#F59E0B' },
    { pct:'75%', color:'#3B82F6', label:'Bagus', textColor:'#3B82F6' },
    { pct:'100%',color:'#22C55E', label:'Kuat',  textColor:'#22C55E' },
  ];
  const idx = Math.min(Math.floor((score-1)/1.25),3);
  const lvl = levels[Math.max(idx,0)];
  strengthFill.style.width      = lvl.pct;
  strengthFill.style.background = lvl.color;
  strengthLabel.textContent     = lvl.label;
  strengthLabel.style.color     = lvl.textColor;
}

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  let valid = true;

  if (!username) { showError('usernameGroup','usernameError','Username tidak boleh kosong.'); valid=false; }
  else if (username.length < 6) { showError('usernameGroup','usernameError','Username minimal 6 karakter.'); valid=false; }

  if (!password) { showError('passwordGroup','passwordError','Password tidak boleh kosong.'); valid=false; }
  else if (password.length < 6) { showError('passwordGroup','passwordError','Password minimal 6 karakter.'); valid=false; }

  if (!valid) { shakeCard(); return; }

  setLoading(true);

  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registrasi gagal.');
    showToast('Akun berhasil dibuat! Selamat datang 🎉', 'success');
    setTimeout(() => { window.location.href = '/login'; }, 1300);
  } catch (err) {
    setLoading(false);
    showToast(err.message, 'error');
    shakeCard();
  }
});

function showError(groupId, errorId, msg) {
  document.getElementById(groupId).classList.add('has-error');
  document.getElementById(errorId).textContent = msg;
}
function clearError(groupId, errorId) {
  document.getElementById(groupId).classList.remove('has-error');
  document.getElementById(errorId).textContent = '';
}
function setLoading(state) {
  registerBtn.classList.toggle('loading', state);
  registerBtn.disabled = state;
}
function shakeCard() {
  const card = document.querySelector('.auth-card');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'shake .4s ease';
  card.addEventListener('animationend', () => { card.style.animation=''; }, { once:true });
}
function showToast(message, type='info', duration=3200) {
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${message}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove(), { once:true });
  }, duration);
}
(function() {
  const s = document.createElement('style');
  s.textContent = `@keyframes shake {0%,100%{transform:translateX(0)}18%{transform:translateX(-8px)}36%{transform:translateX(8px)}54%{transform:translateX(-6px)}72%{transform:translateX(6px)}88%{transform:translateX(-3px)}}`;
  document.head.appendChild(s);
})();
