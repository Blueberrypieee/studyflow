/**
 * StudyFlow — progress.js
 * Baca dari /api/quiz/sessions (real backend)
 * 5 sections: stats, score chart, grade dist, streak calendar, weak topics
 */

const DAY = 86400000;
let SESSIONS = [];

/* ═══════════════════════════════════════════════════════
   LOAD DATA dari backend
═══════════════════════════════════════════════════════ */
async function loadAndRender() {
  try {
    const res  = await fetch('/api/quiz/sessions');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();
    SESSIONS   = data.sessions || [];
  } catch(err) {
    console.error('Gagal load sessions:', err);
    SESSIONS = [];
  }

  renderStats();
  renderGradeDist();
  renderCalendar();
  renderWeakTopics();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => renderScoreChart());
  });
}

function getSessions()    { return SESSIONS; }
function getAllMistakes()  { return SESSIONS.flatMap(s => (s.mistakes || []).map(m => ({ ...m, material: s.material, date: s.date }))); }

/* ═══════════════════════════════════════════════════════
   ① STATISTIK RINGKAS
═══════════════════════════════════════════════════════ */
function renderStats() {
  const sessions  = getSessions();
  const total     = sessions.length;
  const totalTime = sessions.reduce((s, x) => s + (x.durationSec || 0), 0);
  const avgPct    = total ? Math.round(sessions.reduce((s, x) => s + x.pct, 0) / total) : 0;
  const bestGrade = calcBestGrade(sessions);

  const items = [
    { icon: 'fa-list-check', color: 'blue',   val: total,             key: 'Total Quiz' },
    { icon: 'fa-bullseye',   color: 'green',  val: `${avgPct}%`,      key: 'Rata-rata Skor' },
    { icon: 'fa-clock',      color: 'amber',  val: formatTime(totalTime), key: 'Total Waktu' },
    { icon: 'fa-trophy',     color: 'purple', val: bestGrade || '—',  key: 'Grade Terbaik' },
  ];

  document.getElementById('statsGrid').innerHTML = items.map(item => `
    <div class="stat-card">
      <div class="stat-card-icon ${item.color}">
        <i class="fa-solid ${item.icon}"></i>
      </div>
      <div class="stat-card-info">
        <span class="stat-card-val">${item.val}</span>
        <span class="stat-card-key">${item.key}</span>
      </div>
    </div>`).join('');
}

