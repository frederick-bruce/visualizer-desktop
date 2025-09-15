import Stage from '@/components/Stage'
import Sidebar from '@/components/Sidebar'

// Minimal shell: left sidebar (if present in layout) + Stage filling the space.
// Previous Home content (panels, settings, presets) removed for new 3D integration.
export default function Home() {
  return (
    <div className="w-full h-full flex items-stretch">
      <div className="flex-1 min-h-0">
        <Stage />
      </div>
    </div>
  )
}