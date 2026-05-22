import React from 'react'
import { cn } from '../../lib/utils'

const RibbonTabContentRow = React.forwardRef(function RibbonTabContentRow(
  { children, className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-ribbon-content-row
      className={cn(
        'flex h-full w-full min-w-0 flex-[1_1_100%] items-stretch gap-0 overflow-x-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

export default RibbonTabContentRow
