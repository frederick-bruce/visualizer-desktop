import React, { useEffect, useMemo, useState } from 'react'
import { presets } from '@/visuals/presets'

type Item = ReturnType<typeof presets.list>[number]

export default function PresetPanel() {
  const [items, setItems] = useState<Item[]>(() => presets.list())
  const [currentId, setCurrentId] = useState<string | null>(presets.getCurrentId() || null)
  const current = useMemo(() => items.find(i => i.id === currentId) || items[0], [items, currentId])
  const [values, setValues] = useState<Record<string, number>>(() => presets.getValues(currentId || undefined))
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const unsub = presets.subscribe(() => {
      setItems(presets.list())
      setCurrentId(presets.getCurrentId() || null)
      setValues(presets.getValues())
    })
    // initial sync
    setItems(presets.list())
    setCurrentId(presets.getCurrentId() || null)
    setValues(presets.getValues())
    return () => { unsub() }
  }, [])

  const onChangePreset = (id: string) => {
    presets.switchTo(id, 700)
    setCurrentId(id)
    setValues(presets.getValues(id))
  }

  const onChangeValue = (key: string, v: number) => {
    presets.setValue(key, v)
    setValues(prev => ({ ...prev, [key]: v }))
  }

  return (
    <div className="absolute right-2 top-2 bottom-2 w-72 max-w-[80vw] select-none">
      <div className="h-full flex flex-col rounded-lg border border-white/10 bg-neutral-900/70 backdrop-blur shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="font-semibold text-sm">Preset Controls</div>
          <button onClick={() => setOpen(o=>!o)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15">{open ? 'Hide' : 'Show'}</button>
        </div>
        {open && (
          <div className="p-3 space-y-3 overflow-auto">
            <div className="text-xs">
              <div className="opacity-70 mb-1">Active Preset</div>
              <select className="w-full bg-white/10 border border-white/10 rounded px-2 py-1" value={current?.id || ''} onChange={e => onChangePreset(e.target.value)}>
                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => presets.randomizeParams()} className="flex-1 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10">Randomize</button>
              <button onClick={() => setValues(presets.getValues())} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15 border border-white/10">Reset</button>
            </div>
            {/* Params */}
            <div className="space-y-4">
              {current && Object.entries(current.params || {}).map(([key, p]) => (
                <div key={key} className="text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="opacity-80">{p.name}</span>
                    <span className="tabular-nums opacity-70">{(values[key] ?? p.default).toFixed(2)}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={(p.max - p.min) / 100}
                    value={values[key] ?? p.default}
                    onChange={e => onChangeValue(key, Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
