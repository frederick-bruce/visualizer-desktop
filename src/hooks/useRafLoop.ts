import { useEffect, useRef } from 'react'


export function useRafLoop(fn: (dt: number) => void) {
const rafRef = useRef<number | null>(null)
const lastRef = useRef<number | null>(null)


useEffect(() => {
const loop = (t: number) => {
const last = lastRef.current ?? t
const dt = (t - last) / 1000
lastRef.current = t
fn(dt)
rafRef.current = requestAnimationFrame(loop)
}
rafRef.current = requestAnimationFrame(loop)
return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
}, [fn])
}