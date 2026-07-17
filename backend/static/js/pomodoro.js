/**
 * StudyFlow — pomodoro.js
 * Timestamp-based timer (ga reset pas refresh/tutup tab)
 * State disimpan di backend per-user via fetch API
 */

/* ═══════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════ */
const RING_CIRCUMFERENCE = 678.6; // 2 * PI * 108
const MAX_TOMATOES = 3;

const MODE_COLORS = {
  focus: { color: '#3B82F6', dark: '#1D4ED8', bg: '#EFF6FF' },
  rest:  { color: '#22C55E', dark: '#15803D', bg: '#F0FDF4' },
};

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
let state = {
  mode:        'focus',   // 'focus' | 'rest'
  duration:    25,        // menit, dipilih dari slider
  isRunning:   false,
  isPaused:    false,
  endTime:     null,      // timestamp (ms) kapan timer akan selesai
  remainingAtPause: null, // sisa detik saat di-pause
  tickInterval: null,
};

let today = {
  tomatoes:   0,
  focusSec:   0,
  restSec:    0,
};

/* ═══════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════ */
const btnFocusMode   = document.getElementById('btnFocusMode');
const btnRestMode    = document.getElementById('btnRestMode');
const durationSlider = document.getElementById('durationSlider');
const sliderValue    = document.getElementById('sliderValue');
const sliderSection  = document.querySelector('.slider-section');

const timerRingWrap  = document.getElementById('timerRingWrap');
const ringProgress   = document.getElementById('ringProgress');
const timerTime      = document.getElementById('timerTime');
const timerStatus    = document.getElementById('timerStatus');

const btnPlayPause   = document.getElementById('btnPlayPause');
const playPauseIcon  = document.getElementById('playPauseIcon');
const btnReset       = document.getElementById('btnReset');
const btnSkip        = document.getElementById('btnSkip');

const tomatoRow       = document.getElementById('tomatoRow');
const tomatoCaption   = document.getElementById('tomatoCaption');
const statFocusTime   = document.getElementById('statFocusTime');
const statRestTime    = document.getElementById('statRestTime');

const btnLofi        = document.getElementById('btnLofi');
const btnRain        = document.getElementById('btnRain');
const lofiAudio       = document.getElementById('lofiAudio');
const rainAudio       = document.getElementById('rainAudio');
const alarmAudio      = document.getElementById('alarmAudio');
const volumeRow       = document.getElementById('volumeRow');
const volumeSlider    = document.getElementById('volumeSlider');

const toastContainer  = document.getElementById('toastContainer');

let activeTrack = null; // 'lofi' | 'rain' | null

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
async function init() {
  bindEvents();
  applyModeUI();
  updateSliderUI();
  updateTimerDisplay(state.duration * 60);

  await loadTodayFromServer();
  await restoreRunningTimer();

  renderTomatoes();
  renderStats();
}

/* ═══════════════════════════════════════════════════════
   MODE TOGGLE (Focus / Rest)
═══════════════════════════════════════════════════════ */
function setMode(mode) {
  if (state.isRunning) {
    showToast('Selesaikan atau reset timer dulu sebelum ganti mode.', 'error');
    return;
  }

  state.mode = mode;
  applyModeUI();
  updateTimerDisplay(state.duration * 60);
}

function applyModeUI() {
  const colors = MODE_COLORS[state.mode];
  document.documentElement.style.setProperty('--mode-color', colors.color);
  document.documentElement.style.setProperty('--mode-color-dark', colors.dark);
  document.documentElement.style.setProperty('--mode-bg', colors.bg);

  btnFocusMode.classList.toggle('active', state.mode === 'focus');
  btnRestMode.classList.toggle('active', state.mode === 'rest');

  document.getElementById('btnPlayPause').title = state.isRunning ? 'Pause' : 'Mulai';
}

/* ═══════════════════════════════════════════════════════
   DURATION SLIDER
═══════════════════════════════════════════════════════ */
durationSlider.addEventListener('input', () => {
  state.duration = parseInt(durationSlider.value);
  updateSliderUI();
  if (!state.isRunning) updateTimerDisplay(state.duration * 60);
});

function updateSliderUI() {
  sliderValue.textContent = `${state.duration} menit`;
}

