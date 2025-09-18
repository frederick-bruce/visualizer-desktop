/*
  AudioWorklet: FFT + Spectral Onset
  - Window size: 1024, hop: 512
  - Hanning window
  - Radix-2 iterative FFT (minimal implementation)
  - 32 linear bands (low to high)
  - Spectral flux onset with moving threshold and refractory
*/

class FFT {
  constructor(n){
    this.n = n
    this.cos = new Float32Array(n/2)
    this.sin = new Float32Array(n/2)
    for (let i=0;i<n/2;i++){ this.cos[i] = Math.cos(-2*Math.PI*i/n); this.sin[i]=Math.sin(-2*Math.PI*i/n) }
    this.rev = new Uint32Array(n)
    let j=0
    for (let i=0;i<n;i++){
      this.rev[i]=j
      let bit=n>>1
      while(j & bit){ j^=bit; bit>>=1 }
      j|=bit
    }
  }
  transform(re, im){
    const n=this.n, rev=this.rev
    for(let i=0;i<n;i++){ const j=rev[i]; if (j>i){ let tr=re[i]; re[i]=re[j]; re[j]=tr; tr=im[i]; im[i]=im[j]; im[j]=tr } }
    for(let size=2; size<=n; size<<=1){
      const half=size>>1, step=n/size
      for(let i=0;i<n;i+=size){
        for(let k=0;k<half;k++){
          const tcos=this.cos[k*step], tsin=this.sin[k*step]
          const ur=re[i+k], ui=im[i+k]
          const vr=re[i+k+half]*tcos - im[i+k+half]*tsin
          const vi=re[i+k+half]*tsin + im[i+k+half]*tcos
          re[i+k]=ur+vr; im[i+k]=ui+vi
          re[i+k+half]=ur-vr; im[i+k+half]=ui-vi
        }
      }
    }
  }
}

class FftOnsetProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(){ return [] }
  constructor(){
    super()
    this.sampleRate = sampleRate
    this.winSize = 1024
    this.hop = 512
    this.buffer = new Float32Array(this.winSize)
    this.bufPos = 0
    this.window = new Float32Array(this.winSize)
    for (let i=0;i<this.winSize;i++) this.window[i] = 0.5 * (1 - Math.cos(2*Math.PI*i/(this.winSize-1)))
    this.fft = new FFT(this.winSize)
    this.prevMag = new Float32Array(this.winSize/2)
    this.fluxHist = new Float32Array(43) // ~0.5s at ~86 fps
    this.fluxIdx = 0
    this.lastOnsetAt = 0
    this.refractoryMs = 120
    this.framesSincePost = 0
  }
  process(inputs){
    const ch = inputs[0]
    if (!ch || ch.length===0) return true
    const input = ch[0]
    const sr = this.sampleRate
    let i = 0
    while(i < input.length){
      const remain = this.winSize - this.bufPos
      const copy = Math.min(remain, input.length - i)
      this.buffer.set(input.subarray(i, i+copy), this.bufPos)
      this.bufPos += copy; i += copy
      if (this.bufPos >= this.winSize){
        // Windowed FFT frame
        const re = new Float32Array(this.winSize)
        const im = new Float32Array(this.winSize)
        let rms = 0
        for (let j=0;j<this.winSize;j++){ const v = this.buffer[j]*this.window[j]; re[j]=v; rms += v*v }
        rms = Math.sqrt(rms/this.winSize)
        this.fft.transform(re, im)
        const mag = new Float32Array(this.winSize/2)
        for (let k=0;k<mag.length;k++){ const rr=re[k], ii=im[k]; mag[k]=Math.sqrt(rr*rr+ii*ii) }
        // spectral flux
        let flux = 0
        for (let k=0;k<mag.length;k++){
          const d = mag[k]-this.prevMag[k]
          if (d>0) flux += d
          this.prevMag[k]=mag[k]
        }
        // update flux history
        this.fluxHist[this.fluxIdx++ % this.fluxHist.length] = flux
        const mean = this.fluxHist.reduce((a,b)=>a+b,0)/this.fluxHist.length
        const varSum = this.fluxHist.reduce((a,b)=>a+(b-mean)*(b-mean),0)/this.fluxHist.length
        const std = Math.sqrt(varSum)
        const thresh = mean + 1.5*std
        const nowMs = currentTime * 1000
        const onset = (flux > thresh) && ((nowMs - this.lastOnsetAt) > this.refractoryMs)
        if (onset) this.lastOnsetAt = nowMs
        // 32 linear bands
        const bandCount = 32
        const bands = new Float32Array(bandCount)
        const step = Math.floor(mag.length / bandCount) || 1
        for (let b=0;b<bandCount;b++){
          let sum=0; let cnt=0
          const start=b*step, end=Math.min(mag.length, start+step)
          for (let k=start;k<end;k++){ sum += mag[k]; cnt++ }
          bands[b] = cnt? (sum/cnt) : 0
        }
        // post (throttle to ~120 fps max)
        if (++this.framesSincePost >= 1){
          this.framesSincePost = 0
          this.port.postMessage({
            type: 'frame', rms, onset, bands: bands, sampleRate: sr, hopMs: (this.hop/sr)*1000
          })
        }
        // shift by hop
        this.buffer.copyWithin(0, this.hop)
        this.bufPos = this.winSize - this.hop
      }
    }
    return true
  }
}

registerProcessor('fft-onset-processor', FftOnsetProcessor)
