import React, { useEffect, useMemo, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { listDevices, transferPlayback } from '@/lib/spotifyClient'

export default function SettingsPanel() {
  const isAuthed = usePlayerStore(s => s.isAuthed)
  const login = usePlayerStore(s => s.login)
  const logout = usePlayerStore(s => s.logout)
  const devices = usePlayerStore(s => s.devices)
  const setDevices = usePlayerStore(s => s.setDevices!)
  const activeId = usePlayerStore(s => s.activeDeviceId)
  const inputSource = usePlayerStore(s => s.inputSource)
  const setInputSource = usePlayerStore(s => s.setInputSource)
  const polling = usePlayerStore(s => s.pollingStrategy)
  const setPolling = usePlayerStore(s => s.setPollingStrategy)
  const analyzer = usePlayerStore(s => s.analyzer)
  const setAnalyzer = usePlayerStore(s => s.setAnalyzer)
  const rotation = usePlayerStore(s => s.presetRotation)
  const setRotation = usePlayerStore(s => s.setPresetRotation)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true); setError(null)
    try { const r = await listDevices(); setDevices(r || []) } catch (e: any) { setError('Failed to fetch devices') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (isAuthed) refresh() }, [isAuthed])

  const makeActive = async (id: string) => {
    try { await transferPlayback({ deviceId: id, play: false }); await refresh() } catch { setError('Transfer failed') }
  }

  return (
    <div className="absolute right-2 top-2 w-96 max-w-[95vw] text-sm text-white">
      <div className="rounded-lg border border-white/10 bg-neutral-900/80 backdrop-blur p-3 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Settings</div>
          {!isAuthed ? (
            <button onClick={login} className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white">Login</button>
          ) : (
            <button onClick={logout} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10">Logout</button>
          )}
        </div>

        {/* Devices */}
        <div className="space-y-2">
          <div className="font-medium">Playback Device</div>
          <div className="flex gap-2 items-center">
            <button onClick={refresh} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10" disabled={loading}>{loading? 'Loading…':'Refresh'}</button>
            {error && <div className="text-amber-300 text-xs">{error}</div>}
          </div>
          <select className="w-full bg-white/10 border border-white/10 rounded px-2 py-1"
            value={activeId || ''}
            onChange={e => makeActive(e.target.value)}>
            <option value="">Select…</option>
            {devices?.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} {d.is_active? '(active)':''}</option>
            ))}
          </select>
          <button disabled={!activeId} onClick={() => activeId && makeActive(activeId)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10">Make active device</button>
        </div>

        {/* Polling strategy */}
        <div className="space-y-1">
          <div className="font-medium">Polling Strategy</div>
          <select className="w-full bg-white/10 border border-white/10 rounded px-2 py-1" value={polling} onChange={e => setPolling(e.target.value as any)}>
            <option value="events">Events only</option>
            <option value="events+polling">Events + light polling (5s)</option>
          </select>
        </div>

        {/* Analyzer */}
        <div className="space-y-2">
          <div className="font-medium">Analyzer</div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2">
              <span className="opacity-70">Input</span>
              <select value={inputSource} onChange={e => setInputSource(e.target.value as any)} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                <option value="Loopback">Loopback</option>
                <option value="File">File</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="opacity-70">FFT</span>
              <select value={analyzer.fftSize} onChange={e => setAnalyzer({ fftSize: Number(e.target.value) as any })} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="opacity-70 text-xs mb-1">Onset k</div>
              <input type="range" min={0.5} max={3} step={0.05} value={analyzer.onsetK} onChange={e => setAnalyzer({ onsetK: Number(e.target.value) })} className="w-full" />
              <div className="text-xs tabular-nums">{analyzer.onsetK.toFixed(2)}</div>
            </div>
            <div>
              <div className="opacity-70 text-xs mb-1">Refractory (ms)</div>
              <input type="range" min={20} max={400} step={5} value={analyzer.refractoryMs} onChange={e => setAnalyzer({ refractoryMs: Number(e.target.value) })} className="w-full" />
              <div className="text-xs tabular-nums">{analyzer.refractoryMs} ms</div>
            </div>
          </div>
        </div>

        {/* Preset rotation */}
        <div className="space-y-2">
          <div className="font-medium">Preset Rotation</div>
          <select className="w-full bg-white/10 border border-white/10 rounded px-2 py-1" value={rotation.mode} onChange={e => setRotation({ mode: e.target.value as any })}>
            <option value="manual">Manual</option>
            <option value="bars">Every N bars</option>
            <option value="idle">After N seconds idle</option>
          </select>
          {rotation.mode === 'bars' && (
            <label className="flex items-center gap-2">
              <span className="opacity-70">Bars</span>
              <input type="number" min={4} max={64} value={rotation.bars || 16} onChange={e => setRotation({ bars: Number(e.target.value) })} className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1" />
            </label>
          )}
          {rotation.mode === 'idle' && (
            <label className="flex items-center gap-2">
              <span className="opacity-70">Idle seconds</span>
              <input type="number" min={5} max={600} value={rotation.idleSeconds || 30} onChange={e => setRotation({ idleSeconds: Number(e.target.value) })} className="w-24 bg-white/10 border border-white/10 rounded px-2 py-1" />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
