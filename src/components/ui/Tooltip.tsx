import React, { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  label: string
  children: React.ReactElement<any>
  side?: 'top' | 'bottom'
  delayMs?: number
  className?: string
}

export function Tooltip({ label, children, side='top', delayMs=400, className='' }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [delayHandle, setDelayHandle] = useState<number | null>(null)
  const ref = useRef<HTMLElement | null>(null)
  const id = useRef('tt-' + Math.random().toString(36).slice(2,8))

  useEffect(() => () => { if (delayHandle) window.clearTimeout(delayHandle) }, [delayHandle])

  const show = () => {
    if (delayHandle) window.clearTimeout(delayHandle)
    const h = window.setTimeout(() => setOpen(true), delayMs)
    setDelayHandle(h)
  }
  const hide = () => { if (delayHandle) window.clearTimeout(delayHandle); setOpen(false) }

  const child = React.cloneElement(children, {
    ref: (node: HTMLElement) => {
      ref.current = node
      const existing: any = (children as any).ref
      if (typeof existing === 'function') existing(node)
    },
    onMouseEnter: (e: any) => { try { (children.props as any).onMouseEnter?.(e) } finally { show() } },
    onMouseLeave: (e: any) => { try { (children.props as any).onMouseLeave?.(e) } finally { hide() } },
    onFocus: (e: any) => { try { (children.props as any).onFocus?.(e) } finally { show() } },
    onBlur: (e: any) => { try { (children.props as any).onBlur?.(e) } finally { hide() } },
    'aria-describedby': open ? id.current : undefined
  })

  return (
    <span className="relative inline-flex">
      {child}
      {open && (
        <span
          role="tooltip"
          id={id.current}
          className={"pointer-events-none select-none absolute z-50 px-2 py-1 rounded-md border border-white/10 bg-black/80 backdrop-blur text-[11px] font-medium text-white/90 shadow-lg whitespace-nowrap translate-y-[-4px] " + className}
          style={{
            top: side==='top' ? '-6px' : '100%',
            left: '50%',
            transform: 'translate(-50%, ' + (side==='top' ? '-100%)' : '6px')
          }}
        >{label}</span>
      )}
    </span>
  )
}

export default Tooltip
