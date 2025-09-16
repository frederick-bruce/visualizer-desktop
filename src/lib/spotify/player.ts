import { getValidToken, withSpotifyAuth } from '@/lib/spotify/auth'

// Minimal SDK types to avoid any
export interface SdkTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: { images?: { url: string; height?: number; width?: number }[] }
  duration_ms?: number
}
export interface SdkPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track?: SdkTrack
  }
}

export interface SpotifyPlayerOptions {
  name: string
  volume?: number
}

export interface SpotifyPlayer {
  addListener(event: 'ready', cb: (e: { device_id: string }) => void): void
  addListener(event: 'not_ready', cb: (e: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (s: SdkPlayerState | null) => void): void
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', cb: (e: { message: string }) => void): void
  removeListener?(event: string): void
  connect(): Promise<boolean>
  disconnect(): void
  getVolume?(): Promise<number>
  setVolume?(v: number): Promise<void>
}

export interface SpotifyGlobal { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SpotifyPlayer }

declare global {
  interface Window {
    Spotify?: SpotifyGlobal
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

// Tiny RX-like store
export interface PlayerRxState {
  paused: boolean
  position: number
  duration: number
  track: { id: string; name: string; artists: string; albumArt?: string } | null
  volume: number
  shuffle: boolean
  repeatMode: 'off' | 'context' | 'track'
}

type Unsubscribe = () => void
function createStore<T extends object>(initial: T) {
  let state = initial
  const subs = new Set<(s: T) => void>()
  return {
    get: () => state,
    set: (patch: Partial<T>) => { state = { ...state, ...patch }; subs.forEach(cb => cb(state)) },
    subscribe: (cb: (s: T) => void): Unsubscribe => { subs.add(cb); return () => subs.delete(cb) }
  }
}

export const playerStore = createStore<PlayerRxState>({
  paused: true,
  position: 0,
  duration: 0,
  track: null,
  volume: 0.6,
  shuffle: false,
  repeatMode: 'off'
})

const API = withSpotifyAuth('https://api.spotify.com/v1')

let sdkLoadPromise: Promise<void> | null = null
function loadSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise<void>((resolve) => {
    if (window.Spotify) return resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
  })
  return sdkLoadPromise
}

let reconnectAttempts = 0
const deviceLostListeners = new Set<(deviceId: string) => void>()
export function onDeviceLost(cb: (deviceId: string) => void): Unsubscribe { deviceLostListeners.add(cb); return () => deviceLostListeners.delete(cb) }

export interface InitResult {
  player: SpotifyPlayer
  deviceId: string
  readyPromise: Promise<string>
}

let singleton: { player: SpotifyPlayer; deviceId: string; readyPromise: Promise<string> } | null = null
let lastInitOpts: SpotifyPlayerOptions | null = null

// Simple toast/event channel for UI
export type ToastLevel = 'info' | 'warn' | 'error'
export interface ToastEvent { level: ToastLevel; message: string }
const toastListeners = new Set<(t: ToastEvent) => void>()
export function onPlayerToast(cb: (t: ToastEvent) => void): Unsubscribe { toastListeners.add(cb); return () => toastListeners.delete(cb) }
function emitToast(level: ToastLevel, message: string) { toastListeners.forEach(cb => cb({ level, message })) }

export async function initPlayer(opts: SpotifyPlayerOptions): Promise<InitResult> {
  if (singleton) return singleton
  await loadSdk()
  const name = opts.name
  const volume = opts.volume ?? 0.6
  lastInitOpts = opts
  const player = new window.Spotify!.Player({
    name,
    getOAuthToken: (cb) => { getValidToken().then(t => t && cb(t)) },
    volume
  })

  let resolveReady!: (id: string) => void
  const readyPromise = new Promise<string>(res => { resolveReady = res })
  let deviceId = ''

  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id
    resolveReady(device_id)
    reconnectAttempts = 0
    // Immediately transfer and play
    transferPlaybackTo(device_id, true).catch(() => {/* ignore */})
    // Also poll shuffle/repeat once
    updatePlaybackFlags().catch(() => {/* ignore */})
  })

