/**
 * StudyFlow — quiz-play.js
 * Baca soal dari sessionStorage (dikirim quiz.js setelah generate)
 * Setelah selesai → save hasil ke /api/quiz/save → history
 */

const LETTERS   = ['A', 'B', 'C', 'D'];
const TIMER_SEC = 30;

/* ═══════════════════════════════════════════════════════
   LOAD QUESTIONS dari sessionStorage
═══════════════════════════════════════════════════════ */
let QUESTIONS = [];
let MATERIAL  = '';

(function loadFromSession() {
  const raw = sessionStorage.getItem('sf_quiz_questions');
  MATERIAL  = sessionStorage.getItem('sf_quiz_material') || 'Unknown';

  if (!raw) {
    // Kalau ga ada soal → redirect balik ke quiz
    alert('Soal tidak ditemukan. Silakan upload materi terlebih dahulu.');
    window.location.href = '/quiz';
    return;
  }

  try {
    QUESTIONS = JSON.parse(raw);
  } catch(e) {
    alert('Data soal rusak. Silakan coba lagi.');
    window.location.href = '/quiz';
  }
})();

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
const state = {
  current:   0,
  answered:  false,
  results:   [],
  timerVal:  TIMER_SEC,
  timerRef:  null,
  startTime: Date.now(),
};

/* ═══════════════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════════════ */
const screenQuiz    = document.getElementById('screenQuiz');
const screenResult  = document.getElementById('screenResult');
const progressFill  = document.getElementById('progressFill');
const qCounter      = document.getElementById('qCounter');
const timerDisplay  = document.getElementById('timerDisplay');
const timerWrap     = document.getElementById('timerWrap');
const qNum          = document.getElementById('qNum');
const questionText  = document.getElementById('questionText');
const optionsGrid   = document.getElementById('optionsGrid');
const btnNext       = document.getElementById('btnNext');
const toastContainer= document.getElementById('toastContainer');

/* ═══════════════════════════════════════════════════════
   QUIZ ENGINE
═══════════════════════════════════════════════════════ */
function loadQuestion() {
  if (!QUESTIONS.length) return;

  const q       = QUESTIONS[state.current];
  const total   = QUESTIONS.length;
  const progress= (state.current / total) * 100;

  state.answered = false;

  qCounter.textContent     = `${state.current + 1} / ${total}`;
  qNum.textContent         = state.current + 1;
  progressFill.style.width = `${progress}%`;
  timerWrap.classList.remove('warning', 'danger');
  btnNext.classList.remove('visible');

  const card = document.getElementById('questionCard');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'cardIn .4s cubic-bezier(.34,1.56,.64,1) both';

  questionText.textContent = q.question;

  optionsGrid.innerHTML = q.options.map((opt, i) => `
    <button class="option-btn" data-index="${i}" style="animation-delay:${i * 0.07}s">
      <span class="option-letter">${LETTERS[i]}</span>
      <span class="option-text">${opt}</span>
      <span class="option-feedback"></span>
    </button>
  `).join('');

  optionsGrid.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => onAnswer(parseInt(btn.dataset.index)));
  });

  btnNext.querySelector('#btnNextLabel').textContent =
    state.current === total - 1 ? 'Lihat Hasil' : 'Soal Berikutnya';

  startTimer();
}

/* ── Answer handler ─────────────────────────────────── */
function onAnswer(chosen) {
  if (state.answered) return;
  state.answered = true;
  stopTimer();

  const q       = QUESTIONS[state.current];
  const correct = chosen === q.answer;

  state.results.push({ questionIdx: state.current, chosen, correct });

  optionsGrid.querySelectorAll('.option-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.index);
    btn.disabled = true;
    if (idx === q.answer) {
      btn.classList.add('correct');
      btn.querySelector('.option-feedback').innerHTML =
        '<i class="fa-solid fa-circle-check" style="color:var(--green-500)"></i>';
    } else if (idx === chosen && !correct) {
      btn.classList.add('wrong');
      btn.querySelector('.option-feedback').innerHTML =
        '<i class="fa-solid fa-circle-xmark" style="color:var(--red-500)"></i>';
    }
  });

  showToast(
    correct ? '✅ Benar! Mantap!' : '❌ Salah. Jangan menyerah!',
    correct ? 'success' : 'error',
    1800
  );

  btnNext.classList.add('visible');
}

/* ── Next / finish ──────────────────────────────────── */
btnNext.addEventListener('click', () => {
  if (!state.answered) {
    state.results.push({ questionIdx: state.current, chosen: null, correct: false });
  }
  state.current++;
  if (state.current >= QUESTIONS.length) {
    showResult();
  } else {
    loadQuestion();
  }
});

