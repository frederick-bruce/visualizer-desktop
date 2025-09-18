import ThreeStage from '../ThreeStage'
import ClassicBars from './ClassicBars'
import WaveTunnel from './WaveTunnel'
import NebulaPulse from './NebulaPulse'
import SonarField from './SonarField'
import ChromaticStorm from './ChromaticStorm'
import Starstream from './Starstream'

export type PresetFactory = (stage: ThreeStage) => {
  id: string
  name: string
  params: Record<string, { name: string; min: number; max: number; default: number }>
  onFrame: (params: Record<string, number>) => void
  setParams?: (p: Record<string, number>) => void
}

export const BuiltinPresets: PresetFactory[] = [
  ClassicBars, WaveTunnel, NebulaPulse, SonarField, ChromaticStorm, Starstream
]
