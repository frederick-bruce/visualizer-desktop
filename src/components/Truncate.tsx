import React from 'react'

export default function Truncate({
  children,
  title,
  lines = 1,
  className = '',
}: {
  children?: React.ReactNode
  title?: string | null
  lines?: 1 | 2
  className?: string
}) {
  const lineClass = lines === 2 ? 'clamp-2' : 'truncate'
  return (
    <span className={`${lineClass} ${className}`} title={title ?? (typeof children === 'string' ? children : undefined)}>
      {children}
    </span>
  )
}
