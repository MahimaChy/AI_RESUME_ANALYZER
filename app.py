"""
AI Career Agent — Flask backend.

Serves the 3 HTML pages and provides JSON APIs that wrap Gemini calls
for resume analysis, question generation, and answer evaluation.
"""

import os
import re
import json
import concurrent.futures

from flask import Flask, render_template, request, jsonify
from PyPDF2 import PdfReader
from google import genai
from dotenv import load_dotenv

load_dotenv()


# --------- CONFIG ---------

MODEL = "gemini-2.5-flash"
AI_CALL_TIMEOUT = 20  # seconds — guards against Gemini SDK hanging on rate limits


# --------- GEMINI SETUP ---------

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

_client = None
_executor = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=GOOGLE_API_KEY)
    return _client


def _get_executor():
    global _executor
    if _executor is None:
        _executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)
    return _executor


def _call_gemini(prompt):
    result = _get_client().models.generate_content(
        model=MODEL,
        contents=prompt,
    )
    text = getattr(result, "text", None)
    if not text:
        raise RuntimeError(f"Gemini returned empty response: {result}")
    return text


def ask_ai(prompt, timeout=AI_CALL_TIMEOUT):
    if not GOOGLE_API_KEY:
        raise RuntimeError(
            "GOOGLE_API_KEY not configured. Add it to .env and restart."
        )
    # Run the API call in a worker thread with a hard timeout. Without this,
    # Gemini SDK's internal retries on rate-limit can block for minutes.
    future = _get_executor().submit(_call_gemini, prompt)
    try:
        return future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        raise RuntimeError(
            f"Gemini did not respond within {timeout}s. "
            "Likely cause: daily free-tier quota exhausted."
        )


# --------- HELPERS ---------

def extract_text_from_pdf(file_stream):
    reader = PdfReader(file_stream)
    text = ""
    for page in reader.pages:
        text += page.extract_text() or ""
    return text


def _strip_code_fence(s):
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s.strip()


def analyze_resume(text):
    prompt = f"""
You are a resume analyzer. Analyze the resume below and return ONLY valid JSON
(no markdown, no code fences, no extra text) with these fields:

- role: the candidate's target/intended role.
- skills: list of technical skills present in the resume, ordered most-important first.
- strengths: list of soft skills or personal strengths.
- is_fresher: true if the candidate has no professional work experience.
- experience: list of professional jobs only ({{title, company, years, description}}).
  If fresher, return [].
- summary: 1-2 sentence summary of the candidate.
- education: list of {{degree, institution, location, graduation_year}}.
- missing_skills: based on TYPICAL JOB DESCRIPTIONS in the market for the "role"
  above, list 5-10 skills commonly required but NOT in the candidate's skills list.
- skill_context: object mapping EACH skill in "skills" to a single short
  sentence (max ~20 words) describing how/where the candidate has used or
  learned that skill — drawn from experience, projects, or education.
  If no clear context exists for a skill, use "Listed as a known skill."
  Example: {{"Python": "Built backend automation scripts during Acme internship",
  "React": "Personal portfolio site and 2 academic projects"}}

Resume:
{text}
"""
    raw = ask_ai(prompt)
    return json.loads(_strip_code_fence(raw))


def _years_of_experience(experience):
    """Sum the 'years' field across all experience entries. Best-effort: handles
    ints, floats, '2', '2 years', '1.5', and ranges like '2020-2022'."""
    total = 0.0
    for job in experience or []:
        y = job.get("years") if isinstance(job, dict) else None
        if y is None:
            continue
        if isinstance(y, (int, float)):
            total += float(y)
            continue
        s = str(y).strip()
        # Range like "2020-2022" or "2020 - 2022"
        m = re.match(r"\s*(\d{4})\s*[-–to]+\s*(\d{4}|present|now)\s*", s, re.I)
        if m:
            start = int(m.group(1))
            end_raw = m.group(2).lower()
            end = 2026 if end_raw in ("present", "now") else int(end_raw)
            total += max(0, end - start)
            continue
        # "2", "2 years", "1.5 yrs"
        m = re.search(r"(\d+(?:\.\d+)?)", s)
        if m:
            total += float(m.group(1))
    return total


def _difficulty_for(is_fresher, years):
    """Pick a difficulty tier and a description Gemini can use to scale questions."""
    if is_fresher or years < 1:
        return ("Fresher / Entry-level", (
            "Ask FUNDAMENTAL questions on each skill — definitions, core "
            "concepts, simple usage, basic syntax. Avoid trick questions, "
            "system design, or deep internals."
        ))
    if years < 2:
        return ("Junior (1-2 yrs experience)", (
            "Ask INTERMEDIATE questions that go beyond textbook definitions: "
            "real-world usage, common pitfalls, debugging scenarios, "
            "trade-offs between approaches, and 'why would you choose X over Y'. "
            "The candidate has shipped production code — questions must reflect that."
        ))
    if years < 5:
        return ("Mid-level (2-5 yrs experience)", (
            "Ask HARD questions: deep internals, performance/scaling concerns, "
            "concurrency, edge cases, architectural decisions, and how the "
            "candidate would design or refactor a real system using this skill. "
            "Expect senior-leaning answers."
        ))
    return ("Senior (5+ yrs experience)", (
        "Ask SENIOR-level questions: system design, scaling bottlenecks, "
        "advanced internals, security implications, tech-stack trade-offs at "
        "scale, and mentoring/code-review judgment. Avoid anything that sounds "
        "like a textbook intro."
    ))


