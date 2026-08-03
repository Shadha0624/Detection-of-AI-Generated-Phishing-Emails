// ============================================================
//  Phishing Email Detector - content.js
//  Runs inside Gmail page
//  1. Scans inbox rows → injects colored badges
//  2. Detects open email → injects warning banner
// ============================================================

const API_URL = "http://127.0.0.1:8000/predict";

// Track which rows and emails have already been analyzed
const analyzedRows    = new WeakSet();
const analyzedEmails  = new Set();

// ─────────────────────────────────────────────
//  CATEGORY CONFIG
// ─────────────────────────────────────────────
const CATEGORY_CONFIG = {
  "Legitimate": {
    bg:     "#1e8e3e",
    light:  "#e6f4ea",
    border: "#1e8e3e",
    icon:   "✔",
    label:  "Legitimate"
  },
  "Suspicious": {
    bg:     "#f9ab00",
    light:  "#fef7e0",
    border: "#f9ab00",
    icon:   "?",
    label:  "Suspicious"
  },
  "Human Phishing": {
    bg:     "#d93025",
    light:  "#fce8e6",
    border: "#d93025",
    icon:   "!",
    label:  "Human Phishing"
  },
  "AI Phishing": {
    bg:     "#7b1fa2",
    light:  "#f3e5f5",
    border: "#7b1fa2",
    icon:   "AI",
    label:  "AI Phishing"
  }
};