/* ═══════════════════════════════════════════════════════
   TIMER CORE — timestamp based
═══════════════════════════════════════════════════════ */
async function startTimer() {
  const totalSeconds = state.isPaused
    ? state.remainingAtPause
    : state.duration * 60;

  state.endTime  = Date.now() + totalSeconds * 1000;
  state.isRunning = true;
  state.isPaused  = false;

  await persistRunningTimer();

  sliderSection.classList.add('disabled');
  btnFocusMode.disabled = true;
  btnRestMode.disabled  = true;
  btnReset.disabled     = false;

  playPauseIcon.className = 'fa-solid fa-pause';
  btnPlayPause.title      = 'Pause';
  timerStatus.textContent = state.mode === 'focus' ? 'Sedang fokus...' : 'Sedang istirahat...';
  timerStatus.className   = 'timer-status running';

  tickLoop();
}

async function pauseTimer() {
  const remaining = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  state.remainingAtPause = remaining;
  state.isRunning = false;
  state.isPaused  = true;

  clearInterval(state.tickInterval);

  try {
    await fetch('/api/pomodoro/pause', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ remainingSeconds: remaining }),
    });
  } catch(err) {
    console.error('Gagal pause di server:', err);
  }

  playPauseIcon.className = 'fa-solid fa-play';
  btnPlayPause.title      = 'Lanjutkan';
  timerStatus.textContent = 'Dijeda';
  timerStatus.className   = 'timer-status';
}

async function resetTimer() {
  clearInterval(state.tickInterval);

  state.isRunning = false;
  state.isPaused  = false;
  state.endTime   = null;
  state.remainingAtPause = null;

  try {
    await fetch('/api/pomodoro/reset', { method: 'POST' });
  } catch(err) {
    console.error('Gagal reset di server:', err);
  }

  sliderSection.classList.remove('disabled');
  btnFocusMode.disabled = false;
  btnRestMode.disabled  = false;
  btnReset.disabled     = true;

  playPauseIcon.className = 'fa-solid fa-play';
  btnPlayPause.title      = 'Mulai';
  timerStatus.textContent = 'Siap mulai';
  timerStatus.className   = 'timer-status';
  timerRingWrap.classList.remove('alarm');

  updateTimerDisplay(state.duration * 60);
}

function tickLoop() {
  clearInterval(state.tickInterval);

  state.tickInterval = setInterval(() => {
    const remaining = Math.round((state.endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(state.tickInterval);
      updateTimerDisplay(0);
      onTimerComplete();
      return;
    }

    updateTimerDisplay(remaining);
  }, 250); // update tiap 250ms biar ring smooth, angka tetap detik
}

/* ── Timer selesai (waktu habis alami) ───────────────── */
async function onTimerComplete() {
  state.isRunning = false;

  const elapsedSec = state.duration * 60;
  await recordSession(elapsedSec);

  timerStatus.textContent = 'Waktu habis! 🎉';
  timerStatus.className   = 'timer-status done';
  timerRingWrap.classList.add('alarm');

  playAlarm();
  if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 250]);
  sendBrowserNotification();

  sliderSection.classList.remove('disabled');
  btnFocusMode.disabled = false;
  btnRestMode.disabled  = false;

  playPauseIcon.className = 'fa-solid fa-play';
  btnPlayPause.title      = 'Mulai';

  showToast(
    state.mode === 'focus' ? '🍅 Sesi fokus selesai! Kerja bagus!' : '☕ Istirahat selesai!',
    'success', 4000
  );
}

/* ── Skip / selesaikan lebih awal ────────────────────── */
async function skipTimer() {
  if (!state.isRunning && !state.isPaused) return;

  const totalPlanned = state.duration * 60;
  const remaining = state.isPaused
    ? state.remainingAtPause
    : Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  const elapsedSec = totalPlanned - remaining;

  clearInterval(state.tickInterval);

  if (elapsedSec >= 30) { // minimal 30 detik biar ga di-skip sia-sia
    await recordSession(elapsedSec);
    showToast('Sesi dicatat sebagian ✅', 'info');
  } else {
    try {
      await fetch('/api/pomodoro/reset', { method: 'POST' });
    } catch(err) {}
  }

  resetTimerUIOnly();
}

