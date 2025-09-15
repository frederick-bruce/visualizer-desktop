import React, { useEffect, useRef } from 'react'
import VisualizationManager from '@/visualization/VisualizationManager'
import { useVisualizerStore } from '@/stores/visualizerStore'
import { getAnalyser } from '@/audio/getAnalyser'
import { useBeatEngine } from '@/lib/useBeatEngine'
import { usePlayerStore } from '@/store/player'

// Optional debug overlay hook
function useFpsOverlay(enabled: boolean) {
  const ref = useRef<{ last: number; frames: number; fps: number }>({ last: performance.now(), frames: 0, fps: 0 })
  const [fps, setFps] = React.useState(0)
  useEffect(() => {
    if (!enabled) return
    let raf: number
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const now = performance.now()
      const r = ref.current
      r.frames++
      if (now - r.last >= 1000) {
        r.fps = r.frames * 1000 / (now - r.last)
        r.last = now
        r.frames = 0
        setFps(Math.round(r.fps))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
  return fps
}

interface Props { debug?: boolean }

export const VisualizationCanvas: React.FC<Props> = ({ debug }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const managerRef = useRef<VisualizationManager | null>(null)
  const currentPluginId = useVisualizerStore(s => s.currentPluginId)
  const setRunning = useVisualizerStore(s => s.start)
  const setStopped = useVisualizerStore(s => s.stop)
  const fps = useFpsOverlay(!!debug)
  const trackId = usePlayerStore(s => (s as any).track?.id)
  const beatFrame = useBeatEngine(trackId)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { analyser } = await getAnalyser()
      if (!mounted || !containerRef.current) return
      const mgr = new VisualizationManager()
      managerRef.current = mgr
      await mgr.initialize(containerRef.current, analyser)
      if (currentPluginId) await mgr.loadPlugin(currentPluginId)
      mgr.start(); setRunning()
    })()
    return () => { mounted = false; managerRef.current?.stop(); managerRef.current?.dispose(); setStopped() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to plugin change
  useEffect(() => {
    (async () => {
      if (!managerRef.current || !currentPluginId) return
      await managerRef.current.loadPlugin(currentPluginId)
    })()
  }, [currentPluginId])

  // Provide external energy fallback
  useEffect(() => {
    if (!managerRef.current) return
    managerRef.current.setEnergyProvider(() => beatFrame ? { low: beatFrame.band.low, mid: beatFrame.band.mid, high: beatFrame.band.high, isBeat: beatFrame.onBeat, bpm: beatFrame.bpm } : { low:0, mid:0, high:0, isBeat:false })
  }, [beatFrame])

  return (
    <div className="relative w-full h-full min-h-0" ref={containerRef}>
      {debug && (
        <div style={{ position: 'absolute', top: 4, left: 6, padding: '2px 6px', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 12, borderRadius: 4, pointerEvents: 'none' }}>
          {fps} fps
        </div>
      )}
    </div>
  )
}

export default VisualizationCanvas
