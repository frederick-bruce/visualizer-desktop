// Audio analyser helper
// Attempts to reuse a singleton AnalyserNode. Provide integration code where Spotify Web Playback SDK's audio element is accessible.

let cached: { analyser: AnalyserNode; ctx: AudioContext } | null = null

export async function getAnalyser(): Promise<{ analyser: AnalyserNode; ctx: AudioContext }> {
  if (cached) return cached
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.8
  analyser.minDecibels = -90
  analyser.maxDecibels = -10

  // NOTE: You must connect a source node externally, e.g.:
  // const audioEl = document.querySelector('audio')
  // const src = ctx.createMediaElementSource(audioEl)
  // src.connect(analyser); analyser.connect(ctx.destination)
  // Keep this file source-agnostic.

  cached = { analyser, ctx }
  return cached
}

/**
 * Connect an external AudioNode (e.g., a worklet output) to the shared analyser.
 * If an analyser already exists on a different AudioContext, it will be recreated on the provided ctx.
 * Does not connect to destination; purely analysis.
 */
export async function connectExternalSource(node: AudioNode, ctx: AudioContext): Promise<{ analyser: AnalyserNode; ctx: AudioContext }> {
  // If we already initialized with the same context, just wire up
  if (cached && cached.ctx === ctx) {
    try { node.connect(cached.analyser) } catch {}
    // Ensure graph is pulled: add a silent sink path once per context
    try {
      if (!(ctx as any)._vdSilentSink) {
        const silent = ctx.createGain(); silent.gain.value = 0
        node.connect(silent); silent.connect(ctx.destination)
        ;(ctx as any)._vdSilentSink = silent
      }
    } catch {}
    return cached
  }
  // Otherwise (or if no cached), create analyser in provided context
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.8
  analyser.minDecibels = -90
  analyser.maxDecibels = -10
  try { node.connect(analyser) } catch {}
  // Create silent sink to keep processing active without audible output
  try {
    const silent = ctx.createGain(); silent.gain.value = 0
    node.connect(silent); silent.connect(ctx.destination)
    ;(ctx as any)._vdSilentSink = silent
  } catch {}
  cached = { analyser, ctx }
  return cached
}

export function attachMediaElement(audio: HTMLMediaElement) {
  if (!cached) return
  try {
    // Avoid creating multiple sources for the same element (WebAudio restriction)
    // We can't easily detect prior creation, so wrap in try/catch.
    const src = cached.ctx.createMediaElementSource(audio)
    src.connect(cached.analyser)
    cached.analyser.connect(cached.ctx.destination)
  } catch (e) {
    // Silently ignore if already connected
  }
}
