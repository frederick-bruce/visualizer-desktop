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
