import React, { useState } from 'react'
import VisualizationCanvas from '@/components/VisualizationCanvas'
import PluginPicker from '@/components/PluginPicker'
import Sidebar from '@/components/Sidebar'
import { useBeatStore } from '@/store/beat'
import { useVisualizerStore } from '@/stores/visualizerStore'

// Dashboard: dedicated full-screen visualization workspace
export default function Dashboard() {
  const current = useVisualizerStore(s => s.currentPluginId)
  const [showBeatDebug, setShowBeatDebug] = useState(false)
  // Fused beat hook is initialized in a higher-level component to avoid duplicate store updates
  // Select primitives separately to keep getSnapshot stable (avoid infinite update depth warnings)
  const isBeat = useBeatStore(s => s.isBeat)
  const beatIntensity = useBeatStore(s => s.beatIntensity)
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
