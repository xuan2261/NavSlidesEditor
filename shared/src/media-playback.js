// Self-contained so generated presentations can serialize the same playback behavior.
function attachMediaPlayback(
  media,
  { startTime = 0, endTime = 0, loop = false, playbackRate = 1 } = {}
) {
  const requestedStart = Number(startTime)
  const requestedEnd = Number(endTime)
  const requestedRate = Number(playbackRate)
  const trimmed =
    (Number.isFinite(requestedStart) && requestedStart > 0) ||
    (Number.isFinite(requestedEnd) && requestedEnd > 0)
  let start = 0
  let end = Infinity
  let disposed = false
  const view = media.ownerDocument.defaultView
  let frame = null

  function stopClock() {
    if (frame !== null) view.cancelAnimationFrame(frame)
    frame = null
  }
  function tick() {
    frame = null
    boundary()
    if (!disposed && !media.paused && trimmed && Number.isFinite(end))
      frame = view.requestAnimationFrame(tick)
  }
  function startClock() {
    if (frame === null && !media.paused && trimmed && Number.isFinite(end))
      frame = view.requestAnimationFrame(tick)
  }

  function resume() {
    const playback = media.play()
    if (playback?.catch)
      playback.catch((error) => {
        if (disposed) return
        media.pause()
        console.error('Media segment playback failed', error)
      })
  }
  function metadata() {
    const duration =
      Number.isFinite(media.duration) && media.duration > 0 ? media.duration : Infinity
    start =
      Number.isFinite(requestedStart) && requestedStart > 0 && requestedStart < duration
        ? requestedStart
        : 0
    end =
      Number.isFinite(requestedEnd) && requestedEnd > start
        ? Math.min(requestedEnd, duration)
        : duration
    media.playbackRate = Number.isFinite(requestedRate) && requestedRate > 0 ? requestedRate : 1
    // Native looping wraps the entire resource, not the authored segment.
    media.loop =
      Boolean(loop) && start === 0 && !(Number.isFinite(requestedEnd) && requestedEnd > 0)
    if (media.currentTime < start || media.currentTime >= end) media.currentTime = start
    startClock()
  }
  function play() {
    if (media.currentTime < start || media.currentTime >= end) media.currentTime = start
    startClock()
  }
  function boundary() {
    if (media.currentTime < end) return
    if (loop && (!media.paused || media.ended)) {
      const paused = media.paused
      media.currentTime = start
      if (paused) resume()
    } else if (!loop) {
      media.pause()
      if (media.currentTime !== end) media.currentTime = end
    }
  }
  function ended() {
    if (!loop) return
    media.currentTime = start
    resume()
  }
  media.addEventListener('loadedmetadata', metadata)
  media.addEventListener('play', play)
  media.addEventListener('pause', stopClock)
  media.addEventListener('timeupdate', boundary)
  media.addEventListener('ended', ended)
  metadata()
  return () => {
    disposed = true
    stopClock()
    media.removeEventListener('loadedmetadata', metadata)
    media.removeEventListener('play', play)
    media.removeEventListener('pause', stopClock)
    media.removeEventListener('timeupdate', boundary)
    media.removeEventListener('ended', ended)
  }
}

module.exports = { attachMediaPlayback }
