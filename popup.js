// ============================================================
//  Phishing Email Detector - popup.js
// ============================================================

const API_URL = "http://127.0.0.1:8000";

const CATEGORY_CONFIG = {
  "Legitimate":      { bg: "#1e8e3e", light: "#e6f4ea", icon: "✔",  color: "#1e8e3e" },
  "Suspicious":      { bg: "#f9ab00", light: "#fef7e0", icon: "?",  color: "#b06000" },
  "Human Phishing":  { bg: "#d93025", light: "#fce8e6", icon: "!",  color: "#d93025" },
  "AI Phishing":     { bg: "#7b1fa2", light: "#f3e5f5", icon: "AI", color: "#7b1fa2" }
};

// ── Check backend health on popup open ──
async function checkHealth() {
  const dot  = document.getElementById("statusDot");
  const text = document.getElementById("statusText");

  try {
    const res = await fetch(`${API_URL}/health`);
    const data = await res.json();

    if (data.status === "running") {
      dot.className  = "status-dot online";
      text.innerText = "Backend connected — Ready";
    } else {
      throw new Error("not running");
    }
  } catch {
    dot.className  = "status-dot offline";
    text.innerText = "Backend offline — run uvicorn app:app";
  }
}

// ── Manual test button ──
document.getElementById("testBtn").addEventListener("click", async () => {
  const input = document.getElementById("testInput").value.trim();
  if (!input) return;

  const btn = document.getElementById("testBtn");
  btn.disabled   = true;
  btn.innerText  = "Analyzing...";

  try {
    const res    = await fetch(`${API_URL}/predict`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text: input })
    });

    const result = await res.json();
    showResult(result);
  } catch {
    showError();
  } finally {
    btn.disabled  = false;
    btn.innerText = "Analyze Text";
  }
});

function showResult(result) {
  const box        = document.getElementById("resultBox");
  const catEl      = document.getElementById("resultCategory");
  const confEl     = document.getElementById("resultConfidence");
  const scoresEl   = document.getElementById("resultScores");

  const config = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG["Suspicious"];

  // Style result box
  box.style.background   = config.light;
  box.style.borderColor  = config.bg;
  box.classList.add("show");

  // Category line
  catEl.innerHTML = `
    <span style="
      width:22px; height:22px;
      border-radius:50%;
      background:${config.bg};
      color:white;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      font-weight:900;
      font-family:monospace;
    ">${config.icon}</span>
    <span style="color:${config.color};">${result.category}</span>
  `;

  // Confidence line
  confEl.innerText = `Confidence: ${result.confidence}%`;

  // Score bars
  const scores = [
    { label: "Legitimate",     val: result.scores.legitimate,     color: "#1e8e3e" },
    { label: "Human Phishing", val: result.scores.human_phishing, color: "#d93025" },
    { label: "AI Phishing",    val: result.scores.ai_phishing,    color: "#7b1fa2" },
  ];

  scoresEl.innerHTML = scores.map(s => `
    <div class="score-row">
      <span>${s.label}</span>
      <div style="display:flex; align-items:center; gap:6px;">
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${s.val}%; background:${s.color};"></div>
        </div>
        <span>${s.val}%</span>
      </div>
    </div>
  `).join("");
}

function showError() {
  const box = document.getElementById("resultBox");
  box.style.background  = "#fce8e6";
  box.style.borderColor = "#d93025";
  box.classList.add("show");
  document.getElementById("resultCategory").innerHTML   = `<span style="color:#d93025;">Backend Error</span>`;
  document.getElementById("resultConfidence").innerText = "Make sure uvicorn is running on port 8000";
  document.getElementById("resultScores").innerHTML     = "";
}

// Run on open
checkHealth();