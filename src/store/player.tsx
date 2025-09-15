import { create } from 'zustand'
import { initiateAuth, logout as authLogout } from '@/lib/spotifyAuth'
import { disconnectPlayer } from '@/lib/useSpotifyPlayer'
import { getAccessToken } from '@/lib/spotifyAuth'


interface PlayerState {
isAuthed: boolean
accessToken: string | null
refreshToken: string | null
deviceId: string | null // legacy/current selected device id (may be sdk device)
sdkDeviceId?: string | null
activeDeviceId?: string | null
lastTransferStatus?: number | null
isPlaying: boolean
	volume: number
	bufferedMs?: number
	lastProgressUpdateAt?: number // performance.now() timestamp when progressMs snapshot taken
	prevVolume?: number
	mute: () => void
	unmute: () => void
	progressMs?: number
	durationMs?: number
	track?: { id?: string; name?: string; artists?: string; albumArt?: string }
	contextUri?: string | null
visualizer: 'bars' | 'wave' | 'particles'
	renderMode: 'raf' | 'max'
	vizSettings: {
		sensitivity: number // multiplier for intensity
		colorVariance: number // 0..1 (future use)
		trail: number // 0..1 controls persistence
		blur: number // 0..1 (future)
		beatSensitivity?: number // 0.0 - 2.0
		releaseMs?: number // 100 - 400
		motionScale?: number // 0 - 2
		tempoMultiplier?: number // 0.5,1,2
	}
	presets: { id: string; name: string; visualizer: PlayerState['visualizer']; settings: PlayerState['vizSettings'] }[]
	// user profile and library
	profile: { displayName?: string; avatarUrl?: string } | null
	playlists: any[]
	devices?: any[]
	lowPowerMode: boolean
	isLowEnd: boolean
	reduceMotion?: boolean
	styleMode?: 'default' | 'nostalgia'
 authError: string | null
setVisualizer: (v: PlayerState['visualizer']) => void
setRenderMode: (m: PlayerState['renderMode']) => void
	setVizSettings: (p: Partial<PlayerState['vizSettings']>) => void
	createPreset: (name: string) => void
	deletePreset: (id: string) => void
	applyPreset: (id: string) => void
setTokens: (a: string, r: string | null) => void
setAuthed: (b: boolean) => void
	setProfile: (p: PlayerState['profile']) => void
	setPlaylists: (pl: any[]) => void
	setDevices?: (d: any[]) => void
	setLowPowerMode: (b: boolean) => void
	setReduceMotion: (b: boolean) => void
	setStyleMode: (m: 'default' | 'nostalgia') => void
		setAuthError: (s: string | null) => void
login: () => void
logout: () => void
setDeviceId: (id: string | null) => void
setSdkReady: (id: string) => void
setActiveDevice: (id: string | null) => void
refreshDevices: () => Promise<void>
setIsPlaying: (b: boolean) => void
setVolume: (v: number) => void
	// Unified controls
	play: (uri?: string) => Promise<void>
	pause: () => Promise<void>
	toggle: () => Promise<void>
	next: () => Promise<void>
	prev: () => Promise<void>
	seek: (ms: number) => Promise<void>
	setPlayerVolume: (v: number) => Promise<void>
	queue: (uri: string) => Promise<void>
	setFromSdk: (s: { isPlaying: boolean; progressMs: number; durationMs: number }) => void
	tick: (now: number) => void
}


