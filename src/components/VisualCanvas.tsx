import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import VisualizationManager from '@/visualization/VisualizationManager'
import { SpotifyDriver } from '@/visualization/spotifyDriver'

export default function VisualCanvas({ player }: { player: any | null }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mgrRef = useRef<VisualizationManager | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [manager, setManager] = useState<VisualizationManager | null>(null)
  // Map store visualizer id -> internal plugin id
  const visualizer = usePlayerStore(s => s.visualizer)
  const mapVizToPlugin = (v: string | undefined | null) => {
    switch (v) {
      case 'bars': return 'bars'
      case 'wave': return 'wave-tunnel'
      case 'particles': return 'particle-burst'
      default: return 'bars'
    }
  }

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    let cancelled = false
    const mgr = new VisualizationManager()
    mgrRef.current = mgr
    // Create a dummy audio context + analyser; even if not connected, manager can synthesize via setEnergyProvider
    const audio = new (window.AudioContext || (window as any).webkitAudioContext)()
    const analyser = audio.createAnalyser()
    analyser.fftSize = 2048
    mgr.initialize(el, analyser).then(() => {
      if (cancelled) return
      mgr.start()
      const firstPlugin = mapVizToPlugin(visualizer)
      if (!(window as any).__VIZ_NO_PLUGIN) {
        mgr.loadPlugin(firstPlugin).catch((e)=>{ console.warn('[viz] plugin load error', e) })
      } else console.info('[viz] plugin loading skipped via __VIZ_NO_PLUGIN')
      // Expose in state so React re-renders and mounts the SpotifyDriver
      setManager(mgr)
      ;(window as any).__VIZ = mgr
      console.info('[viz] VisualCanvas init host size', { w: el.clientWidth, h: el.clientHeight })
    })
    return () => {
      cancelled = true
      try { cleanupRef.current?.() } catch {}
      try { mgr.dispose() } catch {}
      try { audio.close() } catch {}
      mgrRef.current = null
      setManager(null)
    }
    // Intentionally run only once; plugin switching handled by separate effect below
  }, [])

  // Plugin switching effect
  useEffect(() => {
    const mgr = mgrRef.current
    if (!mgr) return
    if ((window as any).__VIZ_NO_PLUGIN) return
    const target = mapVizToPlugin(visualizer)
    if (mgr.activePluginId !== target) {
      mgr.loadPlugin(target).catch(e => console.warn('[viz] plugin swap error', e))
    }
  }, [visualizer])

  // No swapping for now; locked to bars

  return (
    <div ref={hostRef} className="w-full h-full flex-1 min-h-[240px] relative bg-gradient-to-b from-neutral-950 via-neutral-950 to-neutral-900 outline outline-neutral-800" data-testid="visual-canvas" data-visual-host>
      {manager && <SpotifyDriver player={player} manager={manager} />}
      <div className="pointer-events-none absolute bottom-2 left-2 text-[11px] font-mono text-neutral-400/70 bg-black/40 px-2 py-1 rounded">
        viz: {visualizer}
      </div>
    </div>
  )
}
