import React, { useEffect, useState } from 'react'
import { presets } from '@/visuals/presets'

function usePresetsList() {
  const [list, setList] = useState(() => presets.list())
  useEffect(() => {
    const unsub = presets.subscribe(() => {
      setList(presets.list())
    })
    return () => { unsub?.() }
  }, [])
  return list
}

export default function PresetPicker() {
  const list = usePresetsList()
  const [current, setCurrent] = useState<string | null>(() => {
    try { return localStorage.getItem('viz.currentPreset') } catch { return null }
  })

  // keep local state in sync with manager current id
  useEffect(() => {
    setCurrent(presets.getCurrentId() || null)
  }, [list])

  // restore last-used on mount
  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem('viz.currentPreset') } catch { return null } })()
    if (saved && presets.has(saved)) presets.switchTo(saved, 0)
  }, [])

  const onChange = (id: string) => {
    presets.switchTo(id, 600)
    try { localStorage.setItem('viz.currentPreset', id) } catch {}
    setCurrent(id)
  }

  return (
    <div className="flex items-center gap-2 text-sm select-none">
      <label className="opacity-70">Preset:</label>
      <select
        className="bg-neutral-800 border border-neutral-600 px-2 py-1 rounded text-sm"
        value={current || presets.getCurrentId() || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {list.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}
