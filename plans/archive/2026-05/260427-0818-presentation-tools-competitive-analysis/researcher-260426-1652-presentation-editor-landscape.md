# Research Report: Presentation Editor / Slide Editor Landscape

**Date:** 2026-04-26
**Context:** NavSlides Editor — reveal.js-based WYSIWYG presentation editor
**Sources:** GitHub (gh CLI search), WebFetch (README extraction)

---

## Executive Summary

Checked 50+ repos across: reveal.js ecosystem, markdown presentation tools, AI presentation generators, WYSIWYG slide editors, and alternative presentation frameworks. Most active open-source projects are **markdown-based authoring tools** (not visual editors), and most AI presentation tools are immature (<500 stars, no production deployment). No direct competitor matches NavSlides Editor's full feature set (WYSIWYG + reveal.js + PPTX export + live presentation + collaboration).

---

## 1. reveal.js Ecosystem

### 1.1 reveal.js (Core Framework)
- **URL:** https://github.com/hakimel/reveal.js
- **Stars:** 71.1k — MIT
- **Tech:** JavaScript (46%), HTML, TypeScript, SCSS
- **Desc:** HTML presentation framework — the foundation NavSlides Editor builds on
- **Status:** Very active, single most-starred slide framework on GitHub
- **Key insight:** Reveal.js is a **renderer/player**, not an editor. NavSlides Editor's core differentiator (WYSIWYG visual editor for reveal.js) has no mature open-source competitor.

### 1.2 reveal-md
- **URL:** https://github.com/webpro/reveal-md
- **Stars:** 3.9k — MIT
- **Tech:** JavaScript, Node.js
- **Desc:** "reveal.js on steroids" — converts Markdown files to reveal.js HTML. Supports custom themes, speaker notes, live reload, PDF export via Puppeteer/DeckTape.
- **Status:** No longer actively maintained. README recommends MkSlides (successor) and Slidev as alternatives.
- **Key insight:** Not a visual editor; purely a CLI converter.

### 1.3 RISE (Reveal.js IPython Slideshow Extension)
- **URL:** https://github.com/damianavila/RISE
- **Stars:** 3.7k — MIT
- **Tech:** JavaScript (73%), Python, Jupyter Notebook
- **Desc:** Turns Jupyter Notebooks into live reveal.js slideshows with one-keystroke toggle between notebook view and slideshow.
- **Status:** Active development. **Limitation:** Only works with classic Jupyter Notebook, not JupyterLab.
- **Key insight:** Niche tool for data scientists; no overlap with NavSlides Editor's user base.

### 1.4 kreator.js
- **URL:** https://github.com/piatra/kreator.js
- **Stars:** 232 — Apache 2.0
- **Tech:** JavaScript (52%), CSS, HTML
- **Desc:** Browser-based GUI editor for reveal.js. Live preview, remote control via shared code for presenter mode.
- **Status:** Low activity. Last meaningful update ~2019.
- **Key insight:** **Closest to a visual editor for reveal.js** — but primitive compared to NavSlides Editor. No PPTX export, no live collaboration.

### 1.5 reveal.js-plugins
- **URL:** https://github.com/rajgoel/reveal.js-plugins
- **Stars:** 806 — MIT
- **Desc:** Collection of reveal.js plugins: chart, code highlighting, math, menu, etc.
- **Key insight:** Could be inspiration for NavSlides Editor plugin architecture.

---

## 2. Markdown Presentation Ecosystem

### 2.1 Slidev
- **URL:** https://github.com/slidevjs/slidev
- **Stars:** 46k — MIT
- **Tech:** TypeScript (67%), Vue 28%, Vite, Shiki, Monaco Editor, UnoCSS, RecordRTC, VueUse, Drauu (drawing), KaTeX, Mermaid
- **Desc:** "Presentation slides for developers" — write in Markdown with Vue component support, powered by Vite HMR.
- **Status:** Very active (v52.14.2, Apr 2026). 46k stars, 2k forks. Discord community.
- **Features:** MDX authoring, code highlighting + live coding, themes via npm, LaTeX math, Mermaid diagrams, presenter mode, drawing annotation, recording, PDF/PNG/PPTX export.
- **Unique:** **AI app for Slidev** exists separately (271 stars) — converts text to Slidev presentations using LLMs.
- **Key insight:** **Strongest competitor for developer audience.** No visual WYSIWYG editor — pure code-based. NavSlides Editor could differentiate as the "visual" alternative to Slidev's code-based workflow.

