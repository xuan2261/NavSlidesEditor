/**
 * Real Chromium multi-contact input. Playwright's touchscreen API only emits
 * one contact, so pinch assertions must use CDP rather than mouse emulation.
 */
async function createCdpMultiTouchDriver(page) {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  })
  const dispatch = (type, points) =>
    session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(({ x, y, id = 0, radiusX = 8, radiusY = 8 }) => ({
        x,
        y,
        id,
        radiusX,
        radiusY,
        force: 1,
      })),
    })

  return {
    start: (points) => dispatch('touchStart', points),
    move: (points) => dispatch('touchMove', points),
    end: () => dispatch('touchEnd', []),
    cancel: () => dispatch('touchCancel', []),
    close: () => session.detach(),
  }
}

module.exports = { createCdpMultiTouchDriver }
