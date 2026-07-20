import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'

const RibbonDensityContext = createContext('wide')

const densityForWidth = (width) => {
  if (width < 900) return 'compact'
  if (width < 1180) return 'condensed'
  return 'wide'
}

export function RibbonDensityProvider({ children, ...props }) {
  const containerRef = useRef(null)
  const [density, setDensity] = useState('wide')

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const update = (width) => setDensity(densityForWidth(width))
    update(container.getBoundingClientRect().width)

    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width))
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return (
    <RibbonDensityContext.Provider value={density}>
      <div ref={containerRef} data-ribbon-density={density} {...props}>
        {children}
      </div>
    </RibbonDensityContext.Provider>
  )
}

export const useRibbonDensity = () => useContext(RibbonDensityContext)
