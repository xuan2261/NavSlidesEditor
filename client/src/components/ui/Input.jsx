import React from 'react'
import { cn } from '../../lib/utils'

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'w-full bg-surface-3 border border-border text-text-primary px-3 py-2 rounded-md text-[14px] transition-colors duration-150 ease-out focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

Input.displayName = 'Input'
