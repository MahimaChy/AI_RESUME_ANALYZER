// Phase 1: upload PDF, analyze resume, kick off interview.

const fileInput     = document.getElementById('resume-input');
const analyzeBtn    = document.getElementById('analyze-btn');
const uploadSuccess = document.getElementById('upload-success');
const fileNameEl    = document.getElementById('file-name');
const profileCard   = document.getElementById('profile-card');
const startBtn      = document.getElementById('start-btn');
const loadingMsg    = document.getElementById('loading-msg');
const errorMsg      = document.getElementById('error-msg');

let profile = null;

function showLoading(text) {
  loadingMsg.textContent = text;
  loadingMsg.style.display = 'block';
  errorMsg.style.display = 'none';
}

function hideLoading() {
  loadingMsg.style.display = 'none';
}

function showError(text) {
  errorMsg.textContent = '❌ ' + text;
  errorMsg.style.display = 'block';
  hideLoading();
}

// When a file is picked, enable the Analyze button
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    fileNameEl.textContent = fileInput.files[0].name;
    uploadSuccess.style.display = 'block';
    analyzeBtn.disabled = false;
  }
});

// Click "Analyze Resume" → POST PDF to backend
analyzeBtn.addEventListener('click', async () => {
  if (!fileInput.files[0]) return;

  showLoading('Analyzing resume with Gemini...');
  analyzeBtn.disabled = true;

  const formData = new FormData();
  formData.append('resume', fileInput.files[0]);

  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Request failed');

    profile = data;
    sessionStorage.setItem('profile', JSON.stringify(profile));
    renderProfile(profile);
    hideLoading();
  } catch (e) {
    showError(e.message);
    analyzeBtn.disabled = false;
  }
});

function renderProfile(p) {
  document.getElementById('p-role').textContent = p.role || '—';
  document.getElementById('p-summary').textContent = p.summary || '—';

  const skillsEl = document.getElementById('p-skills');
  skillsEl.innerHTML = '';
  const topSkills = (p.skills || []).slice(0, 5);
  const ctx = p.skill_context || {};

  topSkills.forEach(skill => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <div class="skill-row-name">${escapeHtml(skill)}</div>
      <div class="skill-row-context">${escapeHtml(ctx[skill] || 'Listed as a known skill.')}</div>
    `;
    skillsEl.appendChild(row);
  });

  profileCard.style.display = 'block';
  profileCard.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// Click "Start Interview" → POST skills, get questions, redirect
startBtn.addEventListener('click', async () => {
  if (!profile) return;

  showLoading('Preparing your questions...');
  startBtn.disabled = true;

  try {
    const topSkills = (profile.skills || []).slice(0, 5);
    const skillContext = profile.skill_context || {};

    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skills: topSkills,
        role: profile.role || 'Software Developer',
        skill_context: skillContext,
        is_fresher: !!profile.is_fresher,
        experience: profile.experience || [],
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Request failed');

    sessionStorage.setItem('questions',     JSON.stringify(data.questions));
    sessionStorage.setItem('skills',        JSON.stringify(data.skills));
    sessionStorage.setItem('skill_context', JSON.stringify(data.skill_context || {}));
    sessionStorage.setItem('results',       JSON.stringify([]));
    sessionStorage.setItem('current_idx',   '0');

    window.location.href = '/interview';
  } catch (e) {
    showError(e.message);
    startBtn.disabled = false;
  }
});
