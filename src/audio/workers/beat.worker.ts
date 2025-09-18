import { wrap } from 'web-audio-beat-detector-broker'

const broker = wrap(self as any)

let buffer: Float32Array | null = null
let sampleRate = 44100
let lastBpmPost = 0

self.onmessage = async (ev: MessageEvent<any>) => {
  const d = ev.data || {}
  if (d.type === 'append') {
    const chunk: Float32Array = d.samples
    sampleRate = d.sampleRate || sampleRate
    if (!buffer) buffer = chunk
    else {
      // Concatenate (limit length to ~10s for responsiveness)
      const maxLen = Math.min((sampleRate * 10)|0, (buffer.length + chunk.length))
      const next = new Float32Array(Math.min(maxLen, buffer.length + chunk.length))
      const keep = Math.min(buffer.length, next.length - chunk.length)
      next.set(buffer.subarray(buffer.length - keep))
      next.set(chunk, keep)
      buffer = next
    }
    // Periodically compute BPM (every ~1s)
    const now = performance.now()
    if (buffer && now - lastBpmPost > 1000) {
      try {
        const audioBufferLike: any = {
          sampleRate,
          length: buffer.length,
          duration: buffer.length / sampleRate,
          numberOfChannels: 1,
          getChannelData: (i: number) => buffer
        }
        const bpm = await broker.guess(audioBufferLike)
        ;(self as any).postMessage({ bpm })
      } catch {}
      lastBpmPost = now
    }
  }
}

export {}