// ─────────────────────────────────────────────
//  CALL FASTAPI BACKEND
// ─────────────────────────────────────────────
async function predict(text) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 3000) })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.warn("[PhishDetect] Backend not reachable:", e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
//  INBOX: SCAN EMAIL ROWS
//  Reads sender + subject + preview snippet
// ─────────────────────────────────────────────
async function scanInboxRow(row) {
  if (analyzedRows.has(row)) return;
  analyzedRows.add(row);

  // Extract text visible in inbox row
  const senderEl  = row.querySelector(".yW, .zF");
  const subjectEl = row.querySelector(".y6 span, .bog");
  const previewEl = row.querySelector(".y2");

  const sender  = senderEl?.innerText  || "";
  const subject = subjectEl?.innerText || "";
  const preview = previewEl?.innerText || "";
  const text    = `${sender} ${subject} ${preview}`.trim();

  if (!text || text.length < 5) return;

  const result = await predict(text);
  if (!result || !result.category) return;

  injectInboxBadge(row, result);
}

function injectInboxBadge(row, result) {
  // Remove old badge if exists
  row.querySelector(".phish-badge")?.remove();

  const config = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG["Suspicious"];

  const badge = document.createElement("span");
  badge.className = "phish-badge";
  badge.title = `${result.category} — ${result.confidence}% confidence`;
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: ${config.bg};
    color: white;
    font-size: 10px;
    font-weight: 900;
    font-family: monospace;
    margin-right: 6px;
    flex-shrink: 0;
    vertical-align: middle;
    cursor: default;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    letter-spacing: -0.5px;
  `;
  badge.innerText = config.icon;

  // Insert badge into row — before sender name
  const senderCell = row.querySelector(".yW, .zF, td.WA");
  if (senderCell) {
    senderCell.style.position = "relative";
    senderCell.insertBefore(badge, senderCell.firstChild);
  }
}

// ─────────────────────────────────────────────
//  OPEN EMAIL: INJECT BANNER
// ─────────────────────────────────────────────
async function analyzeOpenEmail() {
  // Gmail email body container
  const bodyEl   = document.querySelector("div.a3s.aiL, div.a3s");
  const subjectEl = document.querySelector("h2.hP");

  if (!bodyEl) return;

  const bodyText    = bodyEl.innerText || "";
  const subjectText = subjectEl?.innerText || "";
  const fullText    = `${subjectText} ${bodyText}`.trim();

  // Unique key to avoid re-analyzing same email
  const emailKey = fullText.slice(0, 100);
  if (analyzedEmails.has(emailKey)) return;
  analyzedEmails.add(emailKey);

  if (!fullText || fullText.length < 10) return;

  // Show loading banner
  showLoadingBanner();

  const result = await predict(fullText);

  // Remove loading banner
  document.getElementById("phish-banner")?.remove();

  if (!result || !result.category) return;

  showResultBanner(result);
}

function showLoadingBanner() {
  document.getElementById("phish-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "phish-banner";
  banner.style.cssText = getBannerBaseStyle("#5f6368");
  banner.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div class="phish-spinner"></div>
      <span style="font-size:13px; color:white; font-family:'Google Sans',sans-serif;">
        Analyzing email for phishing...
      </span>
    </div>
  `;
  insertBanner(banner);
}

function showResultBanner(result) {
  document.getElementById("phish-banner")?.remove();

  const config = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG["Suspicious"];

  const banner = document.createElement("div");
  banner.id = "phish-banner";
  banner.style.cssText = getBannerBaseStyle(config.bg);

  banner.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">

      <div style="display:flex; align-items:center; gap:12px;">
        <!-- Icon circle -->
        <div style="
          width:36px; height:36px;
          border-radius:50%;
          background:rgba(255,255,255,0.25);
          display:flex; align-items:center; justify-content:center;
          font-size:14px; font-weight:900; color:white;
          font-family:monospace; flex-shrink:0;
        ">${config.icon}</div>

        <!-- Text -->
        <div>
          <div style="font-size:14px; font-weight:700; color:white; font-family:'Google Sans',sans-serif; letter-spacing:0.3px;">
            ${result.category.toUpperCase()} DETECTED
          </div>
          <div style="font-size:12px; color:rgba(255,255,255,0.85); font-family:'Google Sans',sans-serif; margin-top:2px;">
            Confidence: ${result.confidence}%
            &nbsp;|&nbsp;
            Legitimate: ${result.scores.legitimate}%
            &nbsp;·&nbsp;
            Human Phishing: ${result.scores.human_phishing}%
            &nbsp;·&nbsp;
            AI Phishing: ${result.scores.ai_phishing}%
          </div>
        </div>
      </div>

      <!-- Close button -->
      <button onclick="document.getElementById('phish-banner').remove()" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.4);
        color: white;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-family: 'Google Sans', sans-serif;
        flex-shrink: 0;
      ">Dismiss</button>
    </div>
  `;

  insertBanner(banner);
}

function getBannerBaseStyle(bgColor) {
  return `
    position: sticky;
    top: 0;
    z-index: 99999;
    width: 100%;
    padding: 10px 16px;
    background: ${bgColor};
    box-sizing: border-box;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    margin-bottom: 8px;
    border-radius: 0 0 6px 6px;
  `;
}

function insertBanner(banner) {
  // Insert before the email body
  const emailContainer = document.querySelector("div.AO, div.Bs");
  const bodyEl = document.querySelector("div.a3s.aiL, div.a3s");

  if (bodyEl && bodyEl.parentElement) {
    bodyEl.parentElement.insertBefore(banner, bodyEl);
  } else if (emailContainer) {
    emailContainer.insertBefore(banner, emailContainer.firstChild);
  } else {
    document.body.insertBefore(banner, document.body.firstChild);
  }
}

// ─────────────────────────────────────────────
//  MUTATION OBSERVER
//  Watches Gmail DOM for changes
// ─────────────────────────────────────────────
const observer = new MutationObserver(() => {
  // Scan inbox rows
  const rows = document.querySelectorAll("tr.zA");
  rows.forEach(row => scanInboxRow(row));

  // Analyze open email
  if (document.querySelector("div.a3s")) {
    analyzeOpenEmail();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial scan on load
setTimeout(() => {
  const rows = document.querySelectorAll("tr.zA");
  rows.forEach(row => scanInboxRow(row));
}, 2000);