// Simplified (devtools middleware removed for Zustand v5 compatibility)
export const usePlayerStore = create<PlayerState>((set, get) => ({
isAuthed: false,
accessToken: null,
refreshToken: null,
deviceId: null,
sdkDeviceId: null,
activeDeviceId: null,
lastTransferStatus: null,
isPlaying: false,
volume: (() => { try { const v = localStorage.getItem('volume'); if (v!=null) return JSON.parse(v) } catch {} return 0.6 })(),
	prevVolume: 0.6,
	mute: () => set(s => ({ prevVolume: s.volume || 0.6, volume: 0 })),
	unmute: () => set(s => ({ volume: s.prevVolume ?? 0.6 })),
visualizer: 'bars',
renderMode: 'raf',
	vizSettings: (() => {
		const base = { sensitivity: 1, colorVariance: 0.3, trail: 0.5, blur: 0.0, beatSensitivity: 1, releaseMs: 250, motionScale: 1, tempoMultiplier: 1 }
		if (typeof localStorage === 'undefined') return base
		try { const raw = localStorage.getItem('vizSettings'); if (raw) return { ...base, ...JSON.parse(raw) } } catch {}
		return base
	})(),
presets: (() => {
	if (typeof localStorage === 'undefined') return []
	try { const raw = localStorage.getItem('vizPresets'); if (raw) return JSON.parse(raw) } catch {}
	// defaults
	return [
		{ id: 'classic-wave', name: 'Classic Wave', visualizer: 'wave', settings: { sensitivity: 1, colorVariance: 0.2, trail: 0.4, blur: 0 } },
		{ id: 'emerald-bars', name: 'Emerald Bars', visualizer: 'bars', settings: { sensitivity: 1.2, colorVariance: 0.35, trail: 0.3, blur: 0 } },
		{ id: 'nebula-particles', name: 'Nebula Particles', visualizer: 'particles', settings: { sensitivity: 1.4, colorVariance: 0.5, trail: 0.7, blur: 0.15 } },
		{ id: 'spectrum-mix', name: 'Spectrum Mix', visualizer: 'bars', settings: { sensitivity: 1.1, colorVariance: 0.6, trail: 0.5, blur: 0.05 } },
	]
})(),
profile: null,
playlists: [],
devices: [],
isLowEnd: (() => {
	if (typeof navigator === 'undefined') return false
	const cores = (navigator.hardwareConcurrency || 4)
	// @ts-ignore
	const mem = (navigator as any).deviceMemory || 8
	return cores <= 2 || mem < 6
})(),
lowPowerMode: (() => {
	if (typeof localStorage === 'undefined') return false
	try { const v = localStorage.getItem('lowPowerMode'); if (v != null) return JSON.parse(v) } catch {}
	// auto-enable if low-end detected
	try {
		const cores = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4
		// @ts-ignore
		const mem = (typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : 8) || 8
		return cores <= 2 || mem < 6
	} catch {}
	return false
})(),
reduceMotion: (() => {
	if (typeof localStorage === 'undefined') return false
	try { const v = localStorage.getItem('reduceMotion'); if (v!=null) return JSON.parse(v) } catch {}
	if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
	return false
})(),
styleMode: (() => {
	if (typeof localStorage === 'undefined') return 'default'
	try { const v = localStorage.getItem('styleMode'); if (v === 'nostalgia') return 'nostalgia' } catch {}
	return 'default'
})(),
 authError: null,
setVisualizer: (v) => set({ visualizer: v }),
setRenderMode: (m) => set({ renderMode: m }),
setVizSettings: (p) => set(s => {
	const next = { ...s.vizSettings, ...p }
	try { localStorage.setItem('vizSettings', JSON.stringify(next)) } catch {}
	return { vizSettings: next }
}),
createPreset: (name) => set(s => {
	const id = name.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Math.random().toString(36).slice(2,6)
	const preset = { id, name, visualizer: s.visualizer, settings: s.vizSettings }
	const list = [...s.presets, preset]
	try { localStorage.setItem('vizPresets', JSON.stringify(list)) } catch {}
	return { presets: list }
}),
deletePreset: (id) => set(s => {
	const list = s.presets.filter(p => p.id !== id)
	try { localStorage.setItem('vizPresets', JSON.stringify(list)) } catch {}
	return { presets: list }
}),
applyPreset: (id) => set(s => {
	const p = s.presets.find(p => p.id === id)
	if (!p) return {}
	try { localStorage.setItem('vizSettings', JSON.stringify(p.settings)) } catch {}
	return { visualizer: p.visualizer, vizSettings: p.settings }
}),
setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
setAuthed: (b) => set({ isAuthed: b }),
setProfile: (p) => set({ profile: p }),
setPlaylists: (pl) => set({ playlists: pl }),
setDevices: (d) => set({ devices: d }),
setLowPowerMode: (b) => { set({ lowPowerMode: b }); try { localStorage.setItem('lowPowerMode', JSON.stringify(b)) } catch {} },
setReduceMotion: (b) => { set({ reduceMotion: b }); try { localStorage.setItem('reduceMotion', JSON.stringify(b)) } catch {} },
setStyleMode: (m) => { set({ styleMode: m }); try { localStorage.setItem('styleMode', m) } catch {} },
setAuthError: (s) => set({ authError: s }),
login: async () => { try { await initiateAuth(); set({ authError: null }) } catch (err: any) { set({ authError: String(err?.message || err) }); } },
logout: async () => { await authLogout(); disconnectPlayer(); set({ isAuthed: false, accessToken: null, refreshToken: null, deviceId: null, isPlaying: false, profile: null, playlists: [] }); },
setDeviceId: (id) => set({ deviceId: id }),
setSdkReady: (id) => set({ sdkDeviceId: id, deviceId: id }),
setActiveDevice: (id) => set({ activeDeviceId: id }),
refreshDevices: async () => {
	try {
		const token = await getAccessToken(); if (!token) return
		const r = await fetch('https://api.spotify.com/v1/me/player/devices', { headers: { Authorization: `Bearer ${token}` } })
		if (!r.ok) return
		const j = await r.json()
		const list = j.devices || []
		set({ devices: list })
		const sdkId = get().sdkDeviceId
		const active = list.find((d: any) => d.is_active)
		set({ activeDeviceId: active?.id || null })
		// If SDK is active but activeDeviceId not flagged yet
		if (!active && sdkId) {
			// We'll consider ourselves active if player.getCurrentState() not null (handled elsewhere)
		}
	} catch (e) { /* swallow */ }
},
setIsPlaying: (b) => set({ isPlaying: b }),
setVolume: (v) => { set({ volume: v }); try { localStorage.setItem('volume', JSON.stringify(v)) } catch {} }
	,
	play: async (uri?: string) => {
		const state = get()
		try {
			const token = await getAccessToken()
			if (!token) throw new Error('No token')
			// If SDK player present and no specific URI, just resume
			const p: any = (window as any)._player
			if (uri) {
				await fetch(`https://api.spotify.com/v1/me/player/play`, {
					method: 'PUT',
					headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ uris: [uri] })
				})
			} else if (p?.resume) {
				await p.resume()
			} else {
				await fetch(`https://api.spotify.com/v1/me/player/play`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } })
			}
			set({ isPlaying: true })
		} catch (e) { console.warn('play error', e) }
	},
	pause: async () => {
		const token = await getAccessToken()
		const p: any = (window as any)._player
		try {
			if (p?.pause) await p.pause(); else await fetch(`https://api.spotify.com/v1/me/player/pause`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } })
			set({ isPlaying: false })
		} catch (e) { console.warn('pause error', e) }
	},
	toggle: async () => {
		const { isPlaying, play, pause } = get()
		if (isPlaying) await pause(); else await play()
	},
	next: async () => {
		const token = await getAccessToken(); try { await fetch(`https://api.spotify.com/v1/me/player/next`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }) } catch(e){ console.warn('next error', e) }
	},
	prev: async () => {
		const token = await getAccessToken(); try { await fetch(`https://api.spotify.com/v1/me/player/previous`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }) } catch(e){ console.warn('prev error', e) }
	},
	seek: async (ms: number) => {
		const token = await getAccessToken(); try { await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${ms}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } }); set({ progressMs: ms }) } catch(e){ console.warn('seek error', e) }
	},
	setPlayerVolume: async (v: number) => {
		set({ volume: v })
		const token = await getAccessToken();
		const p: any = (window as any)._player
		try {
			if (p?.setVolume) await p.setVolume(v)
			else await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(v*100)}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } })
		} catch(e) { console.warn('volume error', e) }
	},
	queue: async (uri: string) => {
		const token = await getAccessToken(); try { await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }) } catch(e){ console.warn('queue error', e) }
	},
	setFromSdk: ({ isPlaying, progressMs, durationMs }) => set(s => {
		const now = performance.now()
		if (typeof s.progressMs === 'number') {
			const drift = Math.abs(progressMs - s.progressMs)
			if (drift < 150) {
				return { isPlaying, durationMs, lastProgressUpdateAt: now }
			}
		}
		return { isPlaying, progressMs, durationMs, lastProgressUpdateAt: now }
	}),
	tick: (now) => set(s => {
		if (!s.isPlaying || s.durationMs == null || s.durationMs <= 0) return {}
		if (typeof s.progressMs !== 'number' || typeof s.lastProgressUpdateAt !== 'number') return {}
		let delta = now - s.lastProgressUpdateAt
		if (delta < 0) delta = 0
		let next = s.progressMs + delta
		if (next >= s.durationMs) {
			next = s.durationMs
			return { progressMs: next, isPlaying: false, lastProgressUpdateAt: now }
		}
		return { progressMs: next, lastProgressUpdateAt: now }
	})
}))