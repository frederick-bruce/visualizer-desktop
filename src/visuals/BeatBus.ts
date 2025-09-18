export type BeatInput = {
  rms: number
  onset: boolean
  tempoBPM?: number | null
  bands?: readonly number[]
  bass?: number
  mid?: number
  treble?: number
}

export type Envelopes = { rms: number; bass: number; mid: number; treble: number }

export class BeatBus {
  private refractoryMs = 150
  private lastBeat = 0
  private rmsAvg = 0
  private rmsVar = 0
  private n = 0
  private env: Envelopes = { rms: 0, bass: 0, mid: 0, treble: 0 }
  private A = 0.03
  private R = 0.18

  setEnvelope(ar: { attackMs?: number; releaseMs?: number }) {
    if (ar.attackMs != null) this.A = Math.max(1, ar.attackMs) / 1000
    if (ar.releaseMs != null) this.R = Math.max(1, ar.releaseMs) / 1000
  }

  setRefractory(ms: number) { this.refractoryMs = Math.max(60, Math.min(240, ms)) }

  update(dt: number, input: BeatInput) {
    // online mean/variance for rms
    this.n++
    const x = input.rms
    const delta = x - this.rmsAvg
    this.rmsAvg += delta / this.n
    this.rmsVar += delta * (x - this.rmsAvg)

    // envelopes (one-pole AR)
    const upd = (cur: number, target: number) => {
      const a = target > cur ? (1 - Math.exp(-dt / this.A)) : (1 - Math.exp(-dt / this.R))
      return cur + (target - cur) * a
    }
    this.env.rms = upd(this.env.rms, input.rms)
    this.env.bass = upd(this.env.bass, input.bass ?? 0)
    this.env.mid = upd(this.env.mid, input.mid ?? 0)
    this.env.treble = upd(this.env.treble, input.treble ?? 0)
  }

  get envelopes(): Envelopes { return this.env }

  get onBeat(): boolean {
    const now = performance.now()
    const refractory = now - this.lastBeat < this.refractoryMs
    const std = Math.sqrt(this.rmsVar / Math.max(1, this.n - 1))
    const k = 1.2
    const pass = !refractory && (std > 0 ? (this.env.rms > this.rmsAvg + k * std) : false)
    if (pass) this.lastBeat = now
    return pass
  }

  every(n: number, beatCount: number) { return beatCount % n === 0 }

  onDownbeat(phase: number, eps: number = 0.08) { return Math.abs(phase - 0) < eps || Math.abs(phase - 1) < eps }

  phase(div: '1' | '1/2' | '1/4', beatPhase: number) {
    const mult = div === '1' ? 1 : div === '1/2' ? 2 : 4
    return (beatPhase * mult) % 1
  }
}
