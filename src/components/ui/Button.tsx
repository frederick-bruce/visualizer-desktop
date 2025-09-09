import React from 'react'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'ghost' }

export function Button({ className = '', variant = 'default', children, ...props }: Props) {
  // spacing: px-3 (12px) / py-2 (8px) aligns with 12/16/24 scale
  const base = 'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium focus:outline-none transition-smooth shadow-sm'
  const variants: Record<string, string> = {
    default: 'bg-white/10 text-white hover:bg-white/15',
    ghost: 'bg-white/10 hover:bg-white/15 text-white',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export default Button
