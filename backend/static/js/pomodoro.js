/**
 * StudyFlow — pomodoro.js
 * Timestamp-based timer (ga reset pas refresh/tutup tab)
 * State disimpan di backend per-user (belum ada backend = pakai in-memory dulu,
 * struktur function sudah siap tinggal disambungkan ke fetch API)
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
  dateKey:    todayKey(),
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
function init() {
  loadTodayFromStorage();  // sementara localStorage-scoped by date, siap diganti fetch API
  restoreRunningTimer();   // cek ada timer aktif yg belum selesai (dari sebelum refresh)
  bindEvents();
  applyModeUI();
  renderTomatoes();
  renderStats();
  updateSliderUI();
  updateTimerDisplay(state.duration * 60);
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
function startTimer() {
  const totalSeconds = state.isPaused
    ? state.remainingAtPause
    : state.duration * 60;

  state.endTime  = Date.now() + totalSeconds * 1000;
  state.isRunning = true;
  state.isPaused  = false;

  persistRunningTimer();

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

function pauseTimer() {
  const remaining = Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  state.remainingAtPause = remaining;
  state.isRunning = false;
  state.isPaused  = true;

  clearInterval(state.tickInterval);
  clearRunningTimer();

  playPauseIcon.className = 'fa-solid fa-play';
  btnPlayPause.title      = 'Lanjutkan';
  timerStatus.textContent = 'Dijeda';
  timerStatus.className   = 'timer-status';
}

function resetTimer() {
  clearInterval(state.tickInterval);
  clearRunningTimer();

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
function onTimerComplete() {
  state.isRunning = false;
  clearRunningTimer();

  const elapsedSec = state.duration * 60;
  recordSession(elapsedSec);

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
function skipTimer() {
  if (!state.isRunning && !state.isPaused) return;

  const totalPlanned = state.duration * 60;
  const remaining = state.isPaused
    ? state.remainingAtPause
    : Math.max(0, Math.round((state.endTime - Date.now()) / 1000));
  const elapsedSec = totalPlanned - remaining;

  clearInterval(state.tickInterval);
  clearRunningTimer();

  if (elapsedSec >= 30) { // minimal 30 detik biar ga di-skip sia-sia
    recordSession(elapsedSec);
    showToast('Sesi dicatat sebagian ✅', 'info');
  }

  resetTimer();
}

/* ═══════════════════════════════════════════════════════
   RECORD SESSION → update tomat + stats
   (nanti tinggal ganti body function ini jadi fetch POST /api/pomodoro/complete)
═══════════════════════════════════════════════════════ */
function recordSession(elapsedSec) {
  ensureTodayFresh();

  if (state.mode === 'focus') {
    today.focusSec += elapsedSec;
    if (today.tomatoes < MAX_TOMATOES) {
      today.tomatoes += 1;
    }
  } else {
    today.restSec += elapsedSec;
  }

  saveTodayToStorage();
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
   PERSIST RUNNING TIMER (resume setelah refresh/tutup tab)
   NOTE: sementara localStorage per-key khusus timer,
   nanti diganti fetch ke backend biar sinkron antar device
═══════════════════════════════════════════════════════ */
const TIMER_KEY = 'sf_pomodoro_running_v1';

function persistRunningTimer() {
  localStorage.setItem(TIMER_KEY, JSON.stringify({
    mode:     state.mode,
    duration: state.duration,
    endTime:  state.endTime,
  }));
}

function clearRunningTimer() {
  localStorage.removeItem(TIMER_KEY);
}

function restoreRunningTimer() {
  const raw = localStorage.getItem(TIMER_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    const remaining = Math.round((saved.endTime - Date.now()) / 1000);

    if (remaining <= 0) {
      // Timer udah abis pas app ditutup — anggap selesai, catat sesi penuh
      clearRunningTimer();
      state.mode     = saved.mode;
      state.duration = saved.duration;
      applyModeUI();
      recordSession(saved.duration * 60);
      showToast('Sesi sebelumnya selesai saat kamu pergi 🎉', 'info');
      return;
    }

    // Masih ada sisa waktu — resume timer
    state.mode     = saved.mode;
    state.duration = saved.duration;
    state.endTime  = saved.endTime;
    state.isRunning = true;

    durationSlider.value = state.duration;

    sliderSection.classList.add('disabled');
    btnFocusMode.disabled = true;
    btnRestMode.disabled  = true;
    btnReset.disabled     = false;

    playPauseIcon.className = 'fa-solid fa-pause';
    timerStatus.textContent = state.mode === 'focus' ? 'Sedang fokus...' : 'Sedang istirahat...';
    timerStatus.className   = 'timer-status running';

    tickLoop();
  } catch(e) {
    clearRunningTimer();
  }
}

/* ═══════════════════════════════════════════════════════
   TODAY'S STATS + TOMATOES (reset otomatis per hari)
   NOTE: sementara localStorage, nanti diganti fetch ke backend
═══════════════════════════════════════════════════════ */
const TODAY_KEY = 'sf_pomodoro_today_v1';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadTodayFromStorage() {
  const raw = localStorage.getItem(TODAY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.dateKey === todayKey()) {
        today = parsed;
        return;
      }
    } catch(e) {}
  }
  // Hari baru atau belum ada data → reset
  today = { tomatoes: 0, focusSec: 0, restSec: 0, dateKey: todayKey() };
  saveTodayToStorage();
}

function ensureTodayFresh() {
  if (today.dateKey !== todayKey()) {
    today = { tomatoes: 0, focusSec: 0, restSec: 0, dateKey: todayKey() };
  }
}

function saveTodayToStorage() {
  localStorage.setItem(TODAY_KEY, JSON.stringify(today));
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

  // Minta izin notifikasi sekali di awal (non-blocking)
  if ('Notification' in window && Notification.permission === 'default') {
    // Delay dikit biar ga langsung nge-prompt pas load
    setTimeout(() => {
      // Tunggu interaksi user pertama sebelum minta izin (best practice)
    }, 1000);
  }

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

// Re-check freshness kalau tab dibuka lagi setelah lewat tengah malam
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    ensureTodayFresh();
    loadTodayFromStorage();
    renderTomatoes();
    renderStats();
  }
});

