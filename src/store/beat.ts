import { create } from 'zustand'

export interface FusedBeatState {
  isBeat: boolean
  beatIntensity: number
  beatPhase: number
  barPhase: number
  bpm?: number
  confidence: number
  bass?: number
  mid?: number
  treb?: number
  source: 'analysis' | 'detector' | 'fused'
  lastBeatTime?: number
  latencyMs?: number // estimated detector vs analysis offset
  set: (p: Partial<FusedBeatState>) => void
}

export const useBeatStore = create<FusedBeatState>((set) => ({
  isBeat: false,
  beatIntensity: 0,
  beatPhase: 0,
  barPhase: 0,
  confidence: 0,
  source: 'detector',
  set: (p) => set(p)
}))
