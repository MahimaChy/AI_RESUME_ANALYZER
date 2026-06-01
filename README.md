# 🎯 AI Career Agent

> An AI-powered mock interview platform that turns your resume into a
> personalized technical interview — and grades you in real time.

Upload your PDF resume → get 5 interview questions tailored to your skills and experience → answer them against a timer → receive a score, an ideal answer, a hint on what you missed, and written feedback for every question.

Built with **Flask**, **Google Gemini**, and a vanilla **HTML/CSS/JS** frontend — no framework, no database.

---

## ✨ Features

- 📄 **Resume-aware questions** — Gemini reads your actual projects and experience, not generic textbook prompts.
- 🎯 **Adaptive difficulty** — entry-level fundamentals for freshers, real-world / system-design questions for engineers with 2+ years.
- ⏱ **Timed interview** — 120 seconds per question with a live countdown, progress bar, and Skip/Next controls.
- 💡 **Smart hints** — for wrong or partial answers, the app surfaces the single most important point you missed (not just the full correct answer).
- 📊 **Scored results dashboard** — total score, per-question breakdown, verdicts, ideal answers, and feedback.
- 🔐 **API key stays server-side** — the browser never sees the Gemini key.
- 🛡 **Hardened against API hangs** — every Gemini call has a 20-second hard timeout to keep the UI responsive under rate-limits.

---

## 🧱 Tech stack

| Layer       | Stack                                              |
|-------------|----------------------------------------------------|
| Frontend    | HTML5, CSS3, vanilla JavaScript (no framework)     |
| Backend     | Python, Flask                                      |
| AI          | Google Gemini 2.5 Flash (`google-genai` SDK)       |
| PDF parsing | PyPDF2                                             |
| State       | `sessionStorage` (per-tab browser memory)          |
| Concurrency | `concurrent.futures.ThreadPoolExecutor` (API timeout) |

---

## 🚀 Quick start

```bash
# 1. Clone the repo
git clone https://github.com/<your-username>/ai-career-agent.git
cd ai-career-agent

# 2. Create + activate a virtualenv
python3 -m venv venv
source venv/bin/activate           # macOS / Linux
# venv\Scripts\activate            # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Add your Gemini API key
echo "GOOGLE_API_KEY=your_key_here" > .env

# 5. Run the server
python app.py
```

Then open **<http://localhost:5000>** in your browser.

> Get a free Gemini API key at <https://aistudio.google.com/app/apikey>.

---

## 🗂 Folder structure

```
AI_CAREER_AGENT/
├── app.py                  ← Flask backend (routes + Gemini logic)
├── requirements.txt
├── .env                    ← your GOOGLE_API_KEY
├── templates/              ← rendered by Flask
│   ├── upload.html         (Phase 1 — upload + analyze)
│   ├── interview.html      (Phase 2 — timed Q&A)
│   └── results.html        (Phase 3 — scored summary)
└── static/                 ← served at /static/<file>
    ├── style.css
    ├── upload.js
    ├── interview.js
    └── results.js
```

---

## 🔄 How it works

```
Browser                     Flask backend                Gemini API
───────                     ─────────────                ──────────
  │  GET /                        │                           │
  ├──────────────────────────────►│                           │
  │  ← upload.html                │                           │
  │                               │                           │
  │  POST /api/analyze (PDF file) │  analyze_resume(text)    │
  ├──────────────────────────────►├──────────────────────────►│
  │  ← profile JSON               │  ← skills, experience    │
  │                               │                           │
  │  POST /api/questions          │  generate_questions(...) │
  ├──────────────────────────────►├──────────────────────────►│
  │  ← 5 personalized questions   │                           │
  │                               │                           │
  │  redirect → /interview        │                           │
  │  POST /api/evaluate (Q + A)   │  evaluate_answer(...)    │
  ├──────────────────────────────►├──────────────────────────►│
  │  ← score, verdict, hint       │                           │
  │                               │                           │
  │  redirect → /results          │                           │
```

Interview state is kept in `sessionStorage` (per-tab) so the app works with **zero database / zero infrastructure**.

---

## 🛠 API endpoints

| Method | Path             | Body                                              | Returns                                                            |
|--------|------------------|---------------------------------------------------|--------------------------------------------------------------------|
| `POST` | `/api/analyze`   | `multipart/form-data: resume` (PDF)               | `{ role, skills, experience, summary, skill_context, ... }`        |
| `POST` | `/api/questions` | `{ skills, role, skill_context, is_fresher, experience }` | `{ questions: [...] }`                                             |
| `POST` | `/api/evaluate`  | `{ question, answer }`                            | `{ score, verdict, correct_answer, hint, feedback }`               |

---

## 🎚 Difficulty tiers

Questions are auto-scaled by Gemini based on parsed years of experience:

| Tier        | Trigger                              | Question style                                                   |
|-------------|--------------------------------------|------------------------------------------------------------------|
| Fresher     | `is_fresher: true` OR 0 years        | Fundamentals, definitions, basic syntax                          |
| Junior      | 1–2 years                            | Real-world usage, pitfalls, trade-offs ("why X over Y")          |
| Mid-level   | 2–5 years                            | Internals, performance, concurrency, architecture                |
| Senior      | 5+ years                             | System design, scaling, security, mentoring judgment             |

---

## 🧪 Design decisions

- **Why a Python backend?** The Gemini API key must stay server-side, and PDF parsing is Pythonic.
- **Why a 20s timeout on Gemini?** The SDK retries internally on rate-limits and can block the request thread for minutes. Wrapping the call in `concurrent.futures` with a hard timeout keeps the UI snappy.
- **Why `sessionStorage` and not a DB?** Each interview is a single-tab session — no persistence needed. Zero infra, zero auth, zero cost.
- **Why vanilla JS?** Three small pages with simple state. A framework would have been heavier than the app itself.

---

## 🗺 Roadmap

- [ ] Optional history mode (save sessions to a local DB)
- [ ] Voice-to-text answer input
- [ ] Multi-language interview support
- [ ] Resume rewrite suggestions based on weak topics
- [ ] Deploy a public demo

---

## 📸 Screenshots

<!-- Drop screenshots into a /docs/ folder and link them here -->

| Upload                          | Interview                          | Results                          |
|---------------------------------|------------------------------------|----------------------------------|
| ![](docs/upload.png)            | ![](docs/interview.png)            | ![](docs/results.png)            |

---

## 👤 Author

**Mahima Chaudhary**
B.E. in Information Technology — Everest Engineering College
Bengaluru, India

- LinkedIn: [linkedin.com/in/mahima-chaudhary-06416b402](https://www.linkedin.com/in/mahima-chaudhary-06416b402)
- Email: mahima.chaudhary.111in@gmail.com

---

## 📜 License

MIT — free to use, modify, and share.
