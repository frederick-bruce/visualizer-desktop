import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/player'
import { getAccessToken } from './spotifyAuth'

export function disconnectPlayer() { (window as any)._player?.disconnect?.() }

function loadSdk(): Promise<void> {
	return new Promise(resolve => {
		if ((window as any).Spotify) return resolve()
		const script = document.createElement('script')
		script.src = 'https://sdk.scdn.co/spotify-player.js'
		script.async = true
		document.body.appendChild(script)
		;(window as any).onSpotifyWebPlaybackSDKReady = () => resolve()
	})
}

let initStarted = false

export function useSpotifyPlayer() {
	const { accessToken, volume } = usePlayerStore()
	const reconnectAttempts = useRef(0)

	useEffect(() => {
		if (!accessToken || initStarted) return
		initStarted = true
		let cancelled = false

		const setup = async () => {
			try {
				await loadSdk()
				if (cancelled) return
				const token = await getAccessToken()
				if (!token) return
				const player = new (window as any).Spotify.Player({
					name: 'Freddy Visualizer',
					getOAuthToken: (cb: (t: string) => void) => cb(token),
					volume: volume
				})
				;(window as any)._player = player

				const store = () => usePlayerStore.getState()

				player.addListener('ready', ({ device_id }: any) => {
					store().setDeviceId(device_id)
					reconnectAttempts.current = 0
					// Transfer but don't autoplay
					fetch('https://api.spotify.com/v1/me/player', { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ device_ids: [device_id], play: false }) }).catch(()=>{})
				})

				player.addListener('not_ready', ({ device_id }: any) => {
					const st = store()
					if (st.deviceId === device_id) st.setDeviceId(null)
					// attempt reconnection with capped backoff
					reconnectAttempts.current += 1
					const attempt = reconnectAttempts.current
					const wait = Math.min(10_000, 500 * 2 ** (attempt-1)) + Math.random()*200
					setTimeout(() => {
						if (!(window as any)._player) return
						;(window as any)._player.connect()
					}, wait)
				})

				player.addListener('player_state_changed', (state: any) => {
					try {
						if (!state) return
						const st = store()
						st.setIsPlaying(!state.paused)
						const current = state.track_window?.current_track
						if (current) {
							st.track = { id: current.id, name: current.name, artists: current.artists?.map((a:any)=>a.name).join(', '), albumArt: current.album?.images?.[0]?.url }
							st.durationMs = current.duration_ms
							st.progressMs = state.position
							st.lastProgressUpdateAt = performance.now()
							// Very rough buffered estimate (Spotify Web Playback SDK does not expose; leave room for future network-based heuristic)
							const bufferedLead = 12_000 // optimistic 12s lookahead
							st.bufferedMs = Math.min(state.position + bufferedLead, current.duration_ms)
						}
					} catch (e) {
						console.warn('state change error', e)
					}
				})

				player.addListener('initialization_error', (e: any) => console.error('init err', e))
				player.addListener('authentication_error', (e: any) => console.error('auth err', e))
				player.addListener('account_error', (e: any) => console.error('account err', e))
				player.addListener('playback_error', (e: any) => console.error('playback err', e))

				player.connect()
			} catch (e) {
				console.error('Player setup failed', e)
			}
		}
		setup()
		return () => { cancelled = true }
	}, [accessToken])

	// Reflect volume store -> SDK
	useEffect(() => {
		const p: any = (window as any)._player
		if (p?.setVolume) p.setVolume(volume).catch(()=>{})
	}, [volume])

	// Cleanup on unload
	useEffect(() => {
		const onUnload = () => { try { (window as any)._player?.disconnect?.() } catch {} }
		window.addEventListener('beforeunload', onUnload)
		return () => window.removeEventListener('beforeunload', onUnload)
	}, [])

	return null
}