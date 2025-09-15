import VisualizerStage from '@/components/VisualizerStage'
import { useSearchParams } from 'react-router-dom'

// Home route hosts tab content; visualizer should only render on the Visualizers tab.
export default function Home() {
  const [searchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as 'library' | 'visualizers' | 'settings') || 'library'

  return (
    <div className="w-full h-full flex items-stretch">
      <div className="flex-1 min-h-0">
        {tab === 'visualizers' && <VisualizerStage />}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'library' && <LibraryPanel />}
      </div>
    </div>
  )
}

function LibraryPanel() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white/60 text-sm select-none">
      <p className="mb-2 opacity-80">Library panel placeholder</p>
      <p className="text-xs opacity-50">Add playlist browsing or search results here.</p>
    </div>
  )
}

function SettingsPanel() {
  return (
    <div className="w-full h-full overflow-auto p-6 text-sm space-y-6">
      <section>
        <h2 className="text-xs font-semibold tracking-wide uppercase text-white/50 mb-3">Performance</h2>
        <ul className="space-y-2 text-white/70 list-disc list-inside">
          <li>Switch to the Visualizers tab to adjust visual display.</li>
          <li>Reduce Motion setting lives in the player menu (persisted).</li>
          <li>Variant switching (Particles / Shader Plane) coming soon to a dedicated panel.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xs font-semibold tracking-wide uppercase text-white/50 mb-3">Coming Soon</h2>
        <p className="text-white/60 leading-relaxed">A richer settings interface (themes, post-processing, analyzer tweaks) will appear here. For now this placeholder prevents the visualizer from appearing under the Settings tab.</p>
      </section>
    </div>
  )
}