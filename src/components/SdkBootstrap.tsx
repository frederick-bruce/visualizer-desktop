import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/player'
import { getAccessToken } from '@/lib/spotifyAuth'
import { transferPlayback } from '@/lib/spotifyClient'

export default function SdkBootstrap() {
  const isAuthed = usePlayerStore(s => s.isAuthed)
  const initializedRef = useRef(false)

  useEffect(() => {
  if (!isAuthed) return
    if (initializedRef.current) return
    let cancelled = false
    let player: any = null

    const loadSdk = async () => {
      if ((window as any).Spotify) return
      await new Promise<void>(resolve => {
        const script = document.createElement('script')
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        document.body.appendChild(script)
        ;(window as any).onSpotifyWebPlaybackSDKReady = () => resolve()
      })
    }

    const setup = async () => {
      try {
  const token = await getAccessToken()
  if (!token) return
        await loadSdk()
        if (cancelled) return
        const store = usePlayerStore.getState()
        player = (window as any)._player
        if (!player) {
          player = new (window as any).Spotify.Player({
            name: "freddy's visualizer",
            getOAuthToken: async (cb: (t: string) => void) => {
              try { const fresh = await getAccessToken(); if (fresh) return cb(fresh) } catch {}
              cb(token)
            },
            volume: store.volume ?? 0.6,
          })
          ;(window as any)._player = player
        }

        // Attach listeners once
        player.addListener('ready', async ({ device_id }: any) => {
          try { usePlayerStore.getState().setSdkReady(device_id) } catch {}
          try { usePlayerStore.getState().refreshDevices() } catch {}
          setTimeout(() => { try { usePlayerStore.getState().refreshDevices() } catch {} }, 1000)
          setTimeout(() => { try { usePlayerStore.getState().refreshDevices() } catch {} }, 3000)
          try { await transferPlayback({ deviceId: device_id, play: false }) } catch {}
          try { usePlayerStore.getState().refreshDevices() } catch {}
        })
        player.addListener('not_ready', ({ device_id }: any) => {
          const s: any = usePlayerStore.getState()
          if (s.activeDeviceId === device_id) s.setActiveDevice(null)
        })
        player.addListener('initialization_error', () => {
          try { usePlayerStore.getState().setAuthError?.('Initialization error. Please reload and ensure Spotify is reachable.') } catch {}
        })
        player.addListener('authentication_error', () => {
          try { usePlayerStore.getState().setAuthError?.('Authentication error. Please reconnect your Spotify account.') } catch {}
        })
        player.addListener('account_error', () => {
          try { usePlayerStore.getState().setAuthError?.('Spotify Premium is required for playback in this app.') } catch {}
        })
        player.addListener('player_state_changed', (state: any) => {
          try {
            if (!state) return
            const current = state.track_window?.current_track
            const duration = state.duration || current?.duration_ms || 0
            if (current) {
              const prev = usePlayerStore.getState().track || {}
              const nextId = current.id
              const nextName = current.name
              const nextArtists = (current.artists || []).map((a:any)=>a.name).join(', ')
              const nextArt = current.album?.images?.[0]?.url
              const changed = prev.id !== nextId || prev.name !== nextName || prev.artists !== nextArtists || prev.albumArt !== nextArt
              if (changed) {
                usePlayerStore.setState({
                  track: { id: nextId, name: nextName, artists: nextArtists, albumArt: nextArt }
                })
              }
            }
            usePlayerStore.getState().setFromSdk({ isPlaying: !state.paused, progressMs: state.position, durationMs: duration })
          } catch {}
        })

  try { if (isAuthed) await player.connect() } catch {}
        initializedRef.current = true
      } catch {}
    }

    setup()
    return () => {
      cancelled = true
    }
  }, [isAuthed])

  // Reflect volume changes to SDK
  useEffect(() => {
    let prev = usePlayerStore.getState().volume
    const unsub = usePlayerStore.subscribe((s: any) => {
      const v = s.volume
      if (v === prev) return
      prev = v
      try {
        const p: any = (window as any)._player
        if (p?.setVolume) p.setVolume(v)
      } catch {}
    }) as unknown as () => void
    return () => { try { unsub && unsub() } catch {} }
  }, [])

  return null
}