### 2.2 Marp (Markdown Presentation Ecosystem)
- **URL:** https://github.com/marp-team/marp
- **Stars:** 11.5k — MIT
- **Tech:** TypeScript (91%), Marp Core, Marp CLI, Marp for VS Code
- **Desc:** Write presentations in plain Markdown, export to HTML, PDF, PPTX. Ecosystem: Marpit (skinny framework), Marp Core (converter with themes), Marp CLI (build tool), VS Code extension.
- **Status:** Active (264 contributors). VS Code extension has 2k stars.
- **Features:** MD → HTML/PDF/PPTX export, built-in themes, 38+ community themes, CLI tool, PDF export.
- **Key insight:** Marp CLI directly competes with NavSlides Editor's PPTX export feature. Marp's VS Code extension is excellent for developer workflow. **NavSlides Editor's WYSIWYG editor is the key differentiator** over Marp.

### 2.3 Fusuma
- **URL:** https://github.com/hiroppy/fusuma
- **Stars:** 5.4k — (License not specified, appears MIT)
- **Tech:** JavaScript (98%), EJS, webpack, Babel
- **Desc:** "Makes slides with Markdown easily." Zero-config CLI tool.
- **Status:** Archived (read-only since Dec 2024).
- **Features:** MD/MDX support, built-in themes, code highlighting, MathJax, diagrams, presenter mode, PDF export.
- **Key insight:** Archived. Not a competitor to evaluate.

### 2.4 Eagle.js
- **URL:** https://github.com/Zulko/eagle.js
- **Stars:** 4.1k — ISC
- **Tech:** Vue 2, JavaScript, SCSS
- **Desc:** "Hackable slideshow framework for hackers" built on Vue.js. Provides slide/slideshow components as a Vue mixin.
- **Status:** Maintained but recommends Slidev for Vue 3 projects.
- **Features:** Interactive widgets, nested slideshows, presenter mode, zoom plugin, theming.
- **Key insight:** Vue-based, not reveal.js. For Vue users who want hackability over WYSIWYG.

### 2.5 Backslide
- **URL:** https://github.com/sinedied/backslide
- **Stars:** 778 — MIT
- **Tech:** JavaScript (78%), SCSS, Remark.js
- **Desc:** CLI tool for making HTML slide presentations from Markdown using Remark.js.
- **Status:** Moderate activity.
- **Features:** Live preview, self-contained HTML export, PDF via DeckTape, Docker runner.
- **Key insight:** Simple CLI tool, no visual editing.

---

## 3. Alternative Presentation Frameworks

### 3.1 impress.js
- **URL:** https://github.com/impress/impress.js
- **Stars:** 38.2k — MIT
- **Tech:** JavaScript (88%), CSS
- **Desc:** Prezi-like "zooming" presentation framework using CSS3 transforms. No external dependencies.
- **Status:** Stable, low-maintenance.
- **Key insight:** Different UX paradigm (zooming canvas vs linear slides). Impressionist GUI editor exists (711 stars, visual tool for impress.js).

### 3.2 WebSlides
- **URL:** https://github.com/webslides/WebSlides
- **Stars:** 6.3k — MIT
- **Tech:** JavaScript (49%), CSS (46%), HTML
- **Desc:** "Create HTML presentations in seconds" — component-based CSS/HTML library. Each `<section>` is a slide.
- **Status:** Last release Sep 2017 — stale.
- **Features:** 40+ components, horizontal/vertical navigation, 6 built-in themes.
- **Key insight:** Stale project. No PPTX export, no visual editor.

### 3.3 Bespoke.js
- **URL:** https://github.com/bespokejs/bespoke
- **Stars:** 4.8k — MIT
- **Tech:** JavaScript (100%)
- **Desc:** "DIY Presentation Micro-Framework" — 1KB core, plugin-based. Designed to foster a rich plugin ecosystem.
- **Status:** Stable, minimal maintenance.
- **Key insight:** Micro-framework, not a full editor. Strut (see below) provides GUI for Bespoke.js.