function calcBestGrade(sessions) {
  const order = ['S','A','B','C','D'];
  for (const g of order) {
    if (sessions.find(s => s.grade === g)) return g;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════
   ② GRAFIK SKOR — vanilla Canvas
═══════════════════════════════════════════════════════ */
function renderScoreChart() {
  const sessions = getSessions()
    .slice().sort((a, b) => a.date - b.date).slice(-12);

  const canvas  = document.getElementById('scoreChart');
  const emptyEl = document.getElementById('chartEmpty');

  if (!sessions.length) {
    canvas.style.display  = 'none';
    emptyEl.style.display = 'flex';
    return;
  }

  const ctx  = canvas.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const wrap = canvas.parentElement;
  const W    = wrap.clientWidth;
  const H    = wrap.clientHeight || 180;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const padL = 36, padR = 16, padT = 16, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const scores = sessions.map(s => s.pct);
  const labels = sessions.map(s => fmtShortDate(s.date));

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth   = 1;
  [0, 25, 50, 75, 100].forEach(v => {
    const y = padT + chartH - (v / 100) * chartH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillStyle = '#94A3B8';
    ctx.font = `10px Poppins, system-ui`;
    ctx.textAlign = 'right';
    ctx.fillText(`${v}%`, padL - 6, y + 4);
  });

  const pts = scores.map((s, i) => ({
    x: padL + (i / Math.max(scores.length - 1, 1)) * chartW,
    y: padT + chartH - (s / 100) * chartH,
  }));

  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(59,130,246,.22)');
  grad.addColorStop(1, 'rgba(59,130,246,0)');

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cx, pts[i-1].y, cx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length-1].x, padT + chartH);
  ctx.lineTo(pts[0].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const cx = (pts[i-1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(cx, pts[i-1].y, cx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

  pts.forEach((pt, i) => {
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5, 0, Math.PI*2); ctx.fillStyle='#3B82F6'; ctx.fill();
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI*2); ctx.fillStyle='#FFFFFF'; ctx.fill();
    ctx.fillStyle='#334155'; ctx.font='600 10px Poppins,system-ui'; ctx.textAlign='center';
    ctx.fillText(`${scores[i]}%`, pt.x, pt.y - 10);
    ctx.fillStyle='#94A3B8'; ctx.font='10px Poppins,system-ui';
    ctx.fillText(labels[i], pt.x, padT + chartH + 18);
  });
}

/* ═══════════════════════════════════════════════════════
   ③ DISTRIBUSI GRADE
═══════════════════════════════════════════════════════ */
function renderGradeDist() {
  const sessions = getSessions();
  const grades   = ['S','A','B','C','D'];
  const counts   = {};
  grades.forEach(g => counts[g] = 0);
  sessions.forEach(s => { if (counts[s.grade] !== undefined) counts[s.grade]++; });
  const max = Math.max(...Object.values(counts), 1);

  document.getElementById('gradeBars').innerHTML = grades.map(g => `
    <div class="grade-bar-row">
      <div class="grade-bar-label gl-${g}">${g}</div>
      <div class="grade-bar-track">
        <div class="grade-bar-fill gf-${g}" style="width:0%"
             data-target="${(counts[g]/max*100).toFixed(1)}"></div>
      </div>
      <span class="grade-bar-count">${counts[g]}x</span>
    </div>`).join('');

  requestAnimationFrame(() => {
    document.querySelectorAll('.grade-bar-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  });
}

/* ═══════════════════════════════════════════════════════
   ④ STREAK CALENDAR
═══════════════════════════════════════════════════════ */
function renderCalendar() {
  const sessions = getSessions();
  const WEEKS    = 15;
  const now      = new Date();
  const todayKey = dateKey(now);

  const quizPerDay = {};
  sessions.forEach(s => {
    const k = dateKey(new Date(s.date));
    quizPerDay[k] = (quizPerDay[k] || 0) + 1;
  });

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (WEEKS*7 - 1));
  const dow = startDate.getDay();
  startDate.setDate(startDate.getDate() - dow);

  const cells = [];
  const cur   = new Date(startDate);
  for (let i = 0; i < WEEKS*7; i++) {
    const k     = dateKey(cur);
    const count = quizPerDay[k] || 0;
    const lv    = count===0?0:count===1?1:count===2?2:count<=3?3:4;
    cells.push({ key:k, count, lv, isToday: k===todayKey });
    cur.setDate(cur.getDate() + 1);
  }

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  grid.style.gridTemplateColumns = `repeat(${WEEKS}, 1fr)`;

  cells.forEach(c => {
    const el = document.createElement('div');
    el.className = `cal-cell lv-${c.lv}${c.isToday?' today':''}`;
    el.title     = `${c.key}: ${c.count} quiz`;
    grid.appendChild(el);
  });

  document.getElementById('calendarWrap').innerHTML = '';
  document.getElementById('calendarWrap').appendChild(grid);
  document.getElementById('calendarWrap').scrollLeft = 99999;

  let streak = 0;
  const check = new Date(now);
  while (true) {
    const k = dateKey(check);
    if (quizPerDay[k]) { streak++; check.setDate(check.getDate() - 1); }
    else break;
  }
  document.getElementById('streakCount').textContent = streak;
}

/* ═══════════════════════════════════════════════════════
   ⑤ TOPIK TERLEMAH
═══════════════════════════════════════════════════════ */
function renderWeakTopics() {
  const mistakes  = getAllMistakes();
  const weakEmpty = document.getElementById('weakEmpty');
  const weakList  = document.getElementById('weakList');

  if (!mistakes.length) {
    weakList.innerHTML = '';
    weakEmpty.style.display = 'flex';
    return;
  }
  weakEmpty.style.display = 'none';

  const byMaterial = {};
  mistakes.forEach(m => {
    const key = m.material || 'Tidak diketahui';
    byMaterial[key] = (byMaterial[key] || 0) + 1;
  });

  const sorted = Object.entries(byMaterial).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const max    = sorted[0][1];

  weakList.innerHTML = sorted.map(([mat, count], i) => `
    <div class="weak-card" style="animation-delay:${i*0.06}s">
      <div class="weak-card-top">
        <div class="weak-rank rank-${i+1}">${i+1}</div>
        <span class="weak-material" title="${escHtml(mat)}">${escHtml(mat)}</span>
        <span class="weak-count">${count} salah</span>
      </div>
      <div class="weak-bar-track">
        <div class="weak-bar-fill" style="width:0%" data-target="${(count/max*100).toFixed(1)}"></div>
      </div>
    </div>`).join('');

  requestAnimationFrame(() => {
    document.querySelectorAll('.weak-bar-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  });
}

/* ═══════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════ */
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtShortDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth()+1}`;
}
function formatTime(sec) {
  if (!sec) return '0m';
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}
function escHtml(str='') {
  return String(str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ═══════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════ */
loadAndRender();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderScoreChart, 200);
});

