import { useEffect, useRef } from 'react'
import { useBeatEngine } from '@/lib/useBeatEngine'
import { usePlayerStore } from '@/store/player'
import { createVisualizerController, BeatFrame } from '@/visualizers/engine'

export default function VisualizerStage() {
  const trackId = usePlayerStore(s => s.track?.id)
  const beat = useBeatEngine(trackId)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<ReturnType<typeof createVisualizerController> | null>(null)

  // Lazy init controller on mount
  useEffect(() => {
    const controller = createVisualizerController()
    controllerRef.current = controller
    if (containerRef.current) controller.mount(containerRef.current)
    return () => { controller.unmount() }
  }, [])

  // Feed beat frames to controller (mapping to engine BeatFrame shape)
  useEffect(() => {
    if (!beat || !controllerRef.current) return
    const frame: BeatFrame = {
      time: beat.t,
      dt: 0, // controller supplies internal smoothed dt; external dt not used directly
      bpm: beat.bpm || 120,
      progressMs: beat.t * 1000,
      isBeat: beat.onBeat,
      energyLow: beat.band.low,
      energyMid: beat.band.mid,
      energyHigh: beat.band.high
    }
    controllerRef.current.update(frame)
  }, [beat])

  return <div id="viz-container" ref={containerRef} className="w-full h-full relative" />
}
