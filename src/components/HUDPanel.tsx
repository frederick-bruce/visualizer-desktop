import React, { useMemo } from 'react'
import { useVisualizerState } from '@/state/visualizerStore'

export default function HUDPanel() {
  const frame = useVisualizerState(s => s.analysisFrame)
  const inactive = useVisualizerState(s => s.inactive)
  const fps = useVisualizerState(s => s.fps)
  const cpu = useVisualizerState(s => s.cpuLoad)
  const sp = useVisualizerState(s => s.spotify)
  const bpm = frame?.tempoBPM ?? null
  const onset = !!frame?.onset
  const rms = frame?.rms ?? 0
  const bands = frame?.bands || []
  const timeStr = useMemo(() => {
    const pos = sp.positionMs ?? 0
    const dur = sp.durationMs ?? 0
    const fmt = (ms: number) => {
      const s = Math.floor(ms/1000)
      const m = Math.floor(s/60), ss = s%60
      return `${m}:${ss.toString().padStart(2,'0')}`
    }
    if (!dur) return fmt(pos)
    return `${fmt(pos)} / ${fmt(dur)}`
  }, [sp.positionMs, sp.durationMs])

  return (
    <div className="absolute left-2 top-2 w-[320px] max-w-[90vw] text-white/90 text-xs font-mono select-none">
      <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">HUD</div>
          <div className="opacity-70">{fps.toFixed(0)} fps · {(cpu*100).toFixed(0)}% CPU</div>
        </div>
        <div className="grid grid-cols-2 gap-2 items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${onset ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
            <div>onset</div>
          </div>
          <div>BPM: <span className="tabular-nums">{bpm ? bpm.toFixed(1) : '--'}</span></div>
          <div className="col-span-2">RMS: <span className="tabular-nums">{rms.toFixed(3)}</span></div>
          <div className="col-span-2">
            <div className="flex gap-1 h-3 items-end">
              {bands.slice(0, 32).map((b, i) => (
                <div key={i} className="w-1 bg-white/40" style={{ height: `${Math.min(1, Math.max(0, b)) * 12}px` }} />
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div className="truncate opacity-80">{sp.track?.name || '—'}</div>
            <div className="truncate opacity-60">{sp.track?.artists || ''}</div>
            <div className="opacity-70">{timeStr} {sp.isPlaying ? '▶' : '❚❚'}</div>
          </div>
        </div>
        {inactive && (
          <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200">
            No audio input detected.
          </div>
        )}
      </div>
    </div>
  )
}