### 3.4 Sozi
- **URL:** https://github.com/sozi-projects/Sozi
- **Stars:** 1.7k — MPL 2.0
- **Tech:** JavaScript (93%), Electron
- **Desc:** SVG-native "zooming" presentation tool. Presentations are SVG documents with zoom/pan frames.
- **Status:** Active.
- **Features:** Desktop Electron app, frame-based navigation, FFmpeg video export.
- **Key insight:** Unique SVG-native approach. Not HTML-based, so no overlap with NavSlides Editor.

### 3.5 DeckDeckGo
- **URL:** https://github.com/deckgo/deckdeckgo
- **Stars:** 1.7k — (License not clearly visible)
- **Tech:** TypeScript (72%), StencilJS web components, Firebase, AWS, Monaco Editor
- **Desc:** "The web open source editor for presentations" — create, present, share slides as PWAs.
- **Status:** Active (137 releases, 193 forks). Monorepo with 6,765 commits.
- **Features:** Online editor, remote control via mobile app, live polls, YouTube integration, code highlighting, offline support, Figma import, 17 web component packages (charts, math, markdown, excalidraw, etc.).
- **Key insight:** **Most feature-rich open-source presentation editor on GitHub.** StencilJS web components could be inspiration. Monaco Editor integration matches NavSlides Editor's code editing needs. No PPTX export mentioned.

---

## 4. AI-Powered Presentation Tools

### 4.1 Presenton
- **URL:** https://github.com/presenton/presenton
- **Stars:** 4.8k — Apache 2.0
- **Tech:** TypeScript (45%), JavaScript (43%), Python (10%)
- **Desc:** "Open-Source AI Presentation Generator and API (Gamma, Beautiful AI, Decktopus Alternative)"
- **Status:** Active, 942 forks. Self-hosted Docker or Electron desktop app.
- **Features:** Multi-LLM (OpenAI, Gemini, Claude, Ollama), REST API at `/api/v1/ppt/presentation/generate`, custom HTML/Tailwind templates, AI template creation from PPTX, DALL-E 3/Gemini image gen, PPTX + PDF export, MCP server, Mem0 memory per presentation.
- **Key insight:** **Most mature AI presentation generator on GitHub.** Architecture (multi-LLM, template system, PPTX export) is directly relevant to NavSlides Editor's AI roadmap. Apache 2.0 license is permissive.

### 4.2 presentation-ai
- **URL:** https://github.com/allweonedev/presentation-ai
- **Stars:** 2.8k — MIT
- **Tech:** Next.js, React, TypeScript, Tailwind CSS, PostgreSQL + Prisma, NextAuth.js (Google OAuth), Radix UI, DnD Kit, UploadThing
- **Desc:** "Gamma.app alternative" — AI-powered presentation generator with outline-first workflow.
- **Status:** Active, 2.8k stars.
- **Features:** Outline-first workflow (generate outline → review/edit → build slides), 38 built-in themes, PPTX theme import, presentation mode with webcam/mic recording, PPTX export, Ollama/LM Studio for offline.
- **Key insight:** **Outline-first AI workflow** is worth studying. PPTX theme import is directly relevant to NavSlides Editor's import feature.

### 4.3 slidev-ai
- **URL:** https://github.com/LSTM-Kirigaya/slidev-ai
- **Stars:** 271 — MIT
- **Tech:** Vue (48%), TypeScript (45%), NestJS backend, SQLite, Puppeteer
- **Desc:** AI-powered conversion of text content into Slidev presentations. Two-container Docker deployment.
- **Status:** Moderate activity.
- **Features:** LLM-powered slide generation, PDF export via Puppeteer, OpenMCP ecosystem integration.
- **Key insight:** Integrates AI with Slidev — potential model for NavSlides Editor's AI feature.

### 4.4 Other AI Tools (< 100 stars)
- Most AI presentation tools on GitHub are: Python scripts with no UI, abandoned projects, or prototypes.
- **Notable:** `presentrinity` (5 stars, Slidev + Gemini), `SlideAI` (156 stars, Google Apps Script + OpenAI + Google Slides API — serverless).

---

## 5. Visual / WYSIWYG Slide Editors

