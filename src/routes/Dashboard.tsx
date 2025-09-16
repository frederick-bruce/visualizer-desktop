<<<<<<< HEAD
// Legacy route removed. The new app shell is in `src/App.tsx`.
export default function Dashboard() {
  return (
    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-sm">
      This route has been deprecated. Navigate to the root path to use the new UI.
    </div>
  )
}
=======
import React, { useEffect, useRef, useState } from 'react'
import VisualizationCanvas from '@/components/VisualizationCanvas'
import PresetPanel from '@/components/PresetPanel'
import PluginPicker from '@/components/PluginPicker'
import Sidebar from '@/components/Sidebar'
import { useBeatStore } from '@/store/beat'
import { useVisualizerStore } from '@/stores/visualizerStore'
import { usePlayerStore } from '@/store/player'
import AudioAnalyzer from '@/analysis/AudioAnalyzer'
import LoopbackBridge from '@/lib/loopback'
import HUDPanel from '@/components/HUDPanel'
import { useVisualizerState } from '@/state/visualizerStore'

// Dashboard: dedicated full-screen visualization workspace
export default function Dashboard() {
  const current = useVisualizerStore(s => s.currentPluginId)
  const [showBeatDebug, setShowBeatDebug] = useState(false)
  const inputSource = usePlayerStore(s => s.inputSource)
  const setInputSource = usePlayerStore(s => s.setInputSource)
  const loopbackRef = useRef<LoopbackBridge | null>(null)
  const analyzerRef = useRef<AudioAnalyzer | null>(null)
  // Fused beat hook is initialized in a higher-level component to avoid duplicate store updates
  // Select primitives separately to keep getSnapshot stable (avoid infinite update depth warnings)
  const isBeat = useBeatStore(s => s.isBeat)
  const beatIntensity = useBeatStore(s => s.beatIntensity)
  useLoopbackAnalyzer(inputSource === 'Loopback')
  useSyncSpotifyToHud()
  // Scale pulse style (applied to inner viz wrapper)
  const scale = 1 + beatIntensity * 0.12
  return (
    <div className="h-screen w-screen overflow-hidden flex bg-neutral-950 text-white">
      {/* Sidebar (playlists, navigation) */}
      <div className="hidden lg:flex h-full"><Sidebar /></div>
      {/* Main visualization region */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 gap-4 bg-neutral-900/70 backdrop-blur-sm border-b border-neutral-800">
          <PluginPicker />
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <span className="opacity-70">Input:</span>
              <select value={inputSource} onChange={e => setInputSource(e.target.value as any)} className="bg-white/10 border border-white/10 rounded px-1 py-0.5">
                <option>Loopback</option>
                <option>File</option>
              </select>
            </label>
            <button onClick={() => setShowBeatDebug(v=>!v)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10">
              {showBeatDebug ? 'Hide Beat Debug' : 'Show Beat Debug'}
            </button>
            <div className="px-2 py-1 rounded bg-white/5 border border-white/10 select-none">
              Beat: <span className={isBeat ? 'text-emerald-400' : 'text-white/50'}>{isBeat ? '●' : '○'}</span>
            </div>
          </div>
        </div>
        <div className="relative flex-1 min-h-0" style={{ transition: 'transform 120ms cubic-bezier(.33,.7,.3,1)', transform: `scale(${scale})` }}>
          <VisualizationCanvas debug={false} />
          <HUDPanel />
          <PresetPanel />
          {!current && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm text-white/60">
              No plugin selected
            </div>
          )}
          {showBeatDebug && (
            <div className="absolute left-2 bottom-2 p-2 rounded bg-black/60 backdrop-blur text-[10px] font-mono max-w-[200px] overflow-hidden">
              <div className="opacity-70">Beat Intensity</div>
              <div>{beatIntensity.toFixed(3)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Wire up loopback -> analyzer lifecycle when input source is Loopback
function useLoopbackAnalyzer(active: boolean) {
  const started = useRef(false)
  const setFrame = useVisualizerState(s => s.setFrame)
  const setInactive = useVisualizerState(s => s.setInactive)
  const setEngineState = useVisualizerState(s => s.setEngineState)
  useEffect(() => {
    if (!active) return
    let canceled = false
    ;(async () => {
      const bridge = new LoopbackBridge()
      await bridge.ensureNode()
      const sharedCtx = bridge.getContext()!
      const analyzer = new AudioAnalyzer()
      await analyzer.ensureWorklet(sharedCtx)
      // connect pcm source to analyzer worklet
      const node = bridge.getAudioNode()!
      await analyzer.connectFromNode(node)
      const unsub = analyzer.subscribe(f => {
        // light debug for smoke test
        if (f) setFrame({ nowMs: f.nowMs ?? performance.now(), rms: f.rms, onset: f.onset, tempoBPM: f.tempoBPM, bands: f.bands })
      })
      await bridge.start()
      setEngineState('running')
      // inactivity watchdog
      let raf = 0
      const check = () => {
        const last = useVisualizerState.getState().lastFrameAt || 0
        const inactive = performance.now() - last > 500
        if (inactive !== useVisualizerState.getState().inactive) setInactive(inactive)
        raf = requestAnimationFrame(check)
      }
      raf = requestAnimationFrame(check)
      if (canceled) { await bridge.stop(); analyzer.dispose(); return }
      ;(window as any)._analyzer = analyzer
      ;(window as any)._loopback = bridge
    })()
    return () => { canceled = true; const lb = (window as any)._loopback as LoopbackBridge | undefined; lb?.stop(); const an = (window as any)._analyzer as AudioAnalyzer | undefined; an?.dispose(); useVisualizerState.getState().setEngineState('idle'); useVisualizerState.getState().setInactive(true) }
  }, [active])
}

function useSyncSpotifyToHud() {
  const name = usePlayerStore(s => s.track?.name)
  const artists = usePlayerStore(s => s.track?.artists)
  const albumArt = usePlayerStore(s => s.track?.albumArt)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const progressMs = usePlayerStore(s => s.progressMs)
  const durationMs = usePlayerStore(s => s.durationMs)
  const setSpotify = useVisualizerState(s => s.setSpotify)
  React.useEffect(() => {
    setSpotify({ track: { name, artists, albumArt }, isPlaying, positionMs: progressMs ?? undefined, durationMs: durationMs ?? undefined })
  }, [name, artists, albumArt, isPlaying, progressMs, durationMs, setSpotify])
}
>>>>>>> 26560ed (feat: Implement PresetPanel component for managing visual presets)
