# 🎯 AI Career Agent

> An AI-powered mock interview platform that turns your resume into a
> personalized technical interview — and grades you in real time.

Upload your PDF resume → get 5 interview questions tailored to your skills and experience → answer them against a timer → receive a score
and written feedback for every question.

Built with **Flask**, **Google Gemini**, and a vanilla **HTML/CSS/JS** frontend — no framework, no database.

---

## ✨ Features

- 📄 **Resume-aware questions** — Gemini reads your actual projects and experience, not generic textbook prompts.
- 🎯 **Adaptive difficulty** — entry-level fundamentals for freshers, real-world / system-design questions for engineers with 2+ years.
- ⏱ **Timed interview** — 120 seconds per question with a live countdown, progress bar, and Skip/Next controls.
- 📊 **Scored results dashboard** — total score, per-question breakdown, verdicts, ideal answers, and feedback.
- 🔐 **API key stays server-side** — the browser never sees the Gemini key.
- 🛡 **Hardened against API hangs** — every Gemini call has a 20-second hard timeout to keep the UI responsive under rate-limits.

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