### 5.1 Strut
- **URL:** https://github.com/tantaman/strut
- **Stars:** 1.9k — AGPL 3.0
- **Tech:** TypeScript (47%), HTML (38%), Vite, Turbo, pnpm, cr-sqlite (via vlcn.io)
- **Desc:** "An Impress.js and Bespoke.js Presentation Editor" — GUI visual editor.
- **Status:** Being revived with modern rewrite. Real-time collaboration + offline-first via vlcn.io.
- **Features:** Drag-and-drop editor, collaborative editing, offline support.
- **Key insight:** **Only actively-developed visual editor** for an impress.js-based workflow. AGPL is a restrictive license for NavSlides Editor to learn from. Collaboration via cr-sqlite/vlcn.io is worth studying.

### 5.2 Impressionist
- **URL:** https://github.com/harish-io/Impressionist
- **Stars:** 711 — CC BY 3.0 + MIT dual license
- **Tech:** JavaScript (99%), jQuery, Flat-UI
- **Desc:** Visual tool to create impress.js presentations. Drag-to-reorder slides, orchestration view, real-time preview.
- **Status:** Low activity.
- **Key insight:** No longer actively maintained.

### 5.3 react-design-editor
- **URL:** https://github.com/angellikgh/react-design-editor
- **Stars:** 136 — MIT
- **Tech:** TypeScript (99%), React, PixiJS, Vite
- **Desc:** "Design editor including Graphic editor, Presentation editor, Video editor."
- **Status:** Low activity.
- **Features:** Canvas-based editing (PixiJS), graphic + presentation + video editing.
- **Key insight:** PixiJS canvas approach could inspire rendering layer. Docker/Nginx deployment configs.

### 5.4 deckbuilder
- **URL:** https://github.com/zohaibus/deckbuilder
- **Stars:** 6 — MIT
- **Tech:** Pure HTML/CSS/JavaScript — zero dependencies
- **Desc:** "A local-first presentation editor in a single HTML file."
- **Features:** Visual drag-and-drop editing, PDF export, Git-friendly output, undo/redo, no install required.
- **Key insight:** Zero-dependency philosophy is extreme but interesting for longevity. Git-friendly output.

### 5.5 Browsercast
- **URL:** https://github.com/ReDEnergy/Browsercast
- **Stars:** 18 — MPL 2.0
- **Tech:** JavaScript (75%), CSS, Handlebars, Require.js
- **Desc:** HTML5 presentation editor with audio voice-over synchronization.
- **Key insight:** Voice-over sync is a unique feature NavSlides Editor could consider for live presentations.

---

## 6. Presentation / Sharing Platforms

### 6.1 Presentator
- **URL:** https://github.com/presentator/presentator
- **Stars:** 1.4k — BSD 3-Clause
- **Tech:** Go, PocketBase (embedded DB), Svelte, SCSS
- **Desc:** "Free and open-source design feedback and presentation platform" — upload screens, annotate, share via links.
- **Status:** Active.
- **Features:** Visual commenting on mockups, hotspot annotations, OAuth2 (Google, MS, GitHub), S3 storage, SMTP notifications, single executable deployment.
- **Key insight:** Go + PocketBase stack for self-hosted deployment is interesting. Figma/XD plugins. Not a slide editor — focuses on design feedback workflow.

---

## 7. Comparative Analysis

### Feature Matrix

| Project | WYSIWYG Editor | Markdown | PPTX Export | AI Gen | Live Pres | License |
|---|---|---|---|---|---|---|
| **NavSlides Editor** | YES | YES | YES | Partial | YES | MIT |
| **Slidev** | NO | YES | YES | Via ext | YES | MIT |
| **Marp** | NO (VS Code) | YES | YES | NO | NO | MIT |
| **Presenton** | NO | NO | YES | YES | NO | Apache 2.0 |
| **presentation-ai** | NO | NO | YES | YES | Recording | MIT |
| **Strut** | YES | NO | NO | NO | NO | AGPL 3.0 |
| **DeckDeckGo** | YES (web) | NO | NO | NO | YES | (unspecified) |
| **kreator.js** | YES (basic) | NO | NO | NO | YES | Apache 2.0 |
| **reveal-md** | NO | YES | NO | NO | NO | MIT |
| **Eagle.js** | NO | NO | NO | NO | YES | ISC |

### Gap Analysis for NavSlides Editor

**What NavSlides Editor already has that competitors lack:**
- WYSIWYG + reveal.js combination
- PPTX export from WYSIWYG editor
- Live presentation (Socket.IO)
- Markdown import

