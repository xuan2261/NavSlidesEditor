import React from 'react'
import { cn } from '../../lib/utils'

export function buttonVariants({ variant = 'primary', className = '' }) {
  const baseClasses =
    'inline-flex items-center justify-center gap-[6px] rounded-md px-[14px] py-[7px] text-[13px] font-medium transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 ease-out cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-secondary disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary:
      'min-h-8 border border-transparent bg-brand text-white shadow-[0_1px_2px_rgba(36,25,21,0.18),0_6px_18px_rgba(201,100,66,0.22)] hover:bg-brand-hover hover:shadow-[0_1px_2px_rgba(36,25,21,0.2),0_8px_22px_rgba(201,100,66,0.28)]',
    secondary:
      'min-h-8 bg-card text-text-primary border border-border shadow-[0_1px_1px_rgba(36,25,21,0.05)] hover:bg-hover hover:border-border-strong',
    danger: 'min-h-8 border border-transparent bg-danger text-white hover:bg-danger-hover',
    ghost:
      'min-h-0 border border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary active:bg-active active:text-text-primary',
    icon: 'w-8 h-8 min-h-8 !p-0 shrink-0 inline-flex items-center justify-center rounded-md border border-transparent text-text-secondary hover:bg-hover hover:text-text-primary',
  }

  return cn(baseClasses, variants[variant], className)
}

export const Button = React.forwardRef(
  ({ className, variant = 'primary', type = 'button', title, 'aria-label': ariaLabel, ...props }, ref) => {
    const computedAriaLabel = ariaLabel || (variant === 'icon' ? title : undefined)

    return (
      <button
        type={type}
        className={buttonVariants({ variant, className })}
        ref={ref}
        title={title}
        aria-label={computedAriaLabel}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
