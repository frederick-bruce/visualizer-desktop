import React, { useEffect, useState } from 'react'
import { useVisualizerStore } from '@/stores/visualizerStore'

export const PluginPicker: React.FC = () => {
  const plugins = useVisualizerStore(s => s.plugins)
  const current = useVisualizerStore(s => s.currentPluginId)
  const setPlugin = useVisualizerStore(s => s.setPlugin)
  const setPlugins = useVisualizerStore(s => s.setPlugins)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (plugins.length) return
    let cancelled = false
    setLoading(true)
    import('@/visualization/plugins/manifest.json')
      .then(mod => {
        if (cancelled) return
        const list = (mod.default || mod) as any[]
        setPlugins(list.map(p => ({ id: p.id, name: p.name, description: p.description })))
        // Auto-select first plugin if none selected
        if (!useVisualizerStore.getState().currentPluginId && list.length) setPlugin(list[0].id)
      })
      .catch(e => console.warn('manifest load failed', e))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [plugins.length, setPlugins, setPlugin])

  return (
    <div className="flex items-center gap-2 text-sm select-none">
      <label className="opacity-70">Plugin:</label>
      {loading && <span className="opacity-60">loading...</span>}
      <select className="bg-neutral-800 border border-neutral-600 px-2 py-1 rounded text-sm" value={current || ''} onChange={e => setPlugin(e.target.value || null)}>
        {plugins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  )
}

export default PluginPicker