/* ═══════════════════════════════════════════════════════
   TIMER
═══════════════════════════════════════════════════════ */
function startTimer() {
  state.timerVal = TIMER_SEC;
  timerDisplay.textContent = state.timerVal;

  state.timerRef = setInterval(() => {
    state.timerVal--;
    timerDisplay.textContent = state.timerVal;

    if (state.timerVal <= 10) timerWrap.classList.add('warning');
    if (state.timerVal <= 5)  { timerWrap.classList.add('danger'); timerWrap.classList.remove('warning'); }

    if (state.timerVal <= 0) {
      stopTimer();
      if (!state.answered) {
        showToast('⏰ Waktu habis!', 'error', 1800);
        optionsGrid.querySelectorAll('.option-btn').forEach(btn => {
          btn.disabled = true;
          if (parseInt(btn.dataset.index) === QUESTIONS[state.current].answer) {
            btn.classList.add('reveal');
            btn.querySelector('.option-feedback').innerHTML =
              '<i class="fa-solid fa-circle-check" style="color:var(--green-500)"></i>';
          }
        });
        state.answered = true;
        btnNext.classList.add('visible');
      }
    }
  }, 1000);
}

function stopTimer() { clearInterval(state.timerRef); }

/* ═══════════════════════════════════════════════════════
   SAVE SESSION → /api/quiz/save
═══════════════════════════════════════════════════════ */
async function saveSession(correct, wrong, pct, grade, durationSec) {
  const mistakes = state.results
    .filter(r => !r.correct)
    .map(r => {
      const q = QUESTIONS[r.questionIdx];
      return {
        question: q.question,
        options:  q.options,
        answer:   q.answer,
        chosen:   r.chosen,
        material: MATERIAL,
      };
    });

  try {
    await fetch('/api/quiz/save', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        material:    MATERIAL,
        total:       QUESTIONS.length,
        correct,
        wrong,
        pct,
        grade,
        durationSec,
        mistakes,
      }),
    });
    console.log('[QUIZ] Session saved');
    // Bersihkan sessionStorage setelah selesai
    sessionStorage.removeItem('sf_quiz_questions');
    sessionStorage.removeItem('sf_quiz_material');
  } catch(err) {
    console.error('[QUIZ] Failed to save session:', err);
  }
}

/* ═══════════════════════════════════════════════════════
   RESULT SCREEN
═══════════════════════════════════════════════════════ */
function showResult() {
  stopTimer();
  progressFill.style.width = '100%';

  const total       = QUESTIONS.length;
  const correct     = state.results.filter(r => r.correct).length;
  const wrong       = total - correct;
  const pct         = Math.round((correct / total) * 100);
  const grade       = calcGrade(pct);
  const durationSec = Math.round((Date.now() - state.startTime) / 1000);

  // Save ke backend
  saveSession(correct, wrong, pct, grade, durationSec);

  screenQuiz.classList.add('hidden');
  screenResult.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const gradeRing   = document.getElementById('gradeRing');
  const gradeLetter = document.getElementById('gradeLetter');
  const gradeLabel  = document.getElementById('gradeLabel');

  gradeRing.className     = `grade-ring ${grade}`;
  gradeLetter.textContent = grade;

  const labels = { S:'🏆 Sempurna!', A:'🌟 Luar Biasa!', B:'👍 Bagus!', C:'😊 Cukup!', D:'💪 Terus Berlatih!' };
  gradeLabel.textContent = labels[grade];

  animateCount(document.getElementById('resCorrect'), correct);
  animateCount(document.getElementById('resWrong'), wrong);
  animateCountPct(document.getElementById('resPct'), pct);

  buildReview();
}

function calcGrade(pct) {
  if (pct === 100) return 'S';
  if (pct >= 80)   return 'A';
  if (pct >= 60)   return 'B';
  if (pct >= 40)   return 'C';
  return 'D';
}

function buildReview() {
  const list = document.getElementById('reviewList');
  list.innerHTML = state.results.map((r, i) => {
    const q          = QUESTIONS[r.questionIdx];
    const isOk       = r.correct;
    const chosen     = r.chosen !== null ? LETTERS[r.chosen] + '. ' + q.options[r.chosen] : 'Tidak dijawab';
    const answerText = LETTERS[q.answer] + '. ' + q.options[q.answer];
    return `
      <div class="review-item ${isOk ? 'correct-item' : 'wrong-item'}" style="animation-delay:${i*0.05}s">
        <div class="review-item-header">
          <span class="review-num">No. ${i + 1}</span>
          <span class="review-q">${q.question}</span>
        </div>
        <div class="review-answers">
          <span class="review-answer user-answer ${isOk ? 'correct' : 'wrong'}">
            <i class="fa-solid ${isOk ? 'fa-check' : 'fa-xmark'}"></i>
            Jawabanmu: ${chosen}
          </span>
          ${!isOk ? `
            <span class="review-answer correct-answer">
              <i class="fa-solid fa-circle-check"></i>
              Jawaban benar: ${answerText}
            </span>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════ */
function animateCount(el, target) {
  let cur = 0;
  const step = Math.max(1, Math.floor(target / 20));
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(iv);
  }, 40);
}

function animateCountPct(el, target) {
  let cur = 0;
  const step = Math.max(1, Math.floor(target / 20));
  const iv = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur + '%';
    if (cur >= target) clearInterval(iv);
  }, 40);
}

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
loadQuestion();

