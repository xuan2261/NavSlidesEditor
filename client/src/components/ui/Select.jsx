import React from 'react'
import { cn } from '../../lib/utils'

export const Select = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <select
      className={cn(
        'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] cursor-pointer focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Select.displayName = 'Select'
