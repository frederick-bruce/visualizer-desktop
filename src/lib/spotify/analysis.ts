// Spotify Analysis client with caching and cursors
import { withSpotifyAuth } from '@/lib/spotify/auth'

export type Timed = { start: number; duration: number }
export type Section = Timed & { loudness: number; tempo: number; key: number; mode: number }
export type Analysis = {
  beats: Timed[]
  bars: Timed[]
  tatums: Timed[]
  sections: Section[]
}

const API = withSpotifyAuth('https://api.spotify.com/v1')
const cache = new Map<string, Analysis>()
const blocked = new Set<string>() // trackIds that returned 403/404 so we don't refetch frequently

export async function fetchAnalysis(trackId: string): Promise<Analysis | null> {
  if (cache.has(trackId)) return cache.get(trackId)!
  if (blocked.has(trackId)) return null
  let raw: any = null
  try {
    raw = await API<any>(`/audio-analysis/${encodeURIComponent(trackId)}`)
  } catch (e: any) {
    // e may contain status; handle common denial statuses gracefully
    const status = e?.status || e?.response?.status
    if (status === 401 || status === 403 || status === 404) {
      // Market blocked or unauthorized: cache null placeholder to avoid hammering
      blocked.add(trackId)
      return null
    }
    throw e
  }
  const mapTimed = (arr?: any[]): Timed[] => (arr||[]).map(x => ({ start: x.start ?? 0, duration: x.duration ?? 0 }))
  const mapSections = (arr?: any[]): Section[] => (arr||[]).map(x => ({ start: x.start ?? 0, duration: x.duration ?? 0, loudness: x.loudness ?? x.loudness_start ?? -20, tempo: x.tempo ?? 120, key: x.key ?? 0, mode: x.mode ?? 1 }))
  const a: Analysis = { beats: mapTimed(raw?.beats), bars: mapTimed(raw?.bars), tatums: mapTimed(raw?.tatums), sections: mapSections(raw?.sections) }
  cache.set(trackId, a)
  return a
}

export function makeCursor<T extends Timed>(array: T[]) {
  let idx = 0
  return function at(tSec: number): { index: number; event: T | null } {
    if (!array.length) return { index: -1, event: null }
    // Advance while current event end <= t
    while (idx < array.length && (array[idx].start + array[idx].duration) <= tSec) idx++
    // If t before current, step back (allow small backtracking on seeks)
    while (idx > 0 && array[idx].start > tSec) idx--
    const ev = array[idx] || null
    return { index: idx, event: ev }
  }
}
