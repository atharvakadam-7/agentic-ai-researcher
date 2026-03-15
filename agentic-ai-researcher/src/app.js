/**
 * Agentic AI Researcher
 * ─────────────────────────────────────────────────────────────
 * An autonomous research agent powered by the Anthropic Claude
 * API with built-in web search. Users input a topic; the agent
 * searches the web, synthesizes findings, and writes a report.
 *
 * Architecture (mirrors CrewAI / LangGraph agent pipeline):
 *   1. InputAgent    — validate & configure research parameters
 *   2. SearchAgent   — Claude + web_search tool fetches live data
 *   3. SynthesisAgent — Claude summarizes and cross-references
 *   4. ReportAgent   — formats output as structured markdown
 *
 * Author: Your Name
 * License: MIT
 */

"use strict";

// ── Constants ───────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4000;

/** Agent pipeline status messages shown to the user */
const PIPELINE_STAGES = [
  "Agent initializing web search...",
  "Searching the web for sources...",
  "Analyzing and cross-referencing results...",
  "Synthesizing findings...",
  "Formatting research report...",
];

/** Depth → instruction mapping */
const DEPTH_PROMPTS = {
  concise:
    "Write a concise brief (3–4 paragraphs) with key findings only. Be punchy and direct.",
  standard:
    "Write a full research report with multiple clear sections, supporting analysis, and conclusions.",
  deep:
    "Write a comprehensive, detailed research report with extensive analysis, specific data points, expert perspectives, and nuanced discussion across all relevant dimensions.",
};

/** Focus → instruction mapping */
const FOCUS_PROMPTS = {
  general:
    "Provide a balanced general overview covering all major aspects of the topic.",
  technical:
    "Focus on technical mechanisms, implementation details, and underlying science or engineering.",
  business:
    "Focus on market size, key players, competitive landscape, business models, and commercial outlook.",
  recent:
    "Focus on the most recent developments, announcements, and emerging trends from 2024–2025.",
};

/** Format → instruction mapping */
const FORMAT_PROMPTS = {
  report:
    "Structure as a formal research report with clear ## H2 section headers, prose paragraphs, and a ## Sources section at the end.",
  brief:
    "Structure as an executive brief: one executive summary paragraph, then 3–5 key findings as ### H3 headers with short supporting paragraphs.",
  bullets:
    "Structure with ## H2 section headers and bullet-point lists (using -) under each section. Be comprehensive but optimized for scanning.",
};

// ── DOM Helpers ──────────────────────────────────────────────────

/** @param {string} id @returns {HTMLElement} */
const $ = (id) => document.getElementById(id);

/** Show/hide the status bar with a given message and mode */
function setStatus(message, mode = "") {
  const bar = $("statusBar");
  const spinner = $("statusSpinner");
  const text = $("statusText");

  bar.className = "status-bar" + (mode ? ` ${mode}` : "");
  bar.classList.remove("hidden");

  if (mode === "done") {
    spinner.style.display = "none";
    bar.innerHTML = `<span class="status-dot status-dot--green"></span><span>${message}</span>`;
    return;
  }

  if (mode === "error") {
    spinner.style.display = "none";
    bar.innerHTML = `<span class="status-dot status-dot--red"></span><span>${message}</span>`;
    return;
  }

  spinner.style.display = mode === "active" ? "block" : "none";
  text.textContent = message;
}

/** Set topic input value from a quick-chip click */
function setTopic(element) {
  $("topicInput").value = element.textContent.trim();
  $("topicInput").focus();
}

/** Toggle API key input between password and text */
function toggleApiKeyVisibility() {
  const input = $("apiKeyInput");
  const btn = $("apiToggleBtn");
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "Hide";
  } else {
    input.type = "password";
    btn.textContent = "Show";
  }
}

// ── Markdown → HTML Renderer ─────────────────────────────────────

/**
 * Minimal markdown-to-HTML renderer for the report output.
 * Handles: ##/### headings, **bold**, *italic*, [links](url),
 * bare URLs, bullet lists (- / *), numbered lists, blockquotes, paragraphs.
 *
 * @param {string} markdown
 * @returns {string} HTML string
 */
