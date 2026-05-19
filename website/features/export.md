# Export & Sharing

NavSlides Editor supports multiple export formats so you can share your presentation in any context — live on the web, offline at a conference, or embedded in a document.

## HTML export (standalone)

The default HTML export produces a **self-contained `.html` file** that loads reveal.js and other assets from a CDN.

- Open your presentation in the editor.
- Click **File → Export → HTML**.
- Save the `.html` file to your computer.
- Open the file in any browser to present.

::: tip
Standalone HTML is the smallest file format because assets are fetched from a CDN at runtime. Use it when you expect an internet connection.
:::

## Offline HTML

Offline HTML inlines all external CSS, JavaScript, and font assets so the file works **without any internet connection**.

- Click **File → Export → Offline HTML**.
- The export process downloads all CDN assets and inlines them — this may take a few seconds.
- The resulting file is self-contained and can be copied to a USB drive or shared by email.

::: tip
Use offline HTML when presenting at a conference venue where Wi-Fi may be unreliable, or when distributing slides to students.
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

Export a **PowerPoint-compatible `.pptx` file** for editing in Microsoft Office, Google Slides, or LibreOffice Impress.

- Click **File → Export → PPTX**.
- Text, images, and basic shapes are exported as editable PowerPoint elements.
- Complex elements (LaTeX blocks, charts) are rasterized as images in the PPTX.

## Shareable links

Generate a **shareable URL** that others can open to view (or edit) your presentation directly in their browser — no installation required.

- Click **Share → Get Link**.
- Choose **View only** or **Editable**.
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
