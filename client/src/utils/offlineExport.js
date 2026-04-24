// Offline export: fetch vendor resources from local server and inline them into the HTML.
// Uses a safe inlining technique to avoid </script> breakage inside inlined JS.

async function fetchText(url) {
  try {
    // Ensure absolute URL for fetch
    const fetchUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
    const resp = await fetch(fetchUrl)
    if (!resp.ok) return `/* Failed to fetch: ${url} */`
    return await resp.text()
  } catch {
    return `/* Failed to fetch: ${url} */`
  }
}

/**
 * Fetch a binary resource and return as base64 data URI.
 */
async function fetchAsDataUri(url) {
  try {
    const fetchUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
    const resp = await fetch(fetchUrl)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Cache fetched resources to avoid duplicate requests for same URL
const fetchCache = new Map()
async function cachedFetchText(url) {
  if (fetchCache.has(url)) return fetchCache.get(url)
  const text = await fetchText(url)
  fetchCache.set(url, text)
  return text
}

/**
 * Escape occurrences of </script (case-insensitive) inside inlined JS to prevent
 * premature tag closure. We replace the < in </script with <\/ so the browser's
 * HTML parser never sees a closing tag inside the script block.
 */
function safeInlineJS(js) {
  return js.split('</script').join('<\\/script')
}

/**
 * Normalize a vendor URL to a root-relative path (/vendor/...).
 */
function toVendorPath(url) {
  const idx = url.indexOf('/vendor/')
  return idx >= 0 ? url.slice(idx) : url
}

// Known CDN-to-vendor mappings for offline resolution
const CDN_TO_VENDOR = [
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/d3(?:@[^/"']*)?(?:\/[^"']*)?/i,
    vendor: '/vendor/d3/dist/d3.min.js',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/"']*)?(?:\/[^"']*)?/i,
    vendor: '/vendor/chart.js/dist/chart.umd.js',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/marked(?:@[^/"']*)?(?:\/[^"']*)?/i,
    vendor: '/vendor/marked/marked.min.js',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.js/i,
    vendor: '/vendor/katex/dist/katex.min.js',
  },
  {
    pattern: /cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.css/i,
    vendor: '/vendor/katex/dist/katex.min.css',
  },
  {
    pattern: /cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]*\/d3\.min\.js/i,
    vendor: '/vendor/d3/dist/d3.min.js',
  },
]

function resolveToVendor(url) {
  for (const mapping of CDN_TO_VENDOR) {
    if (mapping.pattern.test(url)) return mapping.vendor
  }
  return null
}

/**
 * Decode HTML entities in a srcdoc attribute value back to raw HTML.
 */
function decodeSrcdoc(raw) {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * Inline vendor scripts and CSS inside a decoded srcdoc HTML string.
 */
async function inlineSrcdocDeps(inner) {
  let changed = false

  // Normalize backslash-escaped closing tags from htmlGenerator template literals
  inner = inner.replace(/<\\\//g, '</')

  // Inline script src with vendor paths
  const vendorScriptMatches = [
    ...inner.matchAll(
      /<script\s+src=["']((?:https?:\/\/[^"']*)?\/(vendor)\/[^"']+)["'][^>]*><\\?\/?script>/gi
    ),
  ]
  for (const sm of vendorScriptMatches) {
    const vendorPath = toVendorPath(sm[1])
    const js = await cachedFetchText(vendorPath)
    const safe = safeInlineJS(js)
    inner = inner.split(sm[0]).join(`<script>/* ${vendorPath} */\n${safe}\n</script>`)
    changed = true
  }

  // Inline script src with external CDN URLs
  const cdnScriptMatches = [
    ...inner.matchAll(/<script\s+src=["'](https?:\/\/[^"']+)["'][^>]*><\\?\/?script>/gi),
  ]
  for (const sm of cdnScriptMatches) {
    const cdnUrl = sm[1]
    const vendorPath = resolveToVendor(cdnUrl)
    const fetchUrl = vendorPath || cdnUrl
    const js = await cachedFetchText(fetchUrl)
    const safe = safeInlineJS(js)
    const comment = vendorPath ? `/* ${vendorPath} (from ${cdnUrl}) */` : `/* ${cdnUrl} */`
    inner = inner.split(sm[0]).join(`<script>${comment}\n${safe}\n</script>`)
    changed = true
  }

  // Inline link href with vendor CSS paths
  const vendorLinkMatches = [
    ...inner.matchAll(
      /<link[^>]*href=["']((?:https?:\/\/[^"']*)?\/(vendor)\/[^"']+\.css)["'][^>]*\/?>/gi
    ),
  ]
  for (const lm of vendorLinkMatches) {
    const vendorPath = toVendorPath(lm[1])
    let css = await cachedFetchText(vendorPath)
    const origin = window.location.origin
    if (vendorPath.includes('katex') && vendorPath.endsWith('.css')) {
      const katexFontsBase = `${origin}/vendor/katex/dist/fonts`
      css = css.replace(/url\(fonts\//g, `url(${katexFontsBase}/`)
      css = css.replace(/url\("fonts\//g, `url("${katexFontsBase}/`)
      css = css.replace(/url\('fonts\//g, `url('${katexFontsBase}/`)
    }
    if (vendorPath.includes('font-awesome') && vendorPath.endsWith('.css')) {
      const faWebfontsBase = `${origin}/vendor/font-awesome/webfonts`
      css = css.replace(/url\(\.\.\/webfonts\//g, `url(${faWebfontsBase}/`)
      css = css.replace(/url\("\.\.\/webfonts\//g, `url("${faWebfontsBase}/`)
      css = css.replace(/url\('\.\.\/webfonts\//g, `url('${faWebfontsBase}/`)
    }
    inner = inner.split(lm[0]).join(`<style>/* ${vendorPath} */\n${css}\n</style>`)
    changed = true
  }

  // Inline link href with external CDN CSS URLs
  const cdnLinkMatches = [
    ...inner.matchAll(/<link[^>]*href=["'](https?:\/\/[^"']+\.css(?:\?[^"']*)?)["'][^>]*\/?>/gi),
  ]
  for (const lm of cdnLinkMatches) {
    const cdnUrl = lm[1]
    const vendorPath = resolveToVendor(cdnUrl)
    const fetchUrl = vendorPath || cdnUrl
    let css = await cachedFetchText(fetchUrl)
    const comment = vendorPath ? `/* ${vendorPath} (from ${cdnUrl}) */` : `/* ${cdnUrl} */`
    inner = inner.split(lm[0]).join(`<style>${comment}\n${css}\n</style>`)
    changed = true
  }

  return { html: inner, changed }
}

export async function generateOfflineHTML(html) {
  let result = html

  // ── 1. Inline all <link> vendor CSS ──────────────────────────────────────
  const cssMatches = [
    ...result.matchAll(
      /<link[^>]*href=["']((?:https?:\/\/[^"']*)?\/(vendor)\/[^"']+\.css)["'][^>]*\/?>/g
    ),
  ]
  for (const match of cssMatches) {
    const rawUrl = match[1]
    const vendorPath = toVendorPath(rawUrl)
    let css = await cachedFetchText(vendorPath)
    const origin = window.location.origin

    // Resolve KaTeX font relative paths to absolute URLs
    if (vendorPath.includes('katex') && vendorPath.endsWith('.css')) {
      const katexFontsBase = `${origin}/vendor/katex/dist/fonts`
      css = css.replace(/url\(fonts\//g, `url(${katexFontsBase}/`)
      css = css.replace(/url\("fonts\//g, `url("${katexFontsBase}/`)
      css = css.replace(/url\('fonts\//g, `url('${katexFontsBase}/`)
    }

    // Resolve Font Awesome webfont relative paths (../webfonts/) to absolute URLs
    if (vendorPath.includes('font-awesome') && vendorPath.endsWith('.css')) {
      const faWebfontsBase = `${origin}/vendor/font-awesome/webfonts`
      css = css.replace(/url\(\.\.\/webfonts\//g, `url(${faWebfontsBase}/`)
      css = css.replace(/url\("\.\.\/webfonts\//g, `url("${faWebfontsBase}/`)
      css = css.replace(/url\('\.\.\/webfonts\//g, `url('${faWebfontsBase}/`)
    }

    result = result.replace(match[0], () => `<style>/* ${vendorPath} */\n${css}\n</style>`)
  }

  // ── 2. Inline all <script> vendor JS ─────────────────────────────────────
  const jsMatches = [
    ...result.matchAll(
      /<script[^>]*src=["']((?:https?:\/\/[^"']*)?\/(vendor)\/[^"']+)["'][^>]*>\s*<\/script>/g
    ),
  ]
  for (const match of jsMatches) {
    const rawUrl = match[1]
    const vendorPath = toVendorPath(rawUrl)
    let js = await cachedFetchText(vendorPath)
    let safe = safeInlineJS(js)

    // Patch plugin scriptPath() after inlining — plugins use
    // document.currentScript.src to locate their images/assets.
    // When inlined (no src attr), currentScript.src is empty → all
    // relative image paths (sponge.png, blackboard.png, cursors) break.
    const _origin = window.location.origin
    if (vendorPath.includes('chalkboard/plugin.js')) {
      const imgRegex = /path \+ '([^']+)'/g
      let match
      const replacements = []
      while ((match = imgRegex.exec(safe)) !== null) {
        replacements.push(match[1]) // e.g. "img/sponge.png"
      }
      for (const imgPath of [...new Set(replacements)]) {
        const cleanPath = imgPath.split(')')[0]
        const dataUri = await fetchAsDataUri(`/vendor/reveal-plugins/chalkboard/${cleanPath}`)
        if (dataUri) {
          const suffix = imgPath.substring(cleanPath.length)
          safe = safe.split(`path + '${imgPath}'`).join(`'${dataUri}${suffix}'`)
        }
      }
      // Replace scriptPath() to return empty string since we inlined everything
      safe = safe.replace('function scriptPath() {', `function scriptPath() { return '';`)
    }
    if (vendorPath.includes('menu/menu.js')) {
      // The menu plugin dynamically loads css using P(...) which breaks offline mode.
      // We already inlined the menu CSS, so we just replace the dynamic loader with a delayed ready callback.
      // Calling M() immediately crashes Reveal since setupDOM hasn't completed yet.
      safe = safe.replace(
        'P(r.path+"menu.css","stylesheet",(function(){void 0===r.loadIcons||r.loadIcons?P(r.path+"font-awesome/css/all.css","stylesheet",M):M()}))',
        '(Reveal.isReady()?M():Reveal.on("ready",M))'
      )
    }

    result = result.split(match[0]).join(`<script>/* ${vendorPath} */\n${safe}\n</script>`)
  }

  // ── 3. Remove Google Fonts & Computer Modern links ──────────────────────
  result = result.replace(
    /<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*\/?>/g,
    '<!-- Google Fonts removed for offline mode -->'
  )
  result = result.replace(
    /<link[^>]*href=["']https:\/\/cdn\.jsdelivr\.net\/gh\/dreampulse\/computer-modern[^"']*["'][^>]*\/?>/g,
    '<!-- Computer Modern fonts removed for offline mode -->'
  )

  // ── 4. Convert iframes from srcdoc to blob-URL based loading ─────────────
  // The srcdoc approach breaks when inlined libraries are very large (280KB+ D3,
  // 200KB+ Chart.js). Browser HTML parsers can struggle with huge srcdoc attributes
  // encoded as HTML entities. Instead, we store iframe HTML content in a JS object
  // and create blob URLs at runtime, which works reliably even with large content.

  const srcdocRegex = /(<iframe[^>]*?)srcdoc="([^"]*)"([^>]*>)/g
  let srcdocMatch
  const iframeEntries = [] // { id, html }
  let iframeCounter = 0
  const iframeReplacements = []

  while ((srcdocMatch = srcdocRegex.exec(result)) !== null) {
    const beforeSrcdoc = srcdocMatch[1]
    const raw = srcdocMatch[2]
    const afterSrcdoc = srcdocMatch[3]
    let inner = decodeSrcdoc(raw)

    const { html: processedInner } = await inlineSrcdocDeps(inner)

    const iframeId = `__offline_iframe_${iframeCounter++}`
    iframeEntries.push({ id: iframeId, html: processedInner })

    // Replace srcdoc with a placeholder data attribute + about:blank src
    iframeReplacements.push({
      original: srcdocMatch[0],
      replacement: `${beforeSrcdoc}data-offline-id="${iframeId}" src="about:blank"${afterSrcdoc}`,
    })
  }

  // Apply replacements in reverse order to preserve string positions
  for (const r of iframeReplacements.reverse()) {
    result = result.split(r.original).join(r.replacement)
  }

  // ── 5. Inject iframe initialization script ───────────────────────────────
  if (iframeEntries.length > 0) {
    // Build the iframe data as base64-encoded strings to avoid any escaping issues
    const iframeDataParts = iframeEntries.map((entry) => {
      // Convert HTML to base64 to completely avoid escaping issues
      try {
        const base64 = btoa(unescape(encodeURIComponent(entry.html)))
        return `    '${entry.id}': '${base64}'`
      } catch {
        // Fallback: use TextEncoder for content that btoa can't handle
        const bytes = new TextEncoder().encode(entry.html)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)
        return `    '${entry.id}': '${base64}'`
      }
    })

    const initScript =
      `
  <` +
      `script>
  // Offline iframe initialization with retry logic
  (function() {
    var _iframeB64 = {
${iframeDataParts.join(',\n')}
    };

    function _initAll() {
      var frames = document.querySelectorAll('iframe[data-offline-id]:not([data-loaded])');
      for (var i = 0; i < frames.length; i++) {
        var el = frames[i];
        var id = el.getAttribute('data-offline-id');
        if (!id || !_iframeB64[id]) continue;
        
        el.setAttribute('data-loaded', 'true');
        try {
          var html = decodeURIComponent(escape(atob(_iframeB64[id])));
        } catch(e) {
          console.error('Failed to decode iframe content for', id, e);
          continue;
        }
        var _isFileProto = window.location.protocol === 'file:';
        
        if (_isFileProto) {
          // file:// protocol: blob URLs won't work, use srcdoc directly
          el.removeAttribute('src');
          el.srcdoc = html;
        } else {
          // http(s): use blob URL for better performance with large content
          try {
            var blob = new Blob([html], {type: 'text/html;charset=utf-8'});
            el.src = URL.createObjectURL(blob);
          } catch(e) {
            el.removeAttribute('src');
            el.srcdoc = html;
          }
        }
      }
    }

    // Init on DOMContentLoaded (or immediately if already loaded)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _initAll);
    } else {
      _initAll();
    }
    // Retry after Reveal.js initializes (slides become visible)
    if (typeof Reveal !== 'undefined' && Reveal.on) {
      try { Reveal.on('ready', _initAll); } catch(e) {}
    } else {
      // Reveal may not exist yet, wait for it
      document.addEventListener('DOMContentLoaded', function() {
        if (typeof Reveal !== 'undefined' && Reveal.on) {
          try { Reveal.on('ready', _initAll); } catch(e) {}
        }
      });
    }
    // Final fallback retry
    setTimeout(_initAll, 2000);
    setTimeout(_initAll, 5000);
  })();
  <` +
      `/script>`

    // Insert before the Reveal.initialize script (look for Reveal.initialize)
    // This ensures our iframe data is available when Reveal fires its events.
    // IMPORTANT: Use lastIndexOf because after inlining vendor JS, 'Reveal.initialize('
    // appears inside the inlined reveal.js source code too. We need the LAST occurrence
    // which is the actual init call in the page's own script block.
    const revealInitIdx = result.lastIndexOf('Reveal.initialize(')
    if (revealInitIdx !== -1) {
      // Find the <script> tag that contains Reveal.initialize
      const scriptBeforeInit = result.lastIndexOf('<script>', revealInitIdx)
      if (scriptBeforeInit !== -1) {
        result =
          result.substring(0, scriptBeforeInit) +
          initScript +
          '\n' +
          result.substring(scriptBeforeInit)
      } else {
        // Fallback: insert before </body>
        const bodyCloseIdx = result.lastIndexOf('</body>')
        if (bodyCloseIdx !== -1) {
          result =
            result.substring(0, bodyCloseIdx) + initScript + '\n' + result.substring(bodyCloseIdx)
        }
      }
    } else {
      // Fallback: insert before </body>
      const bodyCloseIdx = result.lastIndexOf('</body>')
      if (bodyCloseIdx !== -1) {
        result =
          result.substring(0, bodyCloseIdx) + initScript + '\n' + result.substring(bodyCloseIdx)
      }
    }
  }

  // ── 6. Inline uploaded images as base64 data URIs ─────────────────────────
  // This makes the offline HTML truly self-contained — images won't depend on the server
  const imgSrcMatches = [
    ...new Set(
      (result.match(/(?:src|data-background-image)=["'](\/?uploads\/[^"']+)["']/g) || [])
        .map((m) => m.match(/["'](\/?uploads\/[^"']+)["']/)?.[1])
        .filter(Boolean)
    ),
  ]
  for (const imgPath of imgSrcMatches) {
    const dataUri = await fetchAsDataUri(imgPath.startsWith('/') ? imgPath : `/${imgPath}`)
    if (dataUri) {
      // Replace all occurrences of this image path with the data URI
      const escaped = imgPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(new RegExp(escaped, 'g'), dataUri)
    }
  }

  // ── 7. Remove base href to avoid cross-origin SecurityError on file:// protocol ──
  // The htmlGenerator might inject a <base href="..."> for live presentations,
  // but for offline HTML this causes Reveal.js history API to crash.
  result = result.replace(/<base[^>]*>/i, '')

  // Clear cache after export completes
  fetchCache.clear()

  return result
}
