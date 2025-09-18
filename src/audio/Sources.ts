export type BuiltSource = { ctx: AudioContext; sourceNode: AudioNode; cleanup: () => void }
export type AudioSourceFactory = () => Promise<BuiltSource>

export function createFromHtmlAudio(el: HTMLAudioElement): AudioSourceFactory {
  return async () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const src = ctx.createMediaElementSource(el)
    // Ensure the element routes to destination so we can hear it
    try { src.connect(ctx.destination) } catch {}
    const cleanup = () => { try { src.disconnect() } catch {}; try { ctx.close() } catch {} }
    return { ctx, sourceNode: src, cleanup }
  }
}

export function createFromMic(constraints: MediaStreamConstraints = { audio: true }): AudioSourceFactory {
  return async () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const src = ctx.createMediaStreamSource(stream)
    const cleanup = () => {
      try { src.disconnect() } catch {}
      try { stream.getTracks().forEach(t => t.stop()) } catch {}
      try { ctx.close() } catch {}
    }
    return { ctx, sourceNode: src, cleanup }
  }
}
