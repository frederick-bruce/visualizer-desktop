import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import { Player as API, Me } from './spotifyApi'


// Dynamically load SDK and init player
export function initPlayer() { /* no-op: hook below does actual init */ }
export function disconnectPlayer() { (window as any)._player?.disconnect?.() }


function loadSdk(): Promise<void> {
return new Promise((resolve) => {
if ((window as any).Spotify) return resolve()
const script = document.createElement('script')
script.src = 'https://sdk.scdn.co/spotify-player.js'
script.async = true
document.body.appendChild(script)
;(window as any).onSpotifyWebPlaybackSDKReady = () => resolve()
})
}


export function useSpotifyPlayer() {
const { accessToken, deviceId, volume } = usePlayerStore()
// use getState() inside SDK callbacks to avoid stale closures and accidental shadowing
const storeGet = () => usePlayerStore.getState()
// module-level flag to prevent double-init from multiple hook mounts
let playerInitialized = false


useEffect(() => {
if (!accessToken || playerInitialized) return
playerInitialized = true;


(async () => {
await loadSdk()
const token = accessToken
const player = new (window as any).Spotify.Player({
name: 'Visualizer Player',
getOAuthToken: (cb: (t: string) => void) => cb(token),
volume,
})


;(window as any)._player = player


player.addListener('ready', ({ device_id }: any) => {
	// use current setter from the store to avoid accidental shadowing
	const setDevice = storeGet().setDeviceId
	if (typeof setDevice === 'function') setDevice(device_id)
	// Transfer playback to this device (but don't autostart)
	API.transfer(device_id).catch(console.warn)
})
player.addListener('not_ready', ({ device_id }: any) => {
	try {
		const curDevice = storeGet().deviceId
		const setDevice = storeGet().setDeviceId
		if (curDevice === device_id && typeof setDevice === 'function') setDevice(null)
	} catch (err) {
		console.error('Error handling not_ready', err)
	}
})
player.addListener('player_state_changed', (state: any) => {
	try {
		if (!state) return
		const playing = !state.paused
		const setter = storeGet().setIsPlaying
		if (typeof setter === 'function') {
			setter(playing)
		} else {
			// Defensive: avoid crashing the app and log the issue for debugging
			// setIsPlaying should be a function from the zustand store
			// eslint-disable-next-line no-console
			console.warn('store.setIsPlaying is not a function', setter)
		}
	} catch (err) {
		console.error('Error handling player_state_changed', err)
	}
})


player.connect()
})()
}, [accessToken])


useEffect(() => {
const p = (window as any)._player
if (!p) return
p.setVolume(volume).catch(() => {})
}, [volume])


return null
}