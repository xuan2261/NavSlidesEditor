// Rasterize the actual print-rendered SVG, not a second curve renderer. The
// expanded viewBox avoids element/ancestor clipping and retains transparent ink.
async function captureCurvedLine(element, geometry, scale) {
  return element.evaluate(
    async (node, { geometry, scale }) => {
      const source = node.querySelector('svg')
      if (!source) throw new Error('Curved line has no rendered SVG')
      const svg = source.cloneNode(true)
      const originals = [source, ...source.querySelectorAll('*')]
      const copies = [svg, ...svg.querySelectorAll('*')]
      originals.forEach((original, index) => {
        const style = getComputedStyle(original)
        copies[index].style.fill = style.fill
        copies[index].style.stroke = style.stroke
        copies[index].style.fillOpacity = style.fillOpacity
        copies[index].style.strokeOpacity = style.strokeOpacity
      })
      svg.style.position = 'static'
      svg.style.left = 'auto'
      svg.style.top = 'auto'
      svg.setAttribute('width', geometry.width)
      svg.setAttribute('height', geometry.height)
      svg.setAttribute(
        'viewBox',
        `${geometry.left} ${geometry.top} ${geometry.width} ${geometry.height}`
      )
      const image = new Image()
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(geometry.width * scale)
      canvas.height = Math.ceil(geometry.height * scale)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Curved line PNG canvas is unavailable')
      context.globalAlpha = Number(getComputedStyle(node).opacity)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const png = canvas.toDataURL('image/png')
      if (!png.startsWith('data:image/png;base64,'))
        throw new Error('Curved line canvas produced no PNG')
      return png
    },
    {
      geometry: {
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: geometry.height,
      },
      scale,
    }
  )
}

module.exports = { captureCurvedLine }
