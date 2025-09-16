// AudioWorkletProcessor that receives base64-encoded Float32 PCM frames via port
// and emits them on its single output (1 channel). No playback is attached unless explicitly connected.

class PcmRing {
  constructor(capacity) {
    this.buf = new Float32Array(capacity)
    this.read = 0
    this.write = 0
    this.size = capacity
    this.len = 0
  }
  push(data) {
    const n = data.length
    for (let i=0;i<n;i++) {
      this.buf[this.write] = data[i]
      this.write = (this.write + 1) % this.size
      if (this.len < this.size) this.len++
      else this.read = (this.read + 1) % this.size // overwrite oldest
    }
  }
  pull(out) {
    const n = out.length
    for (let i=0;i<n;i++) {
      if (this.len > 0) {
        out[i] = this.buf[this.read]
        this.read = (this.read + 1) % this.size
        this.len--
      } else {
        out[i] = 0
      }
    }
  }
}

class PcmSourceProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.ring = new PcmRing(48000) // 1 second at 48k
    this.port.onmessage = (ev) => {
      const { buffer } = ev.data || {}
      if (buffer) {
        const f32 = new Float32Array(buffer)
        this.ring.push(f32)
      }
    }
  }
  process(inputs, outputs) {
    const out = outputs[0]
    if (out && out[0]) {
      const ch0 = out[0]
      this.ring.pull(ch0)
    }
    return true
  }
}

registerProcessor('pcm-source', PcmSourceProcessor)
