import React, { useEffect, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { transferPlayback, listDevices } from '@/lib/spotifyClient'
import { Check, Loader2, RefreshCcw, WifiOff, AlertTriangle } from 'lucide-react'

interface TransferState { deviceId: string; status: 'idle' | 'transferring' | 'done' | 'error'; errorKind?: string; httpStatus?: number }

export default function DevicePicker() {
  const { devices, sdkDeviceId, activeDeviceId, refreshDevices } = usePlayerStore() as any
  const [localDevices, setLocalDevices] = useState<any[]>(devices || [])
  const [loading, setLoading] = useState(false)
  const [transfer, setTransfer] = useState<TransferState | null>(null)
  const [diagOpen, setDiagOpen] = useState(false)
  const lastTransferStatus = usePlayerStore(s => s.lastTransferStatus)

  const fetchList = async () => {
    setLoading(true)
    try {
      await refreshDevices()
      const d = await listDevices()
      setLocalDevices(d)
    } finally { setLoading(false) }
  }

  useEffect(() => { setLocalDevices(devices) }, [devices])

  const onTransfer = async (id: string) => {
    setTransfer({ deviceId: id, status: 'transferring' })
    try {
      const r = await transferPlayback({ deviceId: id, play: false })
      setTransfer({ deviceId: id, status: 'done', httpStatus: r.status })
      await refreshDevices()
    } catch (e: any) {
      setTransfer({ deviceId: id, status: 'error', errorKind: e?.kind || 'Unknown', httpStatus: e?.status })
    }
  }

  const renderStatus = (d: any) => {
    if (activeDeviceId === d.id) return <span className="flex items-center gap-1 text-[10px] text-emerald-400"><Check size={12}/>Active</span>
    if (transfer && transfer.deviceId === d.id) {
      if (transfer.status === 'transferring') return <Loader2 size={14} className="animate-spin text-white/70" />
      if (transfer.status === 'done') return <span className="text-emerald-400 flex items-center gap-1 text-[10px]"><Check size={12}/>Transferred</span>
      if (transfer.status === 'error') return <span className="text-red-400 text-[10px] flex items-center gap-1"><AlertTriangle size={12}/>Error</span>
    }
    return null
  }

  const premiumHint = transfer?.status === 'error' && transfer.errorKind === 'PremiumRequired'
  const inactiveHint = transfer?.status === 'error' && transfer.errorKind === 'NoActiveDevice'

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white/80">Devices</span>
        <div className="flex items-center gap-2">
          <button onClick={fetchList} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px] flex items-center gap-1"><RefreshCcw size={12}/>Refresh</button>
          <button onClick={() => setDiagOpen(o=>!o)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px]">Diag</button>
        </div>
      </div>
      {loading && <div className="flex items-center gap-2 text-white/60 text-[11px]"><Loader2 size={14} className="animate-spin"/>Loading…</div>}
      {!loading && !localDevices?.length && (
        <div className="text-white/50 flex flex-col gap-2 items-start">
          <div className="flex items-center gap-1"><WifiOff size={14}/> No devices.</div>
          <button onClick={fetchList} className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px]">Retry</button>
        </div>
      )}
      <div className="flex flex-col gap-1 max-h-64 overflow-auto pr-1">
        {localDevices?.map(d => (
          <button key={d.id} onClick={() => onTransfer(d.id)} className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-left text-white/70 hover:bg-white/10 ${activeDeviceId===d.id ? 'bg-[var(--accent,#1DB954)]/20 text-[var(--accent,#1DB954)]' : ''}`}>
            <div className="flex flex-col">
              <span className="truncate max-w-[160px] text-[12px]">{d.name || 'Unnamed'}</span>
              <span className="text-[10px] opacity-50">{d.type}</span>
            </div>
            {renderStatus(d)}
          </button>
        ))}
      </div>
      {(premiumHint || inactiveHint) && (
        <div className="text-[11px] leading-relaxed rounded bg-white/5 p-2 border border-white/10 text-amber-200">
          {premiumHint && 'Spotify Premium is required for in-app playback.'}
          {inactiveHint && 'Tap play in Spotify once, then click "Transfer" again.'}
        </div>
      )}
      {diagOpen && (
        <div className="mt-2 p-2 rounded bg-black/40 border border-white/10 font-mono text-[10px] space-y-1">
          <div>sdkDeviceId: {sdkDeviceId || '-'}</div>
          <div>activeDeviceId: {activeDeviceId || '-'}</div>
          <div>devices: {localDevices.map(d=>`${d.id===activeDeviceId?'*':''}${d.name}:${d.is_active?'A':'-'}`).join(', ')}</div>
          <div>lastTransferStatus: {lastTransferStatus ?? '-'}</div>
        </div>
      )}
    </div>
  )
}
