import { getAccessToken } from './spotifyAuth'

// Error envelope
export type ClientErrorKind = 'Auth' | 'Network' | 'RateLimit' | 'SDK' | 'Unknown'
export interface ClientError { kind: ClientErrorKind; message: string; retryIn?: number }

// Basic typed subsets (trimmed to what UI currently uses)
export interface MeProfile { id: string; display_name?: string; email?: string; images?: { url: string }[] }
export interface Device { id: string; name: string; is_active: boolean; is_restricted?: boolean; volume_percent?: number }
export interface DevicesResponse { devices: Device[] }
export interface PlaybackState { device?: Device; progress_ms?: number; is_playing?: boolean; item?: { id?: string; name?: string; duration_ms?: number; album?: { images?: { url: string }[] } } }

interface RequestOptions { method?: string; body?: any; retry?: number }

const API = 'https://api.spotify.com/v1'
const MAX_RETRIES = 4
const cooldowns = new Map<string, number>()
const etags = new Map<string, { etag: string; body: any }>()
const debouncers = new Map<string, { t: any; lastArgs: any }>()

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function expBackoff(base: number, attempt: number) {
  const jitter = Math.random() * 150
  return Math.min(10_000, base * 2 ** attempt) + jitter
}

async function coreFetch<T = any>(path: string, { method = 'GET', body, retry = 0 }: RequestOptions = {}): Promise<T> {
  // cooldown
  const key = `${method} ${path}`
  const until = cooldowns.get(key) || 0
  if (Date.now() < until) throw { kind: 'Unknown', message: 'Cooldown active', until } as ClientError
  let token = await getAccessToken()
  if (!token) throw { kind: 'Auth', message: 'Not authenticated' } as ClientError

  const make = async (t: string) => {
    const headers: Record<string,string> = { 'Authorization': `Bearer ${t}` }
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${API}${path}`, { method, body: body ? JSON.stringify(body) : undefined, headers })
    return res
  }

  let res: Response
  try { res = await make(token) } catch (e: any) { throw { kind: 'Network', message: e?.message || 'Network error' } as ClientError }

  // 401 once -> refresh & retry
  if (res.status === 401 && retry === 0) {
    token = await getAccessToken()
  if (!token) throw { kind: 'Auth', message: 'Unable to refresh token' } as ClientError
    res = await make(token)
  }
  if (res.status === 401) throw { kind: 'Auth', message: 'Unauthorized (after refresh)' } as ClientError

  // Rate limit handling
  if (res.status === 429) {
  const ra = Number(res.headers.get('Retry-After') || '1')
  if (retry >= MAX_RETRIES) throw { kind: 'RateLimit', message: 'Rate limited', retryIn: ra } as ClientError
    const wait = Math.max(ra * 1000, expBackoff(250, retry))
    await sleep(wait)
    return coreFetch(path, { method, body, retry: retry + 1 })
  }
  if (res.status === 403) {
    // Permission/device issues; set short cooldown to avoid storms
    cooldowns.set(key, Date.now() + 2500)
    throw { kind: 'Unknown', message: 'Forbidden (permission/device)', status: 403 } as any
  }
  if (res.status === 404) {
    throw { kind: 'Unknown', message: 'No active player', status: 404 } as any
  }

  if (res.status === 204) return null as any
  if (!res.ok) {
    const text = await res.text().catch(()=> '')
  throw { kind: 'Unknown', message: `${res.status} ${res.statusText}${text?`: ${text}`:''}` } as ClientError
  }

  try {
    const json = await res.json()
    return json as T
  } catch {
    return null as any
  }
}

// Public API wrappers
export const SpotifyClient = {
  me: () => coreFetch<MeProfile>('/me'),
  devices: () => coreFetch<DevicesResponse>('/me/player/devices'),
  playback: () => coreFetch<PlaybackState>('/me/player'),
  play: (uris?: string[]) => coreFetch<void>('/me/player/play', { method: 'PUT', body: uris ? { uris } : {} }),
  pause: () => coreFetch<void>('/me/player/pause', { method: 'PUT' }),
  seek: (ms: number) => coreFetch<void>(`/me/player/seek?position_ms=${ms}`, { method: 'PUT' }),
  setVolume: (v: number) => coreFetch<void>(`/me/player/volume?volume_percent=${Math.round(v*100)}`, { method: 'PUT' }),
  // legacy generic transfer (kept but prefer dedicated below)
  transferPlayback: (deviceId: string, play=false) => coreFetch<void>('/me/player', { method: 'PUT', body: { device_ids: [deviceId], play } }),
  queue: () => coreFetch<any>('/me/player/queue'),
}

export function isClientError(e: any): e is ClientError { return e && typeof e === 'object' && 'kind' in e }

// New explicit helpers per spec
export async function transferPlayback({ deviceId, play = true }: { deviceId: string; play?: boolean }) {
  const token = await getAccessToken(); if (!token) throw { kind: 'Auth', message: 'No token' } as ClientError
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [deviceId], play })
  })
  if (res.status === 204 || res.status === 202) return { ok: true as const, status: res.status }
  if (res.status === 403) throw { kind: 'Unknown', message: 'Spotify Premium required.', status: res.status }
  if (res.status === 404) throw { kind: 'Unknown', message: 'No active device found.', status: res.status }
  throw { kind: 'Unknown', message: `Transfer failed ${res.status}`, status: res.status, text: await res.text().catch(()=> '') }
}

export async function listDevices() {
  const d = await SpotifyClient.devices().catch(()=> null)
  return d?.devices || []
}

// Specialized helper: currently-playing with ETag support + 429 + 401 refresh + 403 cooldown
export async function getCurrentlyPlayingETagged() {
  const path = '/me/player/currently-playing'
  const key = `GET ${path}`
  const until = cooldowns.get(key) || 0
  if (Date.now() < until) return { status: 204 as const, body: null, unchanged: true }
  let token = await getAccessToken()
  if (!token) throw { kind: 'Auth', message: 'Not authenticated' } as ClientError
  const make = async (t: string) => {
    const headers: Record<string,string> = { 'Authorization': `Bearer ${t}` }
    const et = etags.get(path)?.etag
    if (et) headers['If-None-Match'] = et
    return fetch(`${API}${path}`, { headers })
  }
  let res = await make(token)
  if (res.status === 401) { token = await getAccessToken() as any; if (!token) throw { kind: 'Auth', message: 'Unauthorized' } as ClientError; res = await make(token) }
  if (res.status === 429) {
    const ra = Number(res.headers.get('Retry-After') || '1')
    await sleep(Math.max(ra*1000, 300))
    res = await make(token)
  }
  if (res.status === 403) { cooldowns.set(key, Date.now() + 2500); return { status: 204 as const, body: null, unchanged: true } }
  if (res.status === 304) {
    const cached = etags.get(path)?.body ?? null
    return { status: 304 as const, body: cached, unchanged: true }
  }
  if (res.status === 204) return { status: 204 as const, body: null, unchanged: false }
  if (!res.ok) return { status: res.status as any, body: null, unchanged: false }
  const body = await res.json().catch(()=> null)
  const et = res.headers.get('ETag') || res.headers.get('Etag') || res.headers.get('etag')
  if (et) etags.set(path, { etag: et, body })
  return { status: 200 as const, body, unchanged: false }
}

// Debounced mutation: set volume (PUT /me/player/volume)
export function setVolumeDebounced(v: number, wait = 150) {
  const key = 'PUT /me/player/volume'
  let entry = debouncers.get(key)
  if (!entry) { entry = { t: null, lastArgs: null }; debouncers.set(key, entry) }
  entry.lastArgs = { v }
  if (entry.t) clearTimeout(entry.t)
  entry.t = setTimeout(async () => {
    const vol = Math.round((entry!.lastArgs.v as number) * 100)
    try { await SpotifyClient.setVolume(vol/100) } catch { /* swallow */ }
  }, wait)
}
