import { create } from 'zustand'

export type EngineState = 'idle' | 'starting' | 'running' | 'stopping' | 'error'

export type AnalysisFrame = {
  nowMs: number
  rms: number
  onset?: boolean
  tempoBPM?: number | null
  bands?: number[]
  beatPhase?: number | null
  bass?: number
  mid?: number
  treble?: number
}

export type SpotifySlice = {
  track?: { id?: string; name?: string; artists?: string; albumArt?: string }
  isPlaying: boolean
  positionMs?: number
  durationMs?: number
}

type VisualizerState = {
  engineState: EngineState
  analysisFrame?: AnalysisFrame
  lastFrameAt?: number
  inactive: boolean
  currentPresetId: string | null
  params: Record<string, number>
  fps: number
  cpuLoad: number
  spotify: SpotifySlice
  beatGateEnabled: boolean
  // actions
  setEngineState: (s: EngineState) => void
  setFrame: (f: AnalysisFrame) => void
  setInactive: (b: boolean) => void
  setPreset: (id: string | null) => void
  setParam: (k: string, v: number) => void
  setParams: (p: Record<string, number>) => void
  setPerf: (fps: number, cpuLoad: number) => void
  setSpotify: (s: Partial<SpotifySlice>) => void
  toggleBeatGate: () => void
}

export const useVisualizerState = create<VisualizerState>((set, get) => ({
  engineState: 'idle',
  analysisFrame: undefined,
  lastFrameAt: undefined,
  inactive: false,
  currentPresetId: null,
  params: {},
  fps: 0,
  cpuLoad: 0,
  spotify: { isPlaying: false },
  beatGateEnabled: true,
  setEngineState: (s) => set({ engineState: s }),
  setFrame: (f) => {
    const now = f.nowMs || performance.now()
    set({ analysisFrame: f, lastFrameAt: now, inactive: false })
  },
  setInactive: (b) => set({ inactive: b }),
  setPreset: (id) => set({ currentPresetId: id }),
  setParam: (k, v) => set(s => ({ params: { ...s.params, [k]: v } })),
  setParams: (p) => set(s => ({ params: { ...s.params, ...p } })),
  setPerf: (fps, cpuLoad) => set({ fps, cpuLoad }),
  setSpotify: (sli) => set(s => ({ spotify: { ...s.spotify, ...sli } })),
  toggleBeatGate: () => set(s => ({ beatGateEnabled: !s.beatGateEnabled })),
}))