function resetTimerUIOnly() {
  state.isRunning = false;
  state.isPaused  = false;
  state.endTime   = null;
  state.remainingAtPause = null;

  sliderSection.classList.remove('disabled');
  btnFocusMode.disabled = false;
  btnRestMode.disabled  = false;
  btnReset.disabled     = true;

  playPauseIcon.className = 'fa-solid fa-play';
  btnPlayPause.title      = 'Mulai';
  timerStatus.textContent = 'Siap mulai';
  timerStatus.className   = 'timer-status';
  timerRingWrap.classList.remove('alarm');

  updateTimerDisplay(state.duration * 60);
}

/* ═══════════════════════════════════════════════════════
   RECORD SESSION → POST /api/pomodoro/complete
═══════════════════════════════════════════════════════ */
async function recordSession(elapsedSec) {
  try {
    const res  = await fetch('/api/pomodoro/complete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode: state.mode, elapsedSeconds: elapsedSec }),
    });
    const data = await res.json();

    if (res.ok && data.stats) {
      today.tomatoes = data.stats.tomatoes;
      today.focusSec = data.stats.focusSeconds;
      today.restSec  = data.stats.restSeconds;
    }
  } catch(err) {
    console.error('Gagal simpan sesi ke server:', err);
    showToast('Gagal menyimpan sesi. Cek koneksi.', 'error');
  }

  renderTomatoes();
  renderStats();
}

/* ═══════════════════════════════════════════════════════
   RING & TIME DISPLAY
═══════════════════════════════════════════════════════ */
function updateTimerDisplay(remainingSeconds) {
  const totalSeconds = state.duration * 60;
  const min = Math.floor(remainingSeconds / 60);
  const sec = remainingSeconds % 60;

  timerTime.textContent = `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;

  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1;
  const offset   = RING_CIRCUMFERENCE * (1 - progress);
  ringProgress.style.strokeDashoffset = offset;
}

/* ═══════════════════════════════════════════════════════
   PERSIST RUNNING TIMER → backend (resume antar device)
═══════════════════════════════════════════════════════ */
async function persistRunningTimer() {
  try {
    await fetch('/api/pomodoro/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        mode:            state.mode,
        durationMinutes: state.duration,
        endTime:         state.endTime,
      }),
    });
  } catch(err) {
    console.error('Gagal simpan timer ke server:', err);
    showToast('Gagal menyimpan status timer. Cek koneksi.', 'error');
  }
}

async function restoreRunningTimer() {
  try {
    const res  = await fetch('/api/pomodoro/state');
    if (res.status === 401) { window.location.href = '/login'; return; }

    const data = await res.json();
    const sess = data.session;

    if (!sess || !sess.isRunning || !sess.endTime) return;

    const remaining = Math.round((sess.endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      // Timer udah abis pas app ditutup — anggap selesai, catat sesi penuh
      state.mode     = sess.mode;
      state.duration = sess.durationMinutes;
      applyModeUI();
      durationSlider.value = state.duration;
      updateSliderUI();
      await recordSession(sess.durationMinutes * 60);
      await fetch('/api/pomodoro/reset', { method: 'POST' });
      showToast('Sesi sebelumnya selesai saat kamu pergi 🎉', 'info');
      return;
    }

    // Masih ada sisa waktu — resume timer
    state.mode     = sess.mode;
    state.duration = sess.durationMinutes;
    state.endTime  = sess.endTime;
    state.isRunning = true;

    durationSlider.value = state.duration;
    updateSliderUI();
    applyModeUI();

    sliderSection.classList.add('disabled');
    btnFocusMode.disabled = true;
    btnRestMode.disabled  = true;
    btnReset.disabled     = false;

    playPauseIcon.className = 'fa-solid fa-pause';
    timerStatus.textContent = state.mode === 'focus' ? 'Sedang fokus...' : 'Sedang istirahat...';
    timerStatus.className   = 'timer-status running';

    tickLoop();
  } catch(err) {
    console.error('Gagal restore timer:', err);
  }
}

/* ═══════════════════════════════════════════════════════
   TODAY'S STATS + TOMATOES → GET /api/pomodoro/today
═══════════════════════════════════════════════════════ */
async function loadTodayFromServer() {
  try {
    const res  = await fetch('/api/pomodoro/today');
    if (res.status === 401) { window.location.href = '/login'; return; }

    const data = await res.json();

    if (res.ok && data.stats) {
      today.tomatoes = data.stats.tomatoes;
      today.focusSec = data.stats.focusSeconds;
      today.restSec  = data.stats.restSeconds;
    }
  } catch(err) {
    console.error('Gagal load stats hari ini:', err);
  }
}

function renderTomatoes() {
  const tomatoes = tomatoRow.querySelectorAll('.tomato');
  tomatoes.forEach((el, i) => {
    el.classList.toggle('earned', i < today.tomatoes);
    el.innerHTML = i < today.tomatoes
      ? '<i class="fa-solid fa-apple-whole"></i>'
      : '<i class="fa-solid fa-seedling"></i>';
  });
  tomatoCaption.textContent = `${today.tomatoes} / ${MAX_TOMATOES} sesi fokus selesai hari ini`;
}

function renderStats() {
  statFocusTime.textContent = formatMinutes(today.focusSec);
  statRestTime.textContent  = formatMinutes(today.restSec);
}

function formatMinutes(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}j ${rem}m`;
}

