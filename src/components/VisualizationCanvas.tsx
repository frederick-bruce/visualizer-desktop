import React, { useEffect, useRef } from 'react'
import VisualizationManager from '@/visualization/VisualizationManager'
import { useSpotifySync } from '@/hooks/useSpotifySync'
import { bindSpotifyDriver } from '@/visualization/spotifyDriver'
import { useVisualizerStore } from '@/stores/visualizerStore'
import { getAnalyser } from '@/audio/getAnalyser'
import useFusedBeat from '@/hooks/useFusedBeat'
import { useBeatStore } from '@/store/beat'
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
  // Initialize fused beat pipeline (combines analysis + real-time detector)
  useFusedBeat(trackId)
  // Individually select primitives to avoid creating a new object each render (prevents store snapshot churn)
  const isBeat = useBeatStore(s => s.isBeat)
  const beatIntensity = useBeatStore(s => s.beatIntensity)
  const beatPhase = useBeatStore(s => s.beatPhase)
  const barPhase = useBeatStore(s => s.barPhase)
  const bass = useBeatStore(s => s.bass)
  const mid = useBeatStore(s => s.mid)
  const treb = useBeatStore(s => s.treb)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { analyser } = await getAnalyser()
      if (!mounted || !containerRef.current) return
      const mgr = new VisualizationManager()
      managerRef.current = mgr
      await mgr.initialize(containerRef.current, analyser)
      // Bind Spotify analysis driver (no raw audio path)
      const player = (window as any)._player
      const sync = useSpotifySync(player)
      const unbind = bindSpotifyDriver({ manager: mgr, onVisualTick: sync.onVisualTick })
      ;(managerRef.current as any)._unbindSpotify = unbind
      if (currentPluginId) await mgr.loadPlugin(currentPluginId)
      mgr.start(); setRunning()
    })()
  return () => { mounted = false; try { (managerRef.current as any)?._unbindSpotify?.() } catch {}; managerRef.current?.stop(); managerRef.current?.dispose(); setStopped() }
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
    managerRef.current.setEnergyProvider(() => ({
      low: bass ?? 0,
      mid: mid ?? 0,
      high: treb ?? 0,
      isBeat,
      bpm: undefined,
      beatPhase,
      barPhase,
      intensity: Math.min(1, (beatIntensity ?? 0) * 1.0)
    }))
  }, [bass, mid, treb, isBeat, beatPhase, barPhase, beatIntensity])

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
