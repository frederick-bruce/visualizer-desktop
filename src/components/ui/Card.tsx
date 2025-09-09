import React from 'react'

export function Card(props: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  const { className = '', children, ...rest } = props
  return (
  <div {...rest} className={`rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export default Card
