import React from 'react'
import { cn } from '../../lib/utils'

export const Select = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <select
      className={cn(
        'w-full min-h-9 cursor-pointer rounded-md border border-border bg-card px-3 py-2 text-[14px] text-text-primary transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-out focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Select.displayName = 'Select'
