import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { authorize, logout as doLogout } from '@/lib/spotifyAuth'
import { initPlayer, disconnectPlayer } from '@/lib/useSpotifyPlayer'


interface PlayerState {
isAuthed: boolean
accessToken: string | null
refreshToken: string | null
deviceId: string | null
isPlaying: boolean
volume: number
	prevVolume?: number
	mute: () => void
	unmute: () => void
visualizer: 'bars' | 'wave' | 'particles'
	renderMode: 'raf' | 'max'
	vizSettings: {
		sensitivity: number // multiplier for intensity
		colorVariance: number // 0..1 (future use)
		trail: number // 0..1 controls persistence
		blur: number // 0..1 (future)
	}
	presets: { id: string; name: string; visualizer: PlayerState['visualizer']; settings: PlayerState['vizSettings'] }[]
	// user profile and library
	profile: { displayName?: string; avatarUrl?: string } | null
	playlists: any[]
	devices?: any[]
 authError: string | null
	sidebarCollapsed: boolean
	setSidebarCollapsed: (b: boolean) => void
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
		setAuthError: (s: string | null) => void
login: () => void
logout: () => void
setDeviceId: (id: string | null) => void
setIsPlaying: (b: boolean) => void
setVolume: (v: number) => void
}


export const usePlayerStore = create<PlayerState>()(devtools((set, get) => ({
isAuthed: false,
accessToken: null,
refreshToken: null,
deviceId: null,
isPlaying: false,
volume: 0.6,
	prevVolume: 0.6,
	mute: () => set(s => ({ prevVolume: s.volume || 0.6, volume: 0 })),
	unmute: () => set(s => ({ volume: s.prevVolume ?? 0.6 })),
visualizer: 'bars',
renderMode: 'raf',
vizSettings: (() => {
	if (typeof localStorage === 'undefined') return { sensitivity: 1, colorVariance: 0.3, trail: 0.5, blur: 0.0 }
	try { const raw = localStorage.getItem('vizSettings'); if (raw) return JSON.parse(raw) } catch {}
	return { sensitivity: 1, colorVariance: 0.3, trail: 0.5, blur: 0.0 }
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
sidebarCollapsed: (() => {
	if (typeof localStorage === 'undefined') return true
	try { const v = localStorage.getItem('sidebarCollapsed'); return v ? JSON.parse(v) : true } catch { return true }
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
setAuthError: (s) => set({ authError: s }),
setSidebarCollapsed: (b) => { set({ sidebarCollapsed: b }); try { localStorage.setItem('sidebarCollapsed', JSON.stringify(b)) } catch {} },
login: async () => { try { await authorize(); set({ authError: null }) } catch (err: any) { set({ authError: String(err?.message || err) }); } },
logout: async () => { await doLogout(); disconnectPlayer(); set({ isAuthed: false, accessToken: null, refreshToken: null, deviceId: null, isPlaying: false, profile: null, playlists: [] }); },
setDeviceId: (id) => set({ deviceId: id }),
setIsPlaying: (b) => set({ isPlaying: b }),
setVolume: (v) => set({ volume: v })
})))