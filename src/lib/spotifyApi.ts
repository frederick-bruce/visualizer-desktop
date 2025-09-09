import { getAccessToken } from './spotifyAuth'


const API = 'https://api.spotify.com/v1'


async function authed<T>(path: string, init?: RequestInit): Promise<T> {
	// Perform an authed request, retrying once if the token appears invalid
	let token = await getAccessToken()
	if (!token) throw new Error('No token')

	const makeRequest = async (t: string) => {
		const headers: Record<string, string> = {
			'Authorization': `Bearer ${t}`,
			...(init?.headers as Record<string, string> || {})
		}
		// Only set Content-Type when sending a body
		if (init?.body) headers['Content-Type'] = headers['Content-Type'] || 'application/json'

		const res = await fetch(`${API}${path}`, {
			...init,
			headers,
		})
		return res
	}

	let res = await makeRequest(token)

	// If unauthorized, attempt to refresh token once and retry
	if (res.status === 401) {
		token = await getAccessToken()
		if (!token) throw new Error('No token after refresh')
		res = await makeRequest(token)
	}

	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

	// Some Spotify endpoints return 204 No Content (e.g., play/pause). Return null for those.
	if (res.status === 204) return null as any

	// Attempt to parse JSON. If body is empty, return null.
	const text = await res.text()
	if (!text) return null as any
	return JSON.parse(text) as T
}


export const Me = {
profile: () => authed('/me'),
devices: () => authed('/me/player/devices'),
playbackState: () => authed('/me/player'),
recentlyPlayed: () => authed('/me/player/recently-played?limit=20'),
topPlaylists: (limit = 5) => authed(`/me/playlists?limit=${limit}`)
}


export const Player = {
transfer: (deviceId: string) => authed('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) }),
play: (uris?: string[]) => authed('/me/player/play', { method: 'PUT', body: JSON.stringify(uris ? { uris } : {}) }),
pause: () => authed('/me/player/pause', { method: 'PUT' }),
next: () => authed('/me/player/next', { method: 'POST' }),
prev: () => authed('/me/player/previous', { method: 'POST' }),
seek: (ms: number) => authed(`/me/player/seek?position_ms=${ms}`, { method: 'PUT' }),
volume: (v: number) => authed(`/me/player/volume?volume_percent=${Math.round(v * 100)}`, { method: 'PUT' }),
}


export const Analysis = {
audioFeatures: (id: string) => authed(`/audio-features/${id}`),
audioAnalysis: (id: string) => authed(`/audio-analysis/${id}`),
}