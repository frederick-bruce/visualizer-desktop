import React from 'react'
import VisualizationCanvas from '@/components/VisualizationCanvas'
import PluginPicker from '@/components/PluginPicker'

export default function Dashboard() {
  return (
    <div className="grid grid-rows-[auto_1fr] h-screen w-full">
      <div className="flex items-center justify-between px-4 py-2 gap-4 bg-neutral-900/70 backdrop-blur-sm border-b border-neutral-800">
        <PluginPicker />
      </div>
      <div className="relative min-h-0">
        <VisualizationCanvas debug={false} />
      </div>
    </div>
  )
}
