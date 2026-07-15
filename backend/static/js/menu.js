/**
 * StudyFlow — menu.js
 * Fetch user data dari /api/me
 * Hamburger drawer menu
 */

const greetingName    = document.getElementById('greetingName');
const avatarInitial   = document.getElementById('avatarInitial');
const profileUsername = document.getElementById('profileUsername');
const profileGrade    = document.getElementById('profileGrade');
const statStreak      = document.getElementById('statStreak');
const statGrade       = document.getElementById('statGrade');
const statDays        = document.getElementById('statDays');
const btnLogout       = document.getElementById('btnLogout');
const btnHamburger    = document.getElementById('btnHamburger');
const drawer          = document.getElementById('drawer');
const drawerOverlay   = document.getElementById('drawerOverlay');
const drawerClose     = document.getElementById('drawerClose');
const drawerLogout    = document.getElementById('drawerLogout');
const drawerAvatar    = document.getElementById('drawerAvatar');
const drawerUsername  = document.getElementById('drawerUsername');
const drawerGrade     = document.getElementById('drawerGrade');

const dash = '---';

/* ── Render user ─────────────────────────────────────────── */
function renderUser(user) {
  const name  = user.username || null;
  const grade = user.grade || null;
  const initial = name ? name.charAt(0).toUpperCase() : '—';

  // Navbar & greeting
  greetingName.textContent    = name || dash;
  avatarInitial.textContent   = initial;
  profileUsername.textContent = name || dash;
  profileGrade.innerHTML      = `<i class="fa-solid fa-star"></i> Grade ${grade || dash}`;

  // Stats
  statStreak.textContent = user.streak != null ? `Hari ke-${user.streak}` : dash;
  statGrade.textContent  = grade || dash;
  statDays.textContent   = user.days != null ? user.days : dash;

  // Drawer user info
  drawerAvatar.textContent   = initial;
  drawerUsername.textContent = name || dash;
  drawerGrade.textContent    = grade ? `Grade ${grade}` : 'Grade ---';
}

/* ── Fetch user dari backend ─────────────────────────────── */
async function loadUser() {
  try {
    const res = await fetch('/api/me');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();
    renderUser(data.user);
  } catch (err) {
    console.error('Gagal load user:', err);
  }
}

/* ── Logout ──────────────────────────────────────────────── */
async function doLogout() {
  try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
  window.location.href = '/login';
}

btnLogout.addEventListener('click', doLogout);
drawerLogout.addEventListener('click', doLogout);

/* ── Drawer ──────────────────────────────────────────────── */
function openDrawer() {
  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

btnHamburger.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// Close drawer on ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
});

/* ── Init ────────────────────────────────────────────────── */
loadUser();

