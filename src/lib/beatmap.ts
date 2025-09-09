// Convert Spotify Audio Analysis into a timeline we can query at runtime
// We use beats + sections to drive intensity/tempo changes


export type Timeline = {
beats: { start: number; duration: number; confidence: number }[]
sections: { start: number; duration: number; tempo: number; loudness: number }[]
}


export function buildTimeline(analysis: any): Timeline {
const beats = (analysis.beats || []).map((b: any) => ({ start: b.start, duration: b.duration, confidence: b.confidence }))
const sections = (analysis.sections || []).map((s: any) => ({ start: s.start, duration: s.duration, tempo: s.tempo, loudness: s.loudness }))
return { beats, sections }
}


export function intensityAt(tl: Timeline, t: number) {
// simple: intensity spikes at beat start, scales with section loudness
const beatIdx = tl.beats.findIndex(b => t >= b.start && t < b.start + b.duration)
const section = tl.sections.find(s => t >= s.start && t < s.start + s.duration)
const base = section ? Math.max(0, 1 + section.loudness / 60) : 1
if (beatIdx === -1) return 0.3 * base
const b = tl.beats[beatIdx]
const phase = (t - b.start) / b.duration
const spike = Math.max(0, 1 - phase) // decay over beat
return base * (0.6 + 0.8 * spike)
}