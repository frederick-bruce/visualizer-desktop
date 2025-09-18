import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/player'
import { getAccessToken } from './spotifyAuth'
import { transferPlayback, listDevices, SpotifyClient } from './spotifyClient'

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

let globalRafStarted = false

export function useSpotifyPlayer() {
	const { accessToken, volume } = usePlayerStore()
	const reconnectAttempts = useRef(0)
	// Start single global RAF loop once
	useEffect(() => {
		if (globalRafStarted) return
		globalRafStarted = true
		let raf: number
		const loop = (ts: number) => {
			try { usePlayerStore.getState().tick(ts) } catch {}
			raf = requestAnimationFrame(loop)
		}
		raf = requestAnimationFrame(loop)
		return () => { cancelAnimationFrame(raf); globalRafStarted = false }
	}, [])

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

				player.addListener('ready', async ({ device_id }: any) => {
					store().setSdkReady(device_id)
					reconnectAttempts.current = 0
					try {
						const res = await transferPlayback({ deviceId: device_id, play: false })
						usePlayerStore.setState({ lastTransferStatus: res.status })
					} catch (e: any) {
						console.warn('initial transfer error', e)
					}
					// refresh devices after claiming
					store().refreshDevices()
				})

				player.addListener('not_ready', ({ device_id }: any) => {
					const st = store()
					if (st.sdkDeviceId === device_id) st.setActiveDevice(null)
					// attempt reconnection with capped backoff
					reconnectAttempts.current += 1
					const attempt = reconnectAttempts.current
					const wait = Math.min(10_000, 500 * 2 ** (attempt-1)) + Math.random()*200
					setTimeout(() => { (window as any)._player?.connect?.() }, wait)
				})

					player.addListener('player_state_changed', async (state: any) => {
					try {
						if (!state) return
						const st = store()
						const current = state.track_window?.current_track
						const duration = state.duration || current?.duration_ms || st.durationMs || 0
						if (current) {
							usePlayerStore.setState({
								track: {
									id: current.id,
									name: current.name,
									artists: current.artists?.map((a:any)=>a.name).join(', '),
									albumArt: current.album?.images?.[0]?.url
								}
							})
						}
						// sync core playback fields
						st.setFromSdk({ isPlaying: !state.paused, progressMs: state.position, durationMs: duration })
						// buffered heuristic
						usePlayerStore.setState({ bufferedMs: Math.min(state.position + 12_000, duration) })
						// Churn detection: if we have an sdkDeviceId but devices list shows not active, attempt silent transfer once
						const s = usePlayerStore.getState()
						if (s.sdkDeviceId && s.activeDeviceId !== s.sdkDeviceId) {
							const list = await listDevices()
							const active = list.find((d:any)=>d.is_active)
							if (!active || active.id !== s.sdkDeviceId) {
								try { const r = await transferPlayback({ deviceId: s.sdkDeviceId, play: !state.paused }); usePlayerStore.setState({ lastTransferStatus: r.status }) } catch {}
								usePlayerStore.getState().refreshDevices()
							}
						}
					} catch (e) { console.warn('state change error', e) }
				})

				player.addListener('initialization_error', (e: any) => {
					console.error('init err', e)
					try { usePlayerStore.getState().setAuthError?.('Initialization error. Please reload and ensure Spotify is reachable.') } catch {}
				})
				player.addListener('authentication_error', (e: any) => {
					console.error('auth err', e)
					try { usePlayerStore.getState().setAuthError?.('Authentication error. Please reconnect your Spotify account.') } catch {}
				})
				player.addListener('account_error', (e: any) => {
					console.error('account err', e)
					// Web Playback SDK requires Premium
					try { usePlayerStore.getState().setAuthError?.('Account error. Spotify Premium is required for playback in this app.') } catch {}
				})
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

		// syncParity: subscribe to fine-grained SDK events; every 5s pull /me/player only if stale and diverged
		useEffect(() => {
			if (!accessToken) return
			let stopped = false
			const lastEventRef = { t: performance.now() }
			// Wrap setFromSdk to mark last SDK event arrival
			const orig = usePlayerStore.getState().setFromSdk
			usePlayerStore.getState().setFromSdk = (p: any) => { lastEventRef.t = performance.now(); orig(p) }
			const tick = async () => {
				if (stopped) return
				const s = usePlayerStore.getState()
				const staleFor = performance.now() - lastEventRef.t
				const isPlaying = s.isPlaying
				// Only consider parity fetch when playing and events are stale (>4.5s)
				if (isPlaying && staleFor > 4500) {
						try {
							const remote = await SpotifyClient.playback()
							if (remote && remote.item) {
							const remoteId = remote.item.id
							const localId = s.track?.id
							const remoteMs = remote.progress_ms || 0
							const localMs = s.progressMs || 0
							const drift = Math.abs(remoteMs - localMs)
							if (remoteId !== localId || drift > 1000) {
								usePlayerStore.getState().setFromSdk({ isPlaying: !!remote.is_playing, progressMs: remoteMs, durationMs: remote.item.duration_ms || 0 })
							}
								// Always mirror track metadata so UI has art/title even when events are stale
								try {
									const itm: any = remote.item as any
									usePlayerStore.setState({
										track: {
											id: itm.id,
											name: itm.name,
											artists: (itm.artists || []).map((a:any)=>a.name).join(', '),
											albumArt: itm.album?.images?.[0]?.url
										}
									})
								} catch {}
						}
					} catch {}
				}
				setTimeout(tick, 5000)
			}
			tick()
			return () => { stopped = true; usePlayerStore.getState().setFromSdk = orig }
		}, [accessToken])

	// Device activation polling: after sdk ready but not active, poll /me/player until active or timeout
	useEffect(() => {
		if (!accessToken) return
		let cancelled = false
		const run = async () => {
			const start = performance.now()
			while (!cancelled) {
				const s = usePlayerStore.getState()
				if (s.activeDeviceId === s.sdkDeviceId) break
				if (performance.now() - start > 20_000) break
				await s.refreshDevices()
				if (s.activeDeviceId === s.sdkDeviceId) break
				await new Promise(r => setTimeout(r, 3000 + Math.random()*1500))
			}
		}
		run()
		return () => { cancelled = true }
	}, [accessToken])

	// Cleanup on unload
	useEffect(() => {
		const onUnload = () => { try { (window as any)._player?.disconnect?.() } catch {} }
		window.addEventListener('beforeunload', onUnload)
		return () => window.removeEventListener('beforeunload', onUnload)
	}, [])

	return null
}