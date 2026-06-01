// Phase 3: render results from sessionStorage.

const results    = JSON.parse(sessionStorage.getItem('results') || '[]');
const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
const maxScore   = results.length * 10;

document.getElementById('total-score').textContent = `${totalScore} / ${maxScore}`;

// Friendly summary message
const pct = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
let msg = 'Review your answers below.';
if (pct >= 80)      msg = '🎉 Excellent! Strong performance.';
else if (pct >= 60) msg = '👍 Solid effort — a few areas to brush up.';
else if (pct > 0)   msg = '💪 Good start — review the feedback below.';
document.getElementById('score-msg').textContent = msg;

// Render each result as an expandable card
const container = document.getElementById('results-list');
container.innerHTML = '';

results.forEach((r, i) => {
  const verdict = r.verdict || 'Unknown';
  const icon    = verdict === 'Correct'           ? '✅'
                : verdict === 'Partially Correct' ? '🟡'
                : '❌';
  const timeoutTag = r.timed_out ? ' ⏱ (timed out)' : '';

  const showHint = r.hint
    && verdict !== 'Correct'
    && !/^none\b/i.test(r.hint.trim());

  const item = document.createElement('div');
  item.className = 'result-item';
  item.innerHTML = `
    <details>
      <summary class="result-header">
        <span class="result-icon">${icon}</span>
        <span>Q${i + 1} — ${escapeHtml(r.skill || '')}</span>
        <span class="result-score">${r.score || 0}/10 · ${escapeHtml(verdict)}${timeoutTag}</span>
      </summary>
      <div class="result-body">
        <p><strong>Question</strong>${escapeHtml(r.question || '')}</p>
        <p><strong>Your Answer</strong>${escapeHtml(r.answer || '(no answer)')}</p>
        ${r.correct_answer
          ? `<p><strong>✅ Correct Answer</strong>${escapeHtml(r.correct_answer)}</p>`
          : ''}
        ${showHint
          ? `<p><strong>💡 Hint — what you missed</strong>${escapeHtml(r.hint)}</p>`
          : ''}
        <p><strong>Feedback</strong>${escapeHtml(r.feedback || '')}</p>
        <p><strong>Time Taken</strong>${r.time_taken || 0}s</p>
      </div>
    </details>
  `;
  container.appendChild(item);
});

// Safe escape — Gemini output can include HTML-ish chars
function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// Start Over → clear state, back to upload
document.getElementById('restart-btn').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = '/';
});
