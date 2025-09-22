import React, { useEffect, useState } from 'react'
import { listDevices, transferPlayback } from '@/lib/spotifyClient'

export type DevicePickerProps = {
  token?: string // token resolved internally by client helpers, optional
  sdkDeviceId?: string
  onTransferToSdk?: () => Promise<void>
}

export default function DevicePicker({ sdkDeviceId, onTransferToSdk }: DevicePickerProps) {
  const [devices, setDevices] = useState<{ id: string; name?: string; is_active: boolean }[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'transferring' | 'connected' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    try {
      const d = await listDevices()
      setDevices(d as any)
    } catch {
      // ignore
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  const doTransfer = async () => {
    if (!sdkDeviceId) return
    setStatus('transferring'); setErr(null)
    try {
      if (onTransferToSdk) await onTransferToSdk()
      else await transferPlayback({ deviceId: sdkDeviceId, play: true })
      setStatus('connected')
      setTimeout(() => setStatus('idle'), 1500)
      refresh()
    } catch (e: any) {
      setStatus('error'); setErr('Transfer failed')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  const active = devices.find(d => d.is_active)

  return (
    <div className="flex items-center gap-2" data-testid="device-picker-root">
      <select
        className="h-9 rounded-md bg-white/5 border border-white/10 text-sm px-2"
        aria-label="Select device"
        value={active?.id || ''}
        onChange={() => {/* read-only selection; transfers via button */}}
      >
        <option value="" disabled>{loading ? 'Loading…' : (devices.length ? 'Select device' : 'No devices')}</option>
        {devices.map(d => (
          <option key={d.id} value={d.id}>{d.name || d.id}{d.is_active ? ' (active)' : ''}{d.id===sdkDeviceId ? ' • this app' : ''}</option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Make this app the active device"
        className="h-9 px-2 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-60"
        onClick={doTransfer}
        disabled={!sdkDeviceId || status==='transferring'}
        data-testid="transfer-button"
      >
        {status==='transferring' ? 'Transferring…' : 'Use this device'}
      </button>
      {err && <span className="text-[11px] text-red-400">{err}</span>}
    </div>
  )
}
