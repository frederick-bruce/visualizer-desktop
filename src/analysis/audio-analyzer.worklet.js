// AudioWorkletProcessor: 2048-point FFT, Hann window, adaptive onset, bands[32], centroid, RMS, tempo estimate
// Designed to minimize heap churn: all arrays preallocated and reused.

class FFT2048 {
  constructor() {
    this.N = 2048
    this.N2 = this.N >> 1
    this.rev = new Uint16Array(this.N)
    this.cos = new Float32Array(this.N2)
    this.sin = new Float32Array(this.N2)
    this._init()
  }
  _init() {
    const N = this.N
    let j = 0
    for (let i = 0; i < N; i++) {
      this.rev[i] = j
      let bit = N >> 1
      while (j & bit) { j ^= bit; bit >>= 1 }
      j ^= bit
    }
    for (let k = 0; k < this.N2; k++) {
      const ang = -2 * Math.PI * k / this.N
      this.cos[k] = Math.cos(ang)
      this.sin[k] = Math.sin(ang)
    }
  }
  transform(re, im) {
    const N = this.N
    for (let i = 0; i < N; i++) {
      const ri = this.rev[i]
      if (ri > i) { const tr = re[i]; re[i] = re[ri]; re[ri] = tr; const ti = im[i]; im[i] = im[ri]; im[ri] = ti }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1
      const step = this.N / size
      for (let i = 0; i < N; i += size) {
        let k = 0
        for (let j = 0; j < half; j++) {
          const tcos = this.cos[k|0], tsin = this.sin[k|0]
          const uRe = re[i + j], uIm = im[i + j]
          const vRe = re[i + j + half], vIm = im[i + j + half]
          const xr = vRe * tcos - vIm * tsin
          const xi = vRe * tsin + vIm * tcos
          re[i + j] = uRe + xr
          im[i + j] = uIm + xi
          re[i + j + half] = uRe - xr
          im[i + j + half] = uIm - xi
          k += step
        }
      }
    }
  }
}

class AnalyzerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [] }
  constructor() {
    super()
    this.sampleRate = sampleRate
    this.N = 2048
    this.hann = new Float32Array(this.N)
    for (let i = 0; i < this.N; i++) this.hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (this.N - 1)))
    this.fft = new FFT2048()
    this.r = new Float32Array(this.N)
    this.i = new Float32Array(this.N)
    this.mag = new Float32Array(this.N/2)
    this.prevMag = new Float32Array(this.N/2)
    this.frameBuf = new Float32Array(this.N * 2) // circular buffer
    this.bufWrite = 0
    this.hop = Math.max(1, Math.round(this.sampleRate / 60)) // cap to ~60 fps
    this.advance = 0
    this.bandEdges = this._computeBandEdges(32)
    this.bands = new Float32Array(32)
    this.rmsVal = 0
    this.centroid = 0
    this.flux = 0
    this.prevFlux = new Float32Array(120)
    this.prevFluxLen = 0
    this.prevFluxIdx = 0
    this.bassEMA = 0
    this.midEMA = 0
    this.trebEMA = 0
    this.lastOnsetAt = 0
    this.onset = false
    this.onsets = new Float32Array(64)
    this.onsetLen = 0
    this.tempoBPM = 0
  }
  _computeBandEdges(num) {
    // log-spaced between 20 Hz and Nyquist
    const ny = this.sampleRate / 2
    const edges = new Uint16Array(num + 1)
    const fmin = 20
    for (let b = 0; b <= num; b++) {
      const f = fmin * Math.pow(ny / fmin, b / num)
      const bin = Math.max(0, Math.min(this.N/2 - 1, Math.round(f * this.N / this.sampleRate)))
      edges[b] = bin
    }
    edges[num] = this.N/2 - 1
    return edges
  }
  _computeFeatures(win) {
    // window to r, zero imag
    for (let i = 0; i < this.N; i++) { this.r[i] = win[i] * this.hann[i]; this.i[i] = 0 }
    this.fft.transform(this.r, this.i)
    // magnitude and flux
    let flux = 0
    for (let k = 0; k < this.N/2; k++) {
      const mr = this.r[k], mi = this.i[k]
      const m = Math.hypot(mr, mi)
      const pm = this.prevMag[k]
      this.mag[k] = m
      const d = m - pm; if (d > 0) flux += d
      this.prevMag[k] = m
    }
    this.flux = flux
    // RMS
    let sq = 0
    for (let i = 0; i < this.N; i++) { const v = win[i]; sq += v*v }
    this.rmsVal = Math.sqrt(sq / this.N)
    // Centroid
    let num = 0, den = 0
    const binHz = this.sampleRate / this.N
    for (let k = 1; k < this.N/2; k++) { const m = this.mag[k]; num += k * binHz * m; den += m }
    this.centroid = den > 1e-6 ? num / den : 0
    // Bands[32]
    for (let b = 0; b < 32; b++) {
      const s = this.bandEdges[b], e = this.bandEdges[b+1]
      let sum = 0
      for (let k = s; k <= e; k++) sum += this.mag[k]
      this.bands[b] = sum / Math.max(1, e - s + 1)
    }
    // Bass/mid/treble smoothed (EMA)
    const hz = (bin) => bin * binHz
    const toBin = (f) => Math.max(1, Math.min(this.N/2 - 1, Math.round(f / binHz)))
    const b0 = toBin(80), b1 = toBin(250), m1 = toBin(2000), t1 = toBin(8000)
    const avgRange = (a,b) => { let s=0,c=0; for (let k=a;k<=b;k++){s+=this.mag[k]; c++} return s/Math.max(1,c) }
    const bass = avgRange(b0, b1)
    const mid = avgRange(b1+1, m1)
    const treb = avgRange(m1+1, Math.min(this.N/2 - 1, t1))
    const alpha = 0.2
    this.bassEMA = this.bassEMA + alpha * (bass - this.bassEMA)
    this.midEMA = this.midEMA + alpha * (mid - this.midEMA)
    this.trebEMA = this.trebEMA + alpha * (treb - this.trebEMA)
    // Adaptive onset: median + k * MAD over last ~120 flux values
    const idx = this.prevFluxIdx
    this.prevFlux[idx] = flux
    this.prevFluxIdx = (idx + 1) % this.prevFlux.length
    if (this.prevFluxLen < this.prevFlux.length) this.prevFluxLen++
    // Copy to temp for median calc (small array 120)
    const tmp = new Float32Array(this.prevFluxLen)
    for (let i=0;i<this.prevFluxLen;i++) tmp[i] = this.prevFlux[i]
    tmp.sort()
    const mIdx = Math.floor(this.prevFluxLen/2)
    const med = this.prevFluxLen%2? tmp[mIdx] : 0.5*(tmp[mIdx-1]+tmp[mIdx])
    for (let i=0;i<this.prevFluxLen;i++) tmp[i] = Math.abs(this.prevFlux[i]-med)
    tmp.sort()
    const mad = this.prevFluxLen%2? tmp[mIdx] : 0.5*(tmp[mIdx-1]+tmp[mIdx])
    const thresh = med + 1.8 * (mad || 1)
    const now = currentTime * 1000
    const refractory = 120
    const onset = (flux > thresh) && (now - this.lastOnsetAt > refractory)
    this.onset = onset
    if (onset) { this.lastOnsetAt = now; this._registerOnset(now) }
  }
  _registerOnset(tMs) {
    // Maintain last 64 onsets, derive tempo by clustering IOIs
    if (this.onsetLen < this.onsets.length) this.onsets[this.onsetLen++] = tMs
    else {
      for (let i=1;i<this.onsets.length;i++) this.onsets[i-1] = this.onsets[i]
      this.onsets[this.onsets.length-1] = tMs
    }
    if (this.onsetLen < 4) return
    const iois = new Float32Array(this.onsetLen-1)
    for (let i=1;i<this.onsetLen;i++) iois[i-1] = (this.onsets[i]-this.onsets[i-1])/1000
    // cluster within 8%
    const used = new Uint8Array(iois.length)
    let bestCount = 0, bestAvg = 0
    for (let i=0;i<iois.length;i++) if (!used[i]) {
      let count=1, sum=iois[i]
      used[i]=1
      for (let j=i+1;j<iois.length;j++) if (!used[j]) {
        const d = Math.abs(iois[j]-iois[i])/iois[i]
        if (d<0.08) { used[j]=1; sum+=iois[j]; count++ }
      }
      if (count>bestCount) { bestCount=count; bestAvg=sum/count }
    }
    if (bestCount>=2 && bestAvg>0.18 && bestAvg<2.5) {
      const bpm = 60/bestAvg
      // smooth
      this.tempoBPM = this.tempoBPM? this.tempoBPM*0.85 + bpm*0.15 : bpm
    }
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (input && input.length) {
      const ch0 = input[0]
      if (ch0 && ch0.length) {
        const data = ch0
        // append to circular buffer
        for (let i=0;i<data.length;i++) {
          this.frameBuf[this.bufWrite] = data[i]
          this.bufWrite = (this.bufWrite + 1) % this.frameBuf.length
          this.advance++
          if (this.advance >= this.hop) {
            this.advance = 0
            // copy last N samples into temp window
            const win = this.r // reuse r as window buffer before FFT overwrites
            let idx = (this.bufWrite - this.N)
            if (idx < 0) idx += this.frameBuf.length
            for (let k=0;k<this.N;k++) { win[k] = this.frameBuf[idx]; idx = (idx+1)%this.frameBuf.length }
            this._computeFeatures(win)
            // Post result (numbers only; small array for bands)
            this.port.postMessage({
              rms: this.rmsVal,
              spectralFlux: this.flux,
              onset: this.onset,
              tempoBPM: this.tempoBPM||undefined,
              centroid: this.centroid,
              bands: Array.from(this.bands),
              bass: this.bassEMA,
              mid: this.midEMA,
              treble: this.trebEMA
            })
          }
        }
      }
    }
    return true
  }
}

registerProcessor('audio-analyzer', AnalyzerProcessor)
