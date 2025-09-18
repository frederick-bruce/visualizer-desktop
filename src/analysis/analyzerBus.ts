export type AnalyzerLite = {
  nowMs: number
  rms: number
  onset: boolean
  bands: number[]
  bass?: number
  mid?: number
  treble?: number
  tempoBPM?: number | null
}

let last: AnalyzerLite | null = null

export function setAnalyzerFrame(f: AnalyzerLite) { last = f }
export function getAnalyzerFrame(): AnalyzerLite | null { return last }
