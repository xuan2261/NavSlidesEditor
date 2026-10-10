# Export & Sharing

NavSlides Editor supports multiple export formats so you can share your presentation in any context — live on the web, offline at a conference, or embedded in a document.

## HTML export (standalone)

Standard HTML export creates a `.html` file that references the manifest-owned local `/vendor/` runtime, not a CDN. It is not a fully self-contained offline file.

- Open your presentation in the editor.
- Click **File → Export → HTML**.
- Save the `.html` file to your computer.
- Open the file in any browser to present.

::: tip
Keep the referenced local runtime and media reachable when opening standard HTML. See [Export Fidelity and Known Limitations](https://github.com/xuan2261/NavSlidesEditor/blob/master/docs/export-fidelity-and-limits.md#revealjs-runtime-contract) for the runtime owner and asset requirements.
:::

## Offline HTML

Offline HTML inlines the required published local runtime assets and fails closed if a required asset is missing. This does not make arbitrary external iframes, scripts, media, or services available offline.

- Click **File → Export → Offline HTML**.
- The export process embeds the required local runtime assets.
- Save the resulting file for offline delivery; check any external content separately.

::: tip
Use offline HTML for unreliable Wi-Fi, but test the exported deck on the presentation machine. External embeds, AI providers, and cloud sync still require their respective resources or network services.
:::

## PDF

Export a **print-ready PDF** using the browser's print dialog with reveal.js print styles applied.

- Click **File → Export → PDF**.
- The editor opens a print-optimized view in a new tab with all fragments expanded.
- Use **Ctrl+P** (or Cmd+P) and choose "Save as PDF" in the print dialog.
- Set margins to "None" for best results.

::: warning
PDF export relies on the browser's print engine. Complex layouts, custom fonts, or TikZ diagrams may render slightly differently than on-screen. Check the print preview before finalizing.
:::

## PPTX (PowerPoint)

See [PPTX Import & Export](/features/pptx-import-export) to choose between **Download Original**, **Export Validated Edited Revision**, and **Generate Reconstructed PPTX**. These modes have different recovery, validation, and editability limits; a generated file is not evidence of qualified Microsoft Office or Google Slides editing fidelity.

## Shareable links

Generate a **view-only URL** that others can open in their browser. Share links do not grant collaborative editing access.

- Click **Share → Get Link**.
- Optionally name the link and set a password or expiration.
- Copy and share the URL.

::: tip
Shareable links require your NavSlides Editor instance to be accessible from the internet (or your local network). If running locally behind a firewall, share the exported HTML file instead.
:::

## GitHub sync & hosting

Push your presentations to a **GitHub repository** and host them for free with **GitHub Pages** — no separate hosting setup required.

### Setting up GitHub

1. Open any presentation and click the **GitHub** button in the top toolbar.
2. Enter your **repository owner** (your username or org) and **repository name**.
3. Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope and paste it into the token field.
4. Optionally set a **Pages URL** if you use a custom domain (e.g. `https://yoursite.com/presentations`). If left blank, it defaults to `https://<owner>.github.io/<repo>`.
5. Click **Save Settings**.

This configuration is saved once and reused across all your presentations.

### Pushing a presentation

1. Click the **GitHub** button, enter an optional commit message, and click **Push to GitHub**.
2. NavSlides Editor exports a self-contained `presentation.html` and the raw `presentation.json` into a folder named after your presentation title.
3. All images and assets referenced in the presentation are uploaded alongside the HTML into an `assets/` subfolder.
4. A `README.md` at the repo root is automatically generated with links to all your pushed presentations.

Each push creates a new commit, so you get full version history of every presentation in the repo.

### Hosting on GitHub Pages

Once pushed, you can serve your presentations as a live website using GitHub Pages:

1. Go to your repository on GitHub → **Settings → Pages**.
2. Under **Source**, select the branch (usually `main`) and folder (`/ (root)`).
3. Click **Save**. GitHub will publish your site within a minute or two.
4. Your presentations are now live at `https://<owner>.github.io/<repo>/<folder>/presentation.html`.

The auto-generated `README.md` contains direct links to every presentation. You can share these links with anyone — they load instantly in any browser with no login or software required.

::: tip
If you have multiple presentations in one repo, they each get their own folder. Push as many as you like — the README index updates automatically with every push.
:::

### Version history from GitHub

NavSlides Editor can also pull commit history from GitHub to browse and restore previous versions of a presentation:

- Click the **History** button (clock icon) in the editor toolbar.
- Browse past commits with timestamps and messages.
- Click any version to preview it, and restore it if needed.

This gives you git-backed version control in addition to the built-in snapshot system.
