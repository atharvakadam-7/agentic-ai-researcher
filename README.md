#  Agentic AI Researcher

> An autonomous AI research agent that searches the web in real-time, synthesizes findings using Claude, and generates structured reports on any topic.




---

##  What It Does

This project implements an **agentic AI pipeline** — similar in concept to CrewAI or LangGraph multi-agent systems — using the Anthropic Claude API with a built-in web search tool.

**User enters a topic → Agent searches the web → Agent synthesizes findings → Structured report is generated**

The agent autonomously decides what to search, retrieves live web data, cross-references sources, and formats the output based on your configuration.

---

##  Live Demo

**[→ Try it on GitHub Pages](https://atharvakadam-7.github.io/agentic-ai-researcher)**

> You'll need an [Anthropic API key](https://console.anthropic.com/settings/keys) to use the live demo.

---

##  Features

| Feature | Description |
|---|---|
|  **Live web search** | Agent retrieves real-time information — not just training data |
|  **Agentic pipeline** | Multi-step: search → analyze → synthesize → format |
|  **Configurable depth** | Concise brief / Full report / Deep dive |
|  **Focus modes** | General / Technical / Business / Latest developments |
|  **Output formats** | Research report / Executive brief / Bullet summary |
|  **Copy to clipboard** | Export as plain text or raw markdown |
|  **Dark mode** | Automatic system dark mode support |
|  **Responsive** | Works on mobile, tablet, and desktop |
|  **Accessible** | Semantic HTML, ARIA labels, keyboard navigation |

---

##  Architecture

This project mirrors the architecture of multi-agent frameworks like **CrewAI** and **LangGraph**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Agentic Pipeline                         │
│                                                             │
│  [Input Agent]  →  [Search Agent]  →  [Synthesis Agent]    │
│   Validate &       Claude API +        Claude processes     │
│   configure        web_search tool     all retrieved docs   │
│   parameters       runs live queries   & cross-references   │
│                                              ↓              │
│                                      [Report Agent]         │
│                                       Formats output        │
│                                       as structured         │
│                                       markdown report       │
└─────────────────────────────────────────────────────────────┘
```

In a production CrewAI setup, these would be separate agent classes. Here, they are implemented as a single agentic API call with Claude's `web_search` tool — demonstrating the same data flow in a minimal, deployable package.

---

##  Project Structure

```
agentic-ai-researcher/
│
├── index.html          # Main HTML — app shell, layout, semantic structure
├── src/
│   ├── styles.css      # Full CSS — theming, dark mode, responsive layout
│   └── app.js          # Core logic — agent pipeline, API calls, markdown renderer
│
└── README.md           # This file
```

**No build tools. No npm install. No framework.** Just HTML, CSS, and vanilla JavaScript — deployable anywhere.

---

##  Setup & Usage

### Option 1 — Run Locally

```bash
# Clone the repository
git clone https://github.com/atharvakadam-7/agentic-ai-researcher.git
cd agentic-ai-researcher

# Open in browser (no server needed)
open index.html
```

> For best results with certain browsers, serve over localhost:
> ```bash
> npx serve .
> # or
> python3 -m http.server 8080
> ```

### Option 2 — Deploy to GitHub Pages

1. Fork or push this repo to your GitHub account
2. Go to **Settings → Pages**
3. Set **Source** to `main` branch, `/ (root)` folder
4. Visit `https://atharvakadam-7.github.io/agentic-ai-researcher`

### Using the App

1. Enter your **Anthropic API key** (get one at [console.anthropic.com](https://console.anthropic.com/settings/keys))
2. Type a **research topic** (or click a quick-topic chip)
3. Configure **depth**, **focus**, and **format**
4. Click **Run Agent** — the agent will search the web and generate your report

---

##  API Key & Security

- Your API key is entered in-browser and sent **directly to Anthropic's API** — it never touches any third-party server
- The key is stored only in memory (the input field) and is never persisted to `localStorage` or cookies
- For production deployments, consider routing API calls through a secure backend to keep your key server-side

---

##  Tech Stack

| Technology | Usage |
|---|---|
| **HTML5** | Semantic markup, ARIA accessibility |
| **CSS3** | Custom properties, dark mode, responsive grid |
| **Vanilla JavaScript (ES2020)** | Agent logic, API calls, markdown rendering |
| **Anthropic Claude API** | LLM backbone for synthesis and report writing |
| **Claude `web_search` tool** | Real-time web data retrieval |
| **Google Fonts** | DM Serif Display, DM Mono, Outfit |

---

##  Key Code Concepts

### Agent Pipeline (app.js)

```javascript
// The core pipeline runs as a single agentic API call
// with the web_search tool enabled — Claude autonomously
// decides what to search, how many queries to run, and
// how to synthesize the results.

const requestBody = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4000,
  system: buildSystemPrompt(depth, focus, format), // configures agent behaviour
  tools: [{ type: "web_search_20250305", name: "web_search" }],
  messages: [{ role: "user", content: userMessage }],
};
```

### Markdown Renderer (app.js)

A lightweight custom markdown-to-HTML renderer — no external library needed:

```javascript
function renderMarkdown(markdown) {
  // Handles: ## headings, **bold**, *italic*,
  // [links](url), bullet lists, ordered lists, blockquotes
}
```

### Dark Mode (styles.css)

Full dark mode via CSS custom properties + `prefers-color-scheme`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg:   #18181a;
    --color-text: #f0ede8;
    /* ... all tokens redefined ... */
  }
}
```

---

##  Extending to True Multi-Agent (CrewAI / LangGraph)

To evolve this into a full CrewAI or LangGraph architecture:

**CrewAI approach:**
```python
from crewai import Agent, Task, Crew

search_agent = Agent(role="Web Researcher", tools=[SerperDevTool()])
analyst_agent = Agent(role="Research Analyst", llm=ChatAnthropic())
writer_agent  = Agent(role="Report Writer",   llm=ChatAnthropic())

crew = Crew(agents=[search_agent, analyst_agent, writer_agent], ...)
crew.kickoff(inputs={"topic": "fusion energy"})
```

**LangGraph approach:**
```python
from langgraph.graph import StateGraph

graph = StateGraph(ResearchState)
graph.add_node("search",    search_node)
graph.add_node("analyze",   analyze_node)
graph.add_node("write",     write_node)
graph.add_edge("search", "analyze")
graph.add_edge("analyze", "write")
```

This project implements the same conceptual pipeline as a single-file web app, making it easy to understand and deploy.

---

##  License

MIT License — free to use, modify, and distribute. See [LICENSE](LICENSE) for details.

---

##  Author

**Your Name**
- GitHub: [@atharvakadam-7](https://github.com/atharvakadam-7)
- LinkedIn: [atharvakadam77](https://linkedin.com/in/atharvakadam77)


---


