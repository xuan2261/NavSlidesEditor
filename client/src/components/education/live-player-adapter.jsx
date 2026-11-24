import { useEffect, useRef } from 'react'
import { mountLivePlayer } from 'revealjs-shared'
export function LivePlayerAdapter({ connection }) {
  const root = useRef(null)
  useEffect(() => {
    if (!connection || !root.current) return
    const mounted = mountLivePlayer(root.current, { transport: connection })
    return () => mounted.destroy()
  }, [connection])
  return <div ref={root} className="w-full mx-auto" />
}
