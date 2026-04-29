# Research Report: PPTAgent / DeepPresenter

**Repository:** https://github.com/icip-cas/PPTAgent
**Date:** 2026-04-26
**Stars:** 4.2k | **Forks:** 509
**License:** MIT
**Papers:** PPTAgent (EMNLP 2025), DeepPresenter (ACL 2026)

---

## 1. What Is This Project?

PPTAgent, now evolved into **DeepPresenter**, is an open-source agentic framework for autonomous PowerPoint/presentation generation. It uses a dual-agent architecture (Researcher + Presenter) that collaborates through a shared file system to go from prompts/documents/images to polished slide decks. The project comes from ICAS (Institute of Computing, Chinese Academy of Sciences).

**Tech stack:**
- Python 69.9%, JavaScript 21.1%, TypeScript 7.5%, Dockerfile, Shell
- Recommended model: fine-tuned **DeepPresenter-9B** (GGUF or full weights on HuggingFace/ModelScope)
- Deployment: CLI (`uvx pptagent`), source build, Docker Compose (port 7861)
- Platforms: Linux/macOS only; Windows requires WSL

---

## 2. Features & Capabilities

- Multi-format input: documents, PDFs, spreadsheets, images, natural language prompts
- Freeform generation: text-to-image assets, visual design, autonomous tool use
- Sandboxed agent environment with **20+ tools** across 5 categories:
  - **Retrieve**: search_web, search_images, search_papers, fetch_url, get_paper_authors, document_analyze, image_caption
  - **File**: convert_to_markdown, read_file, write_file, move_file, edit_file, download_file, execute_command, create_directory, list_directory
  - **Reason**: think, inspect_slide, inspect_manuscript
  - **Control**: todo_create, todo_update, todo_list, finalize
  - **Create**: image_generation
- Deep Research integration (autonomous web searching, paper retrieval)
- Template-based and freeform generation modes
- PPTX export, offline mode
- Text-to-image generation and autonomous visual asset creation
- MCP server support for extended tool access
- PPTEval multi-dimensional evaluation (Content, Design, Coherence)

---

## 3. Key Technical Approaches

### Dual-Agent Architecture
- **Researcher Agent**: autonomously explores, retrieves, and synthesizes information into a structured markdown manuscript (`ℳ`), adapting depth/strategy to user intent.
- **Presenter Agent**: generates slides as HTML files, develops a global design plan (color themes, typography) aligned with narrative content.
- Agents coordinate via a shared file system (`ℱ`) and observation space (`ℰ`).

### Environment-Grounded Reflection (Core Innovation)
Agents ground self-correction in **perceptual artifact states** (post-render observations), not introspective reasoning over internal signals. Two inspection tools enable this:
- **inspect_manuscript**: parses markdown, returns diagnostics (slide count, language, asset availability, broken references).
- **inspect_slide**: renders an HTML slide to a pixel image via headless browser, exposing post-render defects (overflow, overlap, low contrast, broken images).
- Forms an **observe–reflect–revise loop** where agent observations align with user perception.

### Two-Stage Edit-Based Slide Generation (Original PPTAgent)
1. Analyze reference slides to extract functional types and content schemas.
2. Iteratively draft and edit new slides via editing actions (mirrors human workflows).

### PPTEval Assessment Framework
Multi-dimensional evaluation covering:
- **Content**: accuracy, completeness
- **Design**: visual appeal, layout
- **Coherence**: narrative flow, structural consistency

---

## 4. AI Features

- Dual fine-tuned agents with `think` tool for reasoning
- Autonomous web search, academic paper retrieval, and synthesis
- Environment-grounded reflection using rendered slide inspection
- Text-to-image generation for visual assets
- Extrinsic verification-guided trajectory synthesis to mitigate self-verification bias
- Fine-tuned **DeepPresenter-9B** (GLM-4.6V-Flash base, MS-SWIFT training, 5 epochs, ~80 GPU hours on 8×A800)

---

## 5. How It Generates/Edits PowerPoint Presentations

1. User provides prompt or source documents (PDF, images, etc.)
2. Researcher Agent autonomously gathers and synthesizes information into markdown manuscript (`ℳ`)
3. Presenter Agent develops a global design plan (themes, typography)
4. Presenter Agent generates slides iteratively as HTML files
5. **inspect_slide** renders each slide to an image via headless browser
6. Agent reflects on rendered state and revises targeted defects
7. Final HTML slides are exported to PPTX format

---

## 6. Unique or Innovative Features

- **Environment-grounded reflection**: novel approach where agents condition corrections on *perceptual artifact states* rather than self-reflection over reasoning traces — ablation shows +0.12 avg improvement.
- **Dual-agent collaboration**: separating research and presentation into specialized agents; ablation shows +0.40 avg improvement.
- **PPTEval**: first multi-dimensional evaluation framework for presentations (Content + Design + Coherence), not just text-based metrics.
- **Two-stage edit-based generation**: mirrors human slide authoring workflows rather than raw text-to-slides.
- **Extrinsic verification**: independent critic decoupled from agent trajectory state, providing reasoning traces that steer targeted revisions — yields +0.20 avg over fine-tuning alone.

---

## 7. Evaluation Results (vs. Commercial Baselines)

| Method | Constraint | Content | Style | Avg. | Diversity |
|--------|-----------|---------|-------|------|-----------|
| Gamma (commercial) | 4.93 | 4.08 | 4.08 | 4.36 | 0.52 |
| DeepPresenter (Gemini-3-Pro) | 4.70 | 4.25 | 4.37 | **4.44** | **0.79** |
| DeepPresenter-9B | 4.77 | 3.52 | 4.29 | **4.19** | 0.53 |

DeepPresenter (Gemini-3-Pro) surpasses Gamma by +0.08 avg. DeepPresenter-9B matches GPT-5-level performance (4.19 vs 4.22) at significantly lower cost.

---

## 8. Relevance to NavSlidesEditor

- **Direct competitor** in AI-assisted presentation generation
- NavSlidesEditor currently uses reveal.js (HTML-based); PPTAgent generates PPTX — different output format but similar user-facing goals
- PPTAgent's PPTEval framework could inspire quality metrics for NavSlidesEditor exports
- The environment-grounded reflection (inspect_slide) approach could inform an **AI-assisted editing/refinement** feature within NavSlidesEditor's canvas
- The MCP server integration suggests a pathway for extending NavSlidesEditor with external AI agent tools

---

## Unresolved Questions

- What is the exact PPTX library used for export (python-pptx vs. direct XML manipulation)?
- How does the markdown manuscript schema map to slide element types?
- Is there any collaborative editing or real-time co-authoring support?
- What is the fine-tuned DeepPresenter-9B's context window size and max output length?
- Does PPTEval integrate into the CLI tool, or is it a separate evaluation-only component?

---

## Sources

- [GitHub - icip-cas/PPTAgent](https://github.com/icip-cas/PPTAgent)
- [arXiv - DeepPresenter (ACL 2026)](https://arxiv.org/abs/2602.22839)
- [arXiv - PPTAgent (EMNLP 2025)](https://arxiv.org/abs/2501.03936)
- [DeepPresenter HTML Paper](https://arxiv.org/html/2602.22839v3)