def generate_questions_for_skills(
    skills, role, skill_context=None, is_fresher=False, experience=None,
):
    skill_context = skill_context or {}
    years = _years_of_experience(experience)
    tier, difficulty_instructions = _difficulty_for(is_fresher, years)

    # Build a "Skill: their experience" block so Gemini can tailor questions
    skill_lines = "\n".join(
        f"- {s}: {skill_context.get(s, 'No specific context — ask a fundamental question.')}"
        for s in skills
    )
    prompt = f"""
Generate ONE technical interview question per skill below.
Tailor each question to the candidate's actual experience with that skill —
reference their context where natural (e.g., "You mentioned using Python for
backend automation — explain how you would..."). If the context is generic
or missing, ask a strong question on the skill at the difficulty level below.

Target role: {role}
Candidate level: {tier} (approx {years:g} year(s) of professional experience)

DIFFICULTY REQUIREMENT — follow this strictly:
{difficulty_instructions}

Skills with the candidate's experience context:
{skill_lines}

Return ONLY a JSON array of strings — exactly {len(skills)} questions,
one per skill in the SAME ORDER. No markdown, no numbering, no extra text.
Example: ["What is X?", "Explain Y.", "How does Z work?"]
"""
    raw = ask_ai(prompt)
    cleaned = _strip_code_fence(raw)
    try:
        questions = json.loads(cleaned)
        if isinstance(questions, list) and len(questions) >= len(skills):
            return [str(q).strip() for q in questions[: len(skills)]]
    except Exception:
        pass
    # Fallback: split by lines, strip numbering
    lines = [re.sub(r"^\d+[\.\)]\s*", "", ln).strip()
             for ln in raw.split("\n") if ln.strip()]
    return lines[: len(skills)] if lines else [
        f"Tell me about your experience with {s}." for s in skills
    ]


def evaluate_answer(question, answer):
    if not answer.strip():
        return {
            "score": 0,
            "verdict": "No Answer",
            "correct_answer": "",
            "hint": "",
            "feedback": "No answer was provided.",
        }
    prompt = f"""
You are a technical interviewer. Evaluate the candidate's answer.

Question:
{question}

Candidate Answer:
{answer}

Return EXACTLY in this format (no markdown):

Correct Answer:
<the ideal answer in 2-3 sentences>

Missing Point:
<ONE short sentence (max ~20 words) naming the single most important
concept or detail the candidate left out or got wrong. If the answer is
fully correct, write: None — the answer covered the key points.>

Feedback:
<one short paragraph evaluating the candidate's answer>

Score:
<integer between 0 and 10>

Verdict:
<one of: Correct, Partially Correct, Incorrect>
"""
    raw = ask_ai(prompt)

    score = 0
    m = re.search(r"Score:\s*(\d+)", raw)
    if m:
        score = max(0, min(10, int(m.group(1))))

    verdict = "Unknown"
    m = re.search(r"Verdict:\s*([A-Za-z ]+)", raw)
    if m:
        verdict = m.group(1).strip()

    correct = ""
    m = re.search(
        r"Correct Answer:\s*(.*?)(?=\n\s*(?:Missing Point|Feedback|Score)\s*:|\Z)",
        raw, re.DOTALL | re.IGNORECASE,
    )
    if m:
        correct = m.group(1).strip()

    hint = ""
    m = re.search(
        r"Missing Point:\s*(.*?)(?=\n\s*(?:Feedback|Score)\s*:|\Z)",
        raw, re.DOTALL | re.IGNORECASE,
    )
    if m:
        hint = m.group(1).strip()

    feedback = ""
    m = re.search(
        r"Feedback:\s*(.*?)(?=\n\s*(?:Score|Verdict)\s*:|\Z)",
        raw, re.DOTALL | re.IGNORECASE,
    )
    if m:
        feedback = m.group(1).strip()

    return {
        "score": score,
        "verdict": verdict,
        "correct_answer": correct,
        "hint": hint,
        "feedback": feedback or raw,
    }


# --------- FLASK APP ---------

app = Flask(__name__)


# Page routes — just render the HTML templates
@app.route("/")
def upload_page():
    return render_template("upload.html")


@app.route("/interview")
def interview_page():
    return render_template("interview.html")


@app.route("/results")
def results_page():
    return render_template("results.html")


# JSON API routes — called from the browser via fetch()
@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    if "resume" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["resume"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a PDF file"}), 400
    try:
        text = extract_text_from_pdf(file.stream)
        if not text.strip():
            return jsonify({"error": "Could not extract text from PDF"}), 400
        profile = analyze_resume(text)
        return jsonify(profile)
    except json.JSONDecodeError:
        return jsonify({"error": "Gemini returned invalid JSON. Try again."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/questions", methods=["POST"])
def api_questions():
    data = request.get_json(silent=True) or {}
    skills = [s for s in data.get("skills", []) if s][:5]
    role = data.get("role") or "Software Developer"
    skill_context = data.get("skill_context") or {}
    is_fresher = bool(data.get("is_fresher", False))
    experience = data.get("experience") or []
    if not skills:
        return jsonify({"error": "No skills provided"}), 400
    try:
        questions = generate_questions_for_skills(
            skills, role, skill_context,
            is_fresher=is_fresher, experience=experience,
        )
        return jsonify({
            "questions": questions,
            "skills": skills,
            "skill_context": skill_context,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluate", methods=["POST"])
def api_evaluate():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    answer = data.get("answer", "")
    if not question:
        return jsonify({"error": "Missing question"}), 400
    try:
        result = evaluate_answer(question, answer)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