/* ═══════════════════════════════════════════════════════
   NOTIFICATIONS — sound, vibrate, browser notification
═══════════════════════════════════════════════════════ */
function playAlarm() {
  try {
    alarmAudio.currentTime = 0;
    alarmAudio.play().catch(() => {});
  } catch(e) {}
}

function sendBrowserNotification() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification('StudyFlow Pomodoro', {
      body: state.mode === 'focus' ? 'Sesi fokus selesai! Waktunya istirahat 🎉' : 'Istirahat selesai! Siap fokus lagi?',
      icon: '/static/img/icon-192.png',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

/* ═══════════════════════════════════════════════════════
   MUSIC PLAYER
═══════════════════════════════════════════════════════ */
function toggleTrack(track) {
  const audio = track === 'lofi' ? lofiAudio : rainAudio;
  const otherAudio = track === 'lofi' ? rainAudio : lofiAudio;
  const btn = track === 'lofi' ? btnLofi : btnRain;
  const otherBtn = track === 'lofi' ? btnRain : btnLofi;

  // Kalau track ini lagi main → stop
  if (activeTrack === track) {
    audio.pause();
    audio.currentTime = 0;
    btn.classList.remove('playing');
    activeTrack = null;
    volumeRow.style.display = 'none';
    return;
  }

  // Stop track lain kalau ada yang main
  otherAudio.pause();
  otherAudio.currentTime = 0;
  otherBtn.classList.remove('playing');

  // Play track ini
  audio.volume = volumeSlider.value / 100;
  audio.play().catch(() => {
    showToast('Gagal memutar audio. Coba lagi.', 'error');
  });
  btn.classList.add('playing');
  activeTrack = track;
  volumeRow.style.display = 'flex';
}

volumeSlider.addEventListener('input', () => {
  const vol = volumeSlider.value / 100;
  if (activeTrack === 'lofi') lofiAudio.volume = vol;
  if (activeTrack === 'rain') rainAudio.volume = vol;
});

/* ═══════════════════════════════════════════════════════
   BIND EVENTS
═══════════════════════════════════════════════════════ */
function bindEvents() {
  btnFocusMode.addEventListener('click', () => setMode('focus'));
  btnRestMode.addEventListener('click', () => setMode('rest'));

  btnPlayPause.addEventListener('click', () => {
    if (state.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  btnReset.addEventListener('click', resetTimer);
  btnSkip.addEventListener('click', skipTimer);

  btnLofi.addEventListener('click', () => toggleTrack('lofi'));
  btnRain.addEventListener('click', () => toggleTrack('rain'));

  document.addEventListener('click', requestNotifPermissionOnce, { once: true });
}

function requestNotifPermissionOnce() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ═══════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════ */
function showToast(message, type = 'info', duration = 3000) {
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
init();

// Re-check stats kalau tab dibuka lagi (misal lewat tengah malam, backend yang handle reset)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadTodayFromServer().then(() => {
      renderTomatoes();
      renderStats();
    });
  }
});

