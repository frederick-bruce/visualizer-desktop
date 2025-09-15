import { VizSettings, VisualizerPreset } from './types'

export const DEFAULT_SETTINGS: VizSettings = {
  sensitivity: 0.5,
  colorMode: 'spotify',
  particleCount: 5000,
  postFX: true
}

export const PRESETS: VisualizerPreset[] = [
  {
    id: 'classic-bars',
    name: 'Classic Bars',
    mode: 'canvas2d',
    variant: 'bars',
    settings: { sensitivity: 0.6, colorMode: 'spotify' }
  },
  {
    id: 'swarm',
    name: 'Swarm',
    mode: 'webgl',
    variant: 'particles',
    settings: { particleCount: 9000, sensitivity: 0.7, postFX: true, colorMode: 'neon' }
  },
  {
    id: 'nebula',
    name: 'Nebula',
    mode: 'webgl',
    variant: 'shaderPlane',
    settings: { sensitivity: 0.55, colorMode: 'pastel', particleCount: 4000 }
  }
]

export function findPreset(id: string): VisualizerPreset | undefined {
  return PRESETS.find(p => p.id === id)
}
