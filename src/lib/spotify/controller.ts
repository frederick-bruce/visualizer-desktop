import { initPlayer, ensureActiveDevice, playerStore } from '@/lib/spotify/player'
import { startMetadataPolling, onTrackMetadata, type TrackMetadata } from '@/lib/spotify/polling'
import { withSpotifyAuth } from '@/lib/spotify/auth'

export type Unsub = () => void

export type TrackLite = { id: string; name: string; artists: string[]; album: string; image: string; durationMs: number }

export interface VisualizerState {
  ready: boolean
  paused: boolean
  position: number
  duration: number
  volume: number
  shuffle: boolean
  repeatMode: 'off' | 'context' | 'track'
  track?: TrackLite
}

const API = withSpotifyAuth('https://api.spotify.com/v1')

let subs = new Set<(s: VisualizerState) => void>()
let current: VisualizerState = { ready: false, paused: true, position: 0, duration: 0, volume: 0.6, shuffle: false, repeatMode: 'off' }

function emit() { subs.forEach(cb => cb(current)) }

let metadataUnsub: Unsub | null = null
let storeUnsub: Unsub | null = null
let started = false

function toTrackLite(meta?: TrackMetadata): TrackLite | undefined {
  if (!meta) return undefined
  return { id: meta.id, name: meta.name || '', artists: meta.artistsArr || [], album: meta.album || '', image: meta.albumArt || '', durationMs: current.duration }
}

async function syncFromStore() {
  const s = playerStore.get()
  current = {
    ready: true,
    paused: s.paused,
    position: s.position,
    duration: s.duration,
    volume: s.volume,
    shuffle: s.shuffle,
    repeatMode: s.repeatMode,
    track: current.track // keep until polling updates with full fields
  }
  emit()
}

async function ensureAnd<T>(fn: () => Promise<T>): Promise<T> {
  const ok = await ensureActiveDevice()
  if (!ok) {
    // Best-effort recover
    await ensureActiveDevice()
  }
  return fn()
}

export const SpotifyController = {
  async init(): Promise<void> {
    if (started) return
    started = true
    await initPlayer({ name: 'Freddy Visualizer', volume: 0.6 })
    // Subscribe to SDK-driven state
    storeUnsub = playerStore.subscribe(() => { syncFromStore() })
    await syncFromStore()
    // Start lightweight metadata polling
    const { stop } = startMetadataPolling({ intervalMs: 5000 })
    metadataUnsub = stop
    onTrackMetadata((m) => {
      current = { ...current, track: toTrackLite(m) }
      emit()
    })
  },
  async play(uri?: string): Promise<void> {
    await ensureAnd(async () => {
      if (uri) await API<void>('/me/player/play', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: [uri] }) })
      else await API<void>('/me/player/play', { method: 'PUT' })
    })
  },
  async pause(): Promise<void> {
    await ensureAnd(async () => { await API<void>('/me/player/pause', { method: 'PUT' }) })
  },
  async next(): Promise<void> {
    await ensureAnd(async () => { await API<void>('/me/player/next', { method: 'POST' }) })
  },
  async prev(): Promise<void> {
    await ensureAnd(async () => { await API<void>('/me/player/previous', { method: 'POST' }) })
  },
  async seek(ms: number): Promise<void> {
    await ensureAnd(async () => { await API<void>(`/me/player/seek?position_ms=${Math.max(0, Math.floor(ms))}`, { method: 'PUT' }) })
  },
  async setVolume(v01: number): Promise<void> {
    const v = Math.max(0, Math.min(1, v01))
    await ensureAnd(async () => { await API<void>(`/me/player/volume?volume_percent=${Math.round(v*100)}`, { method: 'PUT' }) })
  },
  async shuffle(on: boolean): Promise<void> {
    await ensureAnd(async () => { await API<void>(`/me/player/shuffle?state=${on ? 'true' : 'false'}`, { method: 'PUT' }) })
  },
  async repeat(mode: 'off' | 'track' | 'context'): Promise<void> {
    await ensureAnd(async () => { await API<void>(`/me/player/repeat?state=${mode}`, { method: 'PUT' }) })
  },
  getState(): VisualizerState { return current },
  onState(cb: (s: VisualizerState) => void): Unsub { subs.add(cb); cb(current); return () => subs.delete(cb) }
}

export default SpotifyController
