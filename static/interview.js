// Phase 2: timed interview. Read questions from sessionStorage, ask one
// at a time, POST each answer to /api/evaluate, save results.

const SECONDS_PER_QUESTION = 120;

const questions     = JSON.parse(sessionStorage.getItem('questions')     || '[]');
const skills        = JSON.parse(sessionStorage.getItem('skills')        || '[]');
const skillContext  = JSON.parse(sessionStorage.getItem('skill_context') || '{}');
let   results       = JSON.parse(sessionStorage.getItem('results')       || '[]');
let   currentIdx    = parseInt(sessionStorage.getItem('current_idx')     || '0', 10);

// If user came here directly, send them back to start
if (questions.length === 0) {
  window.location.href = '/';
}

const questionEl     = document.getElementById('question');
const answerEl       = document.getElementById('answer');
const timeLeftEl     = document.getElementById('time-left');
const progressFill   = document.getElementById('progress-fill');
const qNumEl         = document.getElementById('q-num');
const skillEl        = document.getElementById('skill');
const timeoutAlert   = document.getElementById('timeout-alert');
const contextEl      = document.getElementById('question-context');
const submitBtn      = document.getElementById('submit-btn');
const skipBtn        = document.getElementById('skip-btn');
const nextBtn        = document.getElementById('next-btn');

let startTime  = Date.now();
let timerId    = null;
let submitted  = false;   // guards against double-advance

function renderQuestion() {
  // All questions done → go to results
  if (currentIdx >= questions.length) {
    sessionStorage.setItem('results', JSON.stringify(results));
    window.location.href = '/results';
    return;
  }

  const currentSkill = skills[currentIdx] || '';
  questionEl.textContent = questions[currentIdx];
  skillEl.textContent    = currentSkill || '—';
  qNumEl.textContent     = `${currentIdx + 1} / ${questions.length}`;
  answerEl.value         = '';
  timeoutAlert.style.display = 'none';

  // Show the experience context this question was based on
  const ctx = skillContext[currentSkill];
  if (ctx && ctx !== 'Listed as a known skill.') {
    contextEl.textContent = `💡 Based on your experience: ${ctx}`;
    contextEl.style.display = 'block';
  } else {
    contextEl.style.display = 'none';
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Answer';

  submitted = false;
  startTime = Date.now();
  startTimer();
}

function startTimer() {
  if (timerId) clearInterval(timerId);
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
}

function updateTimer() {
  const elapsed   = Math.floor((Date.now() - startTime) / 1000);
  const remaining = Math.max(0, SECONDS_PER_QUESTION - elapsed);

  timeLeftEl.textContent  = remaining + 's';
  progressFill.style.width = (remaining / SECONDS_PER_QUESTION * 100) + '%';

  // Change color as time runs out
  if (remaining < 20) {
    timeLeftEl.style.color = 'var(--danger)';
  } else if (remaining < 60) {
    timeLeftEl.style.color = 'var(--warning)';
  } else {
    timeLeftEl.style.color = 'var(--primary)';
  }

  if (remaining <= 0) {
    clearInterval(timerId);
    timeoutAlert.style.display = 'block';
  }
}

function advance(result, timedOut = false) {
  if (submitted) return;
  submitted = true;
  clearInterval(timerId);

  const elapsed = Math.min(
    Math.floor((Date.now() - startTime) / 1000),
    SECONDS_PER_QUESTION
  );

  results.push({
    skill:      skills[currentIdx] || '',
    question:   questions[currentIdx] || '',
    answer:     answerEl.value,
    time_taken: elapsed,
    timed_out:  timedOut,
    ...result,
  });

  sessionStorage.setItem('results', JSON.stringify(results));
  currentIdx += 1;
  sessionStorage.setItem('current_idx', String(currentIdx));

  renderQuestion();
}

// Submit Answer → POST to backend for evaluation
submitBtn.addEventListener('click', async () => {
  if (submitted) return;
  const answer = answerEl.value;

  if (!answer.trim()) {
    advance({
      score: 0,
      verdict: 'No Answer',
      correct_answer: '',
      hint: '',
      feedback: 'No answer was provided.',
    });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Checking with Gemini...';
  const elapsed  = Math.floor((Date.now() - startTime) / 1000);
  const timedOut = elapsed >= SECONDS_PER_QUESTION;

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: questions[currentIdx],
        answer:   answer,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Eval failed');
    advance(data, timedOut);
  } catch (e) {
    advance({
      score: 0,
      verdict: 'Error',
      correct_answer: '',
      hint: '',
      feedback: 'Evaluation failed: ' + e.message,
    }, timedOut);
  }
});

// Skip → record as skipped, advance
skipBtn.addEventListener('click', () => {
  advance({
    score: 0,
    verdict: 'Skipped',
    hint: '',
    feedback: 'Question skipped by user.',
  });
});

// Next → force-advance without evaluation
nextBtn.addEventListener('click', () => {
  advance({
    score: 0,
    verdict: 'Skipped',
    hint: '',
    feedback: 'Skipped (force-advanced by user).',
  });
});

// Kick things off
renderQuestion();