function renderMarkdown(markdown) {
  // Escape HTML entities first
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings
  html = html
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>"); // treat H1 as H2

  // Inline formatting
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>");

  // Links (markdown syntax)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Bare URLs (not already in an href)
  html = html.replace(
    /(?<!href=")(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Process line by line to handle lists and paragraphs
  const lines = html.split("\n");
  const output = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Blockquote
    if (line.startsWith("&gt; ")) {
      if (inUl) { output.push("</ul>"); inUl = false; }
      if (inOl) { output.push("</ol>"); inOl = false; }
      output.push(`<blockquote>${line.slice(5)}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      if (inOl) { output.push("</ol>"); inOl = false; }
      if (!inUl) { output.push("<ul>"); inUl = true; }
      output.push(`<li>${line.slice(2)}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      if (inUl) { output.push("</ul>"); inUl = false; }
      if (!inOl) { output.push("<ol>"); inOl = true; }
      output.push(`<li>${line.replace(/^\d+\. /, "")}</li>`);
      continue;
    }

    // Close open lists
    if (inUl) { output.push("</ul>"); inUl = false; }
    if (inOl) { output.push("</ol>"); inOl = false; }

    // Headings or empty lines pass through
    if (
      line.startsWith("<h") ||
      line.startsWith("<blockquote") ||
      line === ""
    ) {
      output.push(line);
    } else {
      output.push(`<p>${line}</p>`);
    }
  }

  if (inUl) output.push("</ul>");
  if (inOl) output.push("</ol>");

  return output.join("\n");
}

// ── Report Renderer ──────────────────────────────────────────────

/**
 * Render the final report into the DOM.
 * @param {string} topic      — original user topic
 * @param {string} markdown   — raw markdown from the API
 * @param {string} depth      — selected depth option
 * @param {string} focus      — selected focus option
 * @param {string} format     — selected format option
 */
function renderReport(topic, markdown, depth, focus, format) {
  const depthLabels  = { concise: "Brief", standard: "Full Report", deep: "Deep Dive" };
  const focusLabels  = { general: "General", technical: "Technical", business: "Business", recent: "Latest" };
  const formatLabels = { report: "Report", brief: "Executive Brief", bullets: "Bullets" };

  const timestamp = new Date().toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const bodyHtml = renderMarkdown(markdown);

  const section = $("reportSection");
  section.innerHTML = `
    <div class="report-header">
      <div class="report-meta">
        <span class="report-badge badge--blue">${depthLabels[depth]}</span>
        <span class="report-badge badge--teal">${focusLabels[focus]}</span>
        <span class="report-badge badge--amber">${formatLabels[format]}</span>
        <span class="report-badge" style="color: var(--color-text-3); background: var(--color-bg-2);">${timestamp}</span>
      </div>
      <h2 class="report-title">${escapeHtml(topic)}</h2>
    </div>

    <div class="report-body" id="reportBody">
      ${bodyHtml}
    </div>

    <div class="copy-row">
      <button class="copy-btn" onclick="copyAsText()">Copy as text</button>
      <button class="copy-btn" onclick="copyAsMarkdown()">Copy markdown</button>
    </div>
  `;

  // Store raw markdown for copying
  section._rawMarkdown = markdown;
  section._topic = topic;

  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Copy Utilities ───────────────────────────────────────────────

async function copyAsText() {
  const body = $("reportBody");
  if (!body) return;
  await writeClipboard(body.innerText, "Copied plain text!");
}

async function copyAsMarkdown() {
  const section = $("reportSection");
  if (!section._rawMarkdown) return;
  await writeClipboard(section._rawMarkdown, "Copied markdown!");
}

async function writeClipboard(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    const btns = document.querySelectorAll(".copy-btn");
    btns.forEach((b) => (b.textContent = successMessage));
    setTimeout(() => {
      btns[0].textContent = "Copy as text";
      btns[1].textContent = "Copy markdown";
    }, 2000);
  } catch (err) {
    console.error("Clipboard write failed:", err);
  }
}

// ── API Call ─────────────────────────────────────────────────────

/**
 * Build the system prompt for the research agent based on user options.
 * @param {string} depth
 * @param {string} focus
 * @param {string} format
 * @returns {string}
 */
function buildSystemPrompt(depth, focus, format) {
  return `You are an expert AI research agent. Your role is to search the web for current, accurate information on a given topic, then synthesize it into a high-quality, well-structured research report.

RESEARCH GUIDELINES:
- Use the web_search tool to find multiple relevant, authoritative sources
- Cross-reference information across sources for accuracy
- Prioritize recent information (2024–2025) unless historical context is requested
- Include specific data points, statistics, and dates when available
- Cite sources inline or in a dedicated Sources section
- Acknowledge uncertainty where information is limited or conflicting

REPORT FORMAT:
- Depth: ${DEPTH_PROMPTS[depth]}
- Focus: ${FOCUS_PROMPTS[focus]}
- Structure: ${FORMAT_PROMPTS[format]}
- Always end with a "## Key Takeaways" section summarizing the 3–5 most important findings
- Use markdown formatting throughout (## for H2, ### for H3, **bold**, - for bullets)
- Do NOT include a top-level H1 title — it is displayed separately by the UI
- Write in a professional, authoritative, but accessible tone
- Aim for insight, not just summary — tell the reader what matters and why`;
}

/**
 * Main research agent entry point.
 * Validates inputs, calls the Anthropic API with web search,
 * and renders the resulting report.
 */
async function runResearch() {
  // ── 1. Validate inputs ──
  const apiKey = $("apiKeyInput").value.trim();
  const topic  = $("topicInput").value.trim();

  if (!apiKey) {
    $("apiKeyInput").focus();
    setStatus("Please enter your Anthropic API key.", "error");
    return;
  }

  if (!apiKey.startsWith("sk-ant-")) {
    setStatus("API key format looks incorrect. It should start with sk-ant-", "error");
    return;
  }

  if (!topic) {
    $("topicInput").focus();
    setStatus("Please enter a research topic.", "error");
    return;
  }

  // ── 2. Read configuration ──
  const depth  = $("depthSelect").value;
  const focus  = $("focusSelect").value;
  const format = $("formatSelect").value;

  // ── 3. Update UI to loading state ──
  const runBtn = $("runBtn");
  runBtn.disabled = true;
  runBtn.innerHTML = '<span class="btn-icon">⏳</span> Researching...';

  $("reportSection").classList.add("hidden");
  $("reportSection").innerHTML = "";

  // Cycle through pipeline stage messages
  let stageIndex = 0;
  setStatus(PIPELINE_STAGES[stageIndex], "active");
  const stageTimer = setInterval(() => {
    stageIndex = (stageIndex + 1) % PIPELINE_STAGES.length;
    const text = $("statusText");
    if (text) text.textContent = PIPELINE_STAGES[stageIndex];
  }, 3000);

  // ── 4. Build request ──
  const systemPrompt = buildSystemPrompt(depth, focus, format);
  const userMessage  = `Research topic: "${topic}"

Please search the web for current, reliable information on this topic and write a comprehensive research report following all the guidelines provided in the system prompt. Make sure to actively use the web_search tool to retrieve real, up-to-date information rather than relying solely on training data.`;

  const requestBody = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ],
    messages: [
      { role: "user", content: userMessage },
    ],
  };

  // ── 5. Call API ──
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-calls": "true",
      },
      body: JSON.stringify(requestBody),
    });

    clearInterval(stageTimer);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData?.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Extract all text content blocks (Claude may interleave tool_use blocks)
    const textBlocks = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text);

    const reportText = textBlocks.join("\n").trim();

    if (!reportText) {
      throw new Error(
        "The agent did not generate a report. Please try a different topic or check your API key."
      );
    }

    // ── 6. Render report ──
    const timestamp = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    setStatus(`Report complete — generated at ${timestamp}`, "done");
    renderReport(topic, reportText, depth, focus, format);

  } catch (err) {
    clearInterval(stageTimer);
    console.error("Research agent error:", err);
    setStatus(`Error: ${err.message}`, "error");
  }

  // ── 7. Reset button ──
  runBtn.disabled = false;
  runBtn.innerHTML = '<span class="btn-icon">⚡</span> Run Agent';
}

// ── Utilities ────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Event Listeners ──────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Allow pressing Enter in the topic input to trigger research
  $("topicInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runResearch();
    }
  });

  // Allow pressing Enter in the API key input to move to topic
  $("apiKeyInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("topicInput").focus();
    }
  });

  // Auto-hide the API notice if a key is already in input (e.g. after page refresh with autofill)
  $("apiKeyInput").addEventListener("input", () => {
    const notice = document.getElementById("apiNotice");
    if (notice && $("apiKeyInput").value.trim()) {
      notice.style.display = "none";
    }
  });
});
