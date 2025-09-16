import { useEffect } from 'react'
import type VisualizationManager from '@/visualization/VisualizationManager'
import { useSpotifySync, type VisualTick } from '@/hooks/useSpotifySync'

// React bridge that feeds VisualizationManager from Spotify analysis without raw FFT/waveform
export function SpotifyDriver({ player, manager }: { player: any; manager: VisualizationManager }) {
  const sync = useSpotifySync(player)
  useEffect(() => {
    if (!manager) return
    const unsub = sync.onVisualTick((tick: VisualTick) => {
      manager.setEnergyProvider(() => ({
        low: tick.bands?.low ?? 0,
        mid: tick.bands?.mid ?? 0,
        high: tick.bands?.high ?? 0,
        isBeat: !!tick.onBeat,
        bpm: tick.bpm,
        beatPhase: tick.beatProgress,
        intensity: tick.amplitude,
        chorus: undefined
      }))
    })
    return () => { try { unsub() } catch {} }
  }, [manager, sync])
  return null
}
