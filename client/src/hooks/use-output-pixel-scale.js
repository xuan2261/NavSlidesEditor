import { useEffect, useState } from 'react'

export function useOutputPixelScale(scale) {
  const [pixelRatio, setPixelRatio] = useState(() => window.devicePixelRatio)
  useEffect(() => {
    let media
    const update = () => {
      media?.removeEventListener('change', update)
      const ratio = window.devicePixelRatio
      setPixelRatio(ratio)
      media = window.matchMedia?.(`(resolution: ${ratio}dppx)`)
      media?.addEventListener('change', update)
    }
    update()
    window.addEventListener('resize', update)
    return () => {
      media?.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return scale * pixelRatio
}
