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
visualizer: 'bars' | 'wave' | 'particles'
	// user profile and library
	profile: { displayName?: string; avatarUrl?: string } | null
	playlists: any[]
 authError: string | null
	sidebarCollapsed: boolean
	setSidebarCollapsed: (b: boolean) => void
setVisualizer: (v: PlayerState['visualizer']) => void
setTokens: (a: string, r: string | null) => void
setAuthed: (b: boolean) => void
	setProfile: (p: PlayerState['profile']) => void
	setPlaylists: (pl: any[]) => void
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
visualizer: 'bars',
profile: null,
playlists: [],
sidebarCollapsed: (() => {
	if (typeof localStorage === 'undefined') return true
	try { const v = localStorage.getItem('sidebarCollapsed'); return v ? JSON.parse(v) : true } catch { return true }
})(),
 authError: null,
setVisualizer: (v) => set({ visualizer: v }),
setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
setAuthed: (b) => set({ isAuthed: b }),
setProfile: (p) => set({ profile: p }),
setPlaylists: (pl) => set({ playlists: pl }),
setAuthError: (s) => set({ authError: s }),
setSidebarCollapsed: (b) => { set({ sidebarCollapsed: b }); try { localStorage.setItem('sidebarCollapsed', JSON.stringify(b)) } catch {} },
login: async () => { try { await authorize(); set({ authError: null }) } catch (err: any) { set({ authError: String(err?.message || err) }); } },
logout: async () => { await doLogout(); disconnectPlayer(); set({ isAuthed: false, accessToken: null, refreshToken: null, deviceId: null, isPlaying: false, profile: null, playlists: [] }); },
setDeviceId: (id) => set({ deviceId: id }),
setIsPlaying: (b) => set({ isPlaying: b }),
setVolume: (v) => set({ volume: v })
})))