**What competitors have that NavSlides Editor could add:**
1. **AI generation** (Presenton, presentation-ai, slidev-ai): Multi-LLM architecture, outline-first workflow, template learning from PPTX
2. **Real-time collaboration** (Strut revival): cr-sqlite/vlcn.io for offline-first CRDT
3. **Voice-over sync** (Browsercast): Narration synchronized with slides
4. **Theme marketplace** (presentation-ai): 38+ themes + PPTX theme import
5. **Remote mobile control** (DeckDeckGo, kreator.js): Dedicated mobile app or web-based presenter view

---

## 8. Recommendations

### High Priority — AI Features
**Model: Presenton + presentation-ai architecture**

| Aspect | Recommendation |
|---|---|
| Architecture | Multi-LLM backend (OpenAI, Gemini, Claude, Ollama) as separate service; expose via REST API |
| Workflow | "Outline-first" — generate outline, user reviews/edits, then build slides |
| Template learning | Parse existing PPTX to learn theme layouts (cf. Presenton's `aiformpfile`) |
| Integration | Add to NavSlides Editor as optional plugin; MCP server for agent integration |
| Adoption risk | MEDIUM — requires LLM API infrastructure; Ollama for offline reduces dependency |
| License concern | Presenton is Apache 2.0 (compatible with MIT) |

### Medium Priority — Collaboration
**Model: Strut revival with cr-sqlite/vlcn.io**

| Aspect | Recommendation |
|---|---|
| Architecture | vlcn.io (CRDT via WebAssembly SQLite) for offline-first real-time sync |
| Trade-off | cr-sqlite bleeding-edge; YAGNI suggests starting with operational transform via Socket.IO |
| Scope | Limit to slide element position/size sync first, full rich-text OT later |
| Adoption risk | MEDIUM — complex distributed systems; Socket.IO extension is lower risk |

### Low Priority — Voice-Over Sync
**Model: Browsercast**

| Aspect | Recommendation |
|---|---|
| Scope | Record narration per slide with timed sync; export as video |
| Tech | Web Audio API + MediaRecorder; mux with FFmpeg (server-side) |
| Adoption risk | LOW (post-MVP) |

---

## Unresolved Questions

1. **Strut's revival timeline?** The cr-sqlite/vlcn.io rewrite is in-progress but no stable release yet. Cannot evaluate implementation stability.
2. **DeckDeckGo's license?** The repo shows no clear license in the README — needs legal review before adopting any code patterns.
3. **Presenton's MCP server details?** Architecture documented but no production deployment examples found.
4. **Marp's PPTX export quality?** Core claim is MD → PPTX fidelity. Needs hands-on testing vs NavSlides Editor's export quality.
5. **Real user counts?** Star counts are a proxy, not a measure of active users. Usage metrics unavailable without product analytics.

---

## Sources

- [reveal.js — GitHub](https://github.com/hakimel/reveal.js)
- [Slidev — GitHub](https://github.com/slidevjs/slidev)
- [Marp — GitHub](https://github.com/marp-team/marp)
- [Fusuma — GitHub](https://github.com/hiroppy/fusuma)
- [Eagle.js — GitHub](https://github.com/Zulko/eagle.js)
- [impress.js — GitHub](https://github.com/impress/impress.js)
- [WebSlides — GitHub](https://github.com/webslides/WebSlides)
- [reveal-md — GitHub](https://github.com/webpro/reveal-md)
- [RISE — GitHub](https://github.com/damianavila/RISE)
- [Presenton — GitHub](https://github.com/presenton/presenton)
- [presentation-ai — GitHub](https://github.com/allweonedev/presentation-ai)
- [slidev-ai — GitHub](https://github.com/LSTM-Kirigaya/slidev-ai)
- [Strut — GitHub](https://github.com/tantaman/strut)
- [DeckDeckGo — GitHub](https://github.com/deckgo/deckdeckgo)
- [kreator.js — GitHub](https://github.com/piatra/kreator.js)
- [Sozi — GitHub](https://github.com/sozi-projects/Sozi)
- [Presentator — GitHub](https://github.com/presentator/presentator)
- [react-design-editor — GitHub](https://github.com/angellikgh/react-design-editor)
- [Browsercast — GitHub](https://github.com/ReDEnergy/Browsercast)
- [deckbuilder — GitHub](https://github.com/zohaibus/deckbuilder)
- [Backslide — GitHub](https://github.com/sinedied/backslide)
