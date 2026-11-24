// Shared by canvas and generated HTML; self-contained for trusted runtime serialization.
function attachNativeTabLayout(root) {
  const doc = root.ownerDocument || root
  const win = doc.defaultView
  let disposed = false,
    frame = null
  function update() {
    frame = null
    if (disposed) return
    mutation.disconnect()
    for (const paragraph of root.querySelectorAll('p[style],li[style]')) {
      const raw = paragraph.style.getPropertyValue('--pptx-tab-stops').trim()
      const entries = raw.split(',')
      if (
        entries.length > 256 ||
        !/^(?:\d+(?:\.\d+)?|\.\d+):(l|r|ctr|dec)(?:,(?:\d+(?:\.\d+)?|\.\d+):(l|r|ctr|dec))*$/.test(
          raw
        )
      )
        continue
      const stops = entries
        .map((entry) => {
          const [position, align] = entry.split(':')
          return { position: Number(position), align }
        })
        .sort((a, b) => a.position - b.position)
      if (stops.some((stop) => !Number.isFinite(stop.position) || stop.position > 100000)) continue
      const markers = [...paragraph.querySelectorAll('span[style]')].filter(
        (span) =>
          span.style.getPropertyValue('--pptx-tab').trim() === '1' && span.textContent === '\t'
      )
      if (!markers.length || !paragraph.offsetWidth) continue
      // A detached, untransformed layout copy preserves fractional CSS coordinates
      // under canvas zoom, rotation and Reveal transforms. Never infer zoom from an AABB.
      const style = win.getComputedStyle(paragraph)
      const host = doc.createElement('div')
      host.style.cssText =
        'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;width:max-content;'
      const copy = paragraph.cloneNode(true)
      const fontProperties = [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fontStyle',
        'fontStretch',
        'fontVariant',
        'letterSpacing',
        'wordSpacing',
        'lineHeight',
      ]
      for (const key of [
        ...fontProperties,
        'width',
        'boxSizing',
        'whiteSpace',
        'tabSize',
        'textAlign',
        'textIndent',
        'direction',
        'paddingLeft',
        'paddingRight',
        'marginLeft',
        'marginRight',
      ])
        copy.style[key] = style[key]
      copy.style.transform = 'none'
      copy.style.position = 'static'
      const originalChildren = [...paragraph.querySelectorAll('*')]
      const copyChildren = [...copy.querySelectorAll('*')]
      originalChildren.forEach((child, index) => {
        const childStyle = win.getComputedStyle(child)
        for (const key of fontProperties) copyChildren[index].style[key] = childStyle[key]
      })
      const copies = copyChildren.filter(
        (span) =>
          span.style.getPropertyValue('--pptx-tab').trim() === '1' && span.textContent === '\t'
      )
      for (const marker of copies)
        Object.assign(marker.style, {
          display: 'inline-block',
          overflow: 'hidden',
          verticalAlign: 'baseline',
          width: '0px',
          height: '0px',
          transition: 'none',
        })
      host.append(copy)
      doc.body.append(host)
      try {
        const origin =
          copy.getBoundingClientRect().left -
          (parseFloat(style.marginLeft) || 0) +
          (parseFloat(style.paddingLeft) || 0)
        const defaultSize = parseFloat(style.tabSize) || 96
        for (let i = 0; i < copies.length; i++) {
          const marker = copies[i]
          const current = marker.getBoundingClientRect().left - origin
          const stop = stops.find((stop) => stop.position > current + 0.01) || {
            position: (Math.floor(current / defaultSize) + 1) * defaultSize,
            align: 'l',
          }
          let followingWidth = 0
          if (stop.align !== 'l') {
            const range = doc.createRange()
            range.setStartAfter(marker)
            if (copies[i + 1]) range.setEndBefore(copies[i + 1])
            else range.setEnd(copy, copy.childNodes.length)
            const measure = doc.createElement('span')
            for (const key of fontProperties) measure.style[key] = style[key]
            measure.style.cssText +=
              ';position:fixed;visibility:hidden;white-space:pre;width:max-content;left:0;top:0;'
            measure.append(range.cloneContents())
            const walker = doc.createTreeWalker(
              measure,
              win.NodeFilter.SHOW_ELEMENT | win.NodeFilter.SHOW_TEXT
            )
            let node,
              cut = null,
              offset = 0
            while ((node = walker.nextNode())) {
              if (node.nodeName === 'BR') {
                cut = node
                break
              }
              if (node.nodeType === 3) {
                const index = node.textContent.search(stop.align === 'dec' ? /[.\n]/ : /\n/)
                if (index >= 0) {
                  cut = node
                  offset = index
                  break
                }
              }
            }
            if (cut) {
              const tail = doc.createRange()
              if (cut.nodeType === 3) tail.setStart(cut, offset)
              else tail.setStartBefore(cut)
              tail.setEnd(measure, measure.childNodes.length)
              tail.deleteContents()
            }
            host.append(measure)
            followingWidth = measure.getBoundingClientRect().width
            measure.remove()
            if (stop.align === 'ctr') followingWidth /= 2
          }
          const width = `${Math.max(0, stop.position - current - followingWidth)}px`
          marker.style.width = width
          const original = markers[i]
          for (const [key, value] of Object.entries({
            display: 'inline-block',
            overflow: 'hidden',
            verticalAlign: 'baseline',
            width,
            height: '0px',
            transition: 'none',
          })) {
            if (original.style[key] !== value) original.style[key] = value
          }
        }
      } finally {
        host.remove()
      }
    }
    mutation.observe(root, { childList: true, characterData: true, subtree: true })
  }
  function schedule() {
    if (!disposed && frame === null) frame = win.requestAnimationFrame(update)
  }
  const mutation = new win.MutationObserver(schedule)
  const resize = win.ResizeObserver ? new win.ResizeObserver(schedule) : null
  resize?.observe(root.nodeType === 9 ? doc.documentElement : root)
  win.addEventListener('resize', schedule)
  doc.fonts?.addEventListener('loadingdone', schedule)
  doc.fonts?.ready.then(schedule)
  update()
  return () => {
    disposed = true
    mutation.disconnect()
    resize?.disconnect()
    win.removeEventListener('resize', schedule)
    doc.fonts?.removeEventListener('loadingdone', schedule)
    if (frame !== null) win.cancelAnimationFrame(frame)
  }
}
module.exports = { attachNativeTabLayout }
