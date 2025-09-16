// Simplified PKCE (redirect back to webview route /callback). No external Tauri plugins.
const CLIENT_ID = String(import.meta.env.VITE_SPOTIFY_CLIENT_ID || '')
// Added user-read-recently-played (used by Me.recentlyPlayed) and user-library-read (future use / broader compatibility)
// Including user-top-read for potential future personalization features.
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-email user-read-private playlist-read-private playlist-read-collaborative streaming app-remote-control user-read-recently-played user-library-read user-top-read'
const REDIRECT_URI = String(import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback')

function randomString(len = 64) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let o = ''
	for (let i=0;i<len;i++) o += chars[Math.floor(Math.random()*chars.length)]
	return o
}
async function sha256(input: string) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
	const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
	return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

let inFlightRefresh: Promise<string | null> | null = null

export async function initiateAuth() {
	if (!CLIENT_ID) throw new Error('Missing CLIENT_ID')
	const codeVerifier = randomString(64)
	const codeChallenge = await sha256(codeVerifier)
	const state = randomString(16)
	const nonce = randomString(12)
	sessionStorage.setItem('pkce_code_verifier', codeVerifier)
	sessionStorage.setItem('oauth_state', state)
	sessionStorage.setItem('oauth_nonce', nonce)
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: CLIENT_ID,
		scope: SCOPES,
		redirect_uri: REDIRECT_URI,
		code_challenge_method: 'S256',
		code_challenge: codeChallenge,
		state,
	})
	const url = `https://accounts.spotify.com/authorize?${params.toString()}`
	window.location.href = url
}

export async function handleAuthRedirect() {
	const url = new URL(window.location.href)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	const storedState = sessionStorage.getItem('oauth_state')
	const codeVerifier = sessionStorage.getItem('pkce_code_verifier')
	if (!code || !state || state !== storedState || !codeVerifier) return
	const form = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: REDIRECT_URI,
		client_id: CLIENT_ID,
		code_verifier: codeVerifier,
	})
	const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
	if (!res.ok) return
	const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number }
	localStorage.setItem('access_token', data.access_token)
	if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
	localStorage.setItem('expires_at', String(Date.now() + data.expires_in * 1000))
	const { usePlayerStore } = await import('@/store/player')
	usePlayerStore.getState().setTokens(data.access_token, data.refresh_token || null)
	usePlayerStore.getState().setAuthed(true)
	try {
		const { Me } = await import('@/lib/spotifyApi')
		const profile = await Me.profile() as any
		const playlists = await Me.topPlaylists(20) as any
		usePlayerStore.getState().setProfile({ displayName: profile.display_name, avatarUrl: profile.images?.[0]?.url })
		usePlayerStore.getState().setPlaylists(playlists.items || [])
	} catch {}
}

async function refreshIfNeeded(): Promise<string | null> {
	const access_token = localStorage.getItem('access_token')
	const refresh_token = localStorage.getItem('refresh_token')
	const expires_at = Number(localStorage.getItem('expires_at') || '0')
	const now = Date.now()
	if (access_token && expires_at && (expires_at - now) > 60_000) return access_token
	if (!refresh_token) return access_token
	if (inFlightRefresh) return inFlightRefresh
	inFlightRefresh = (async () => {
		const form = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token,
			client_id: CLIENT_ID,
		})
		try {
			const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
			if (!res.ok) throw new Error('Refresh failed')
			const data = await res.json() as { access_token: string; expires_in: number }
			const expiresAt = Date.now() + (data.expires_in * 1000)
			localStorage.setItem('access_token', data.access_token)
			localStorage.setItem('expires_at', String(expiresAt))
			const { usePlayerStore } = await import('@/store/player')
			usePlayerStore.getState().setTokens(data.access_token, refresh_token)
			return data.access_token
		} catch (e) {
			console.warn('Token refresh error', e)
			return access_token
		} finally {
			inFlightRefresh = null
		}
	})()
	return inFlightRefresh
}

export async function getAccessToken(): Promise<string | null> {
	return await refreshIfNeeded()
}

export async function logout() {
	localStorage.removeItem('access_token')
	localStorage.removeItem('refresh_token')
	localStorage.removeItem('expires_at')
}