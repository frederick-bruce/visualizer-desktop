import { getValidToken } from '@/lib/spotify/auth'
import { playerStore, type PlayerRxState } from '@/lib/spotify/player'

export interface TrackMetadata {
  id: string
  name?: string
  artists?: string
  artistsArr?: string[]
  album?: string
  albumArt?: string
  explicit?: boolean
  popularity?: number
}

export type MetadataListener = (m: TrackMetadata) => void

let listeners = new Set<MetadataListener>()
export function onTrackMetadata(cb: MetadataListener) { listeners.add(cb); return () => listeners.delete(cb) }

function emit(m: TrackMetadata) { listeners.forEach(cb => cb(m)) }

interface PollState {
  timer: number | null
  etag: string | null
  backoffUntil: number
  lastTrackId: string | null
  running: boolean
}

const state: PollState = { timer: null, etag: null, backoffUntil: 0, lastTrackId: null, running: false }

function schedule(nextMs: number, tick: () => void) {
  if (state.timer) { clearTimeout(state.timer); state.timer = null }
  state.timer = window.setTimeout(tick, nextMs)
}

async function fetchCurrentlyPlaying(etag?: string | null): Promise<Response> {
  const token = await getValidToken()
  if (!token) throw new Error('no_token')
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` }
  if (etag) headers['If-None-Match'] = etag
  return fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers })
}

function parseMeta(j: any): TrackMetadata | null {
  if (!j || !j.item) return null
  const item = j.item
  const id: string = item.id
  const name: string | undefined = item.name
  const artistsArr: string[] = (item.artists || []).map((a: any) => a.name)
  const artists: string | undefined = artistsArr.join(', ')
  const album: string | undefined = item.album?.name
  const albumArt: string | undefined = item.album?.images?.[0]?.url
  const explicit: boolean | undefined = item.explicit
  const popularity: number | undefined = item.popularity
  return { id, name, artists, artistsArr, album, albumArt, explicit, popularity }
}

export interface StartOptions {
  intervalMs?: number // default 5000
}

export function startMetadataPolling(opts?: StartOptions) {
  if (state.running) return { stop }
  state.running = true
  const interval = Math.max(2500, opts?.intervalMs ?? 5000)

  const onStore = (s: PlayerRxState) => {
    if (s.paused) {
      // paused: zero calls
      if (state.timer) { clearTimeout(state.timer); state.timer = null }
      return
    }
    // playing
    if (!state.timer) schedule(0, tick) // kick immediately on unpause
  }
  const unsub = playerStore.subscribe(onStore)
  // also seed initial decision
  onStore(playerStore.get())

  async function tick() {
    if (!state.running) return
    const now = Date.now()
    const s = playerStore.get()
    if (s.paused) { state.timer = null; return }
    if (now < state.backoffUntil) { schedule(Math.max(50, state.backoffUntil - now), tick); return }

    try {
      const res = await fetchCurrentlyPlaying(state.etag)
      if (res.status === 304) {
        // unchanged
      } else if (res.status === 200) {
        const et = res.headers.get('ETag')
        if (et) state.etag = et
        const j = await res.json()
        const meta = parseMeta(j)
        if (meta) {
          if (state.lastTrackId !== meta.id) {
            state.lastTrackId = meta.id
          }
          emit(meta)
        }
      } else if (res.status === 429) {
        const ra = Number(res.headers.get('Retry-After') || '1')
        const backoff = Math.min(5000, Math.max(1000, ra * 1000))
        state.backoffUntil = Date.now() + backoff
      } else if (res.status === 204) {
        // no content; likely nothing is playing
      } else if (res.status >= 500) {
        // transient server error: short backoff
        state.backoffUntil = Date.now() + 2000
      } else if (res.status === 401) {
        // token helper should refresh next call; small delay
        state.backoffUntil = Date.now() + 1000
      } else {
        // other codes: do not spam
        state.backoffUntil = Date.now() + 1500
      }
    } catch {
      // network or token error: backoff a bit
      state.backoffUntil = Date.now() + 1500
    } finally {
      // schedule next tick if still playing
      const playing = !playerStore.get().paused
      if (playing) schedule(interval, tick); else state.timer = null
    }
  }

  return { stop }

  function stop() {
    state.running = false
    if (state.timer) { clearTimeout(state.timer); state.timer = null }
    state.etag = null
    state.backoffUntil = 0
    state.lastTrackId = null
    unsub()
  }
}