  player.addListener('not_ready', ({ device_id }) => {
    deviceLostListeners.forEach(cb => cb(device_id))
    // backoff reconnect
    reconnectAttempts += 1
    const delay = Math.min(10_000, 500 * 2 ** (reconnectAttempts - 1)) + Math.random() * 200
    setTimeout(() => { player.connect().catch(()=>{}) }, delay)
  })

  player.addListener('player_state_changed', (state) => {
    if (!state) return
    const current = state.track_window?.current_track
    const duration = state.duration || current?.duration_ms || 0
    playerStore.set({
      paused: state.paused,
      position: state.position,
      duration,
      track: current ? { id: current.id, name: current.name, artists: (current.artists||[]).map(a => a.name).join(', '), albumArt: current.album?.images?.[0]?.url } : null
    })
    // Occasionally poll flags to keep in sync
    updatePlaybackFlags().catch(()=>{})
  })

  player.addListener('initialization_error', (e) => console.error('init error', e))
  player.addListener('authentication_error', (e) => console.error('auth error', e))
  player.addListener('account_error', (e) => console.error('account error', e))
  player.addListener('playback_error', (e) => console.error('playback error', e))

  await player.connect()

  singleton = { player, deviceId, readyPromise: readyPromise! }
  return singleton
}

async function updatePlaybackFlags() {
  try {
    const me = await API<any>('/me/player')
    if (me) {
      playerStore.set({ shuffle: !!me.shuffle_state, repeatMode: (me.repeat_state as PlayerRxState['repeatMode']) })
      if (typeof me.device?.volume_percent === 'number' && playerStore.get().volume !== me.device.volume_percent/100) {
        playerStore.set({ volume: me.device.volume_percent/100 })
      }
    }
  } catch {}
}

export async function transferPlaybackTo(deviceId: string, play: boolean = true) {
  await API<void>('/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [deviceId], play }) })
}

export async function listDevices(): Promise<{ id: string; is_active: boolean }[]> {
  const j = await API<{ devices: { id: string; is_active: boolean }[] }>('/me/player/devices')
  return j.devices || []
}

export async function ensureActiveDevice(): Promise<boolean> {
  if (!singleton) return false
  const devices = await listDevices()
  const ours = devices.find(d => d.id === singleton!.deviceId)
  if (ours?.is_active) return true
  try { await transferPlaybackTo(singleton!.deviceId, true); return true } catch { return false }
}

async function reinitPlayer(): Promise<void> {
  if (!lastInitOpts) return
  try { singleton?.player.disconnect() } catch {}
  singleton = null
  await initPlayer(lastInitOpts)
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

export async function recoverActiveDevice(maxDurationMs: number = 30_000): Promise<boolean> {
  const start = performance.now()
  let backoff = 100
  let askedUserOnce = false
  while (performance.now() - start < maxDurationMs) {
    try {
      if (!singleton) {
        if (!lastInitOpts) { emitToast('error', 'Spotify player not initialized'); return false }
        emitToast('info', 'Reinitializing Spotify player…')
        await reinitPlayer()
      }
      const devices = await listDevices()
      const ours = devices.find(d => d.id === singleton!.deviceId)
      if (!ours) {
        emitToast('warn', 'Device not listed, re-initializing SDK…')
        await reinitPlayer()
      } else if (!ours.is_active) {
        try {
          await transferPlaybackTo(singleton!.deviceId, true)
          emitToast('info', 'Transferred playback to Freddy Visualizer')
          return true
        } catch (e: any) {
          const status = e?.status as number | undefined
          if (status === 403 || status === 404) {
            if (!askedUserOnce) {
              askedUserOnce = true
              emitToast('warn', 'Open Spotify and press Play once, then return here. Retrying activation…')
            }
          } else {
            emitToast('warn', 'Transfer failed, will retry…')
          }
        }
      } else {
        return true
      }
    } catch {
      // ignore and backoff
    }
    await sleep(backoff)
    backoff = Math.min(5000, Math.round(backoff * 2))
  }
  emitToast('error', 'Could not activate Freddy Visualizer after 30s. Please press Play in Spotify, then try again.')
  return false
}
