import React from 'react'
import { cn } from '../../lib/utils'

export function buttonVariants({ variant = 'primary', className = '' }) {
  const baseClasses =
    'inline-flex items-center justify-center gap-[6px] px-[14px] py-[7px] rounded-md text-[13px] font-medium transition-colors duration-150 ease-out cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none'

  const variants = {
    primary:
      'border border-transparent bg-accent text-white shadow-[0_1px_3px_rgba(99,102,241,0.3)] hover:bg-accent-hover hover:shadow-[0_2px_8px_rgba(99,102,241,0.4)]',
    secondary:
      'bg-card text-text-primary border border-border hover:bg-hover hover:border-border-strong',
    danger: 'border border-transparent bg-danger text-white hover:bg-danger-hover',
    ghost:
      'border border-transparent text-text-secondary px-2 py-1 rounded hover:bg-hover hover:text-text-primary',
    icon: 'w-8 h-8 !p-0 shrink-0 inline-flex items-center justify-center rounded-md border border-transparent text-text-secondary transition-colors duration-150 ease-out hover:bg-hover hover:text-text-primary',
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
