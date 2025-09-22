import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/player'

export default function ProgressTicker() {
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlaying) { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; return }
    let stopped = false
    const loop = (now: number) => {
      if (stopped) return
      try { usePlayerStore.getState().tick(now) } catch {}
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { stopped = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [isPlaying])

  return null
}
