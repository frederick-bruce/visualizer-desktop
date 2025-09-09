// PKCE client-side OAuth helpers for Spotify
// Provides: authorize(), handleAuthRedirect(), getAccessToken(), logout()

const CLIENT_ID = String(import.meta.env.VITE_SPOTIFY_CLIENT_ID || '')
const REDIRECT_URI = String(import.meta.env.VITE_REDIRECT_URI || 'http://localhost:5173/callback')
const SCOPES = String((import.meta.env.VITE_SPOTIFY_SCOPES) || 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private')

function randomString(length = 32) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let out = ''
	for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length))
	return out
}

async function sha256(input: string) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
	const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
	// base64url
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function authorize() {
	if (!CLIENT_ID) {
		console.error('Missing VITE_SPOTIFY_CLIENT_ID - set VITE_SPOTIFY_CLIENT_ID in your .env')
		throw new Error('Missing VITE_SPOTIFY_CLIENT_ID')
	}
	const codeVerifier = randomString(64)
	const codeChallenge = await sha256(codeVerifier)
	const state = randomString(16)

	sessionStorage.setItem('pkce_code_verifier', codeVerifier)
	sessionStorage.setItem('oauth_state', state)

	const params = new URLSearchParams({
		response_type: 'code',
		client_id: CLIENT_ID,
		scope: SCOPES,
		redirect_uri: REDIRECT_URI,
		code_challenge_method: 'S256',
		code_challenge: codeChallenge,
		state,
	})

	window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function handleAuthRedirect() {
	const url = new URL(window.location.href)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	const storedState = sessionStorage.getItem('oauth_state')
	const codeVerifier = sessionStorage.getItem('pkce_code_verifier')

	if (!code || !state || state !== storedState || !codeVerifier) throw new Error('Auth failed')

	const form = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: REDIRECT_URI,
		client_id: CLIENT_ID,
		code_verifier: codeVerifier,
	})

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: form,
	})

	if (!res.ok) throw new Error('Token exchange failed')
	const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }

	// Persist tokens (simple localStorage here; consider Tauri secure storage for prod)
	localStorage.setItem('access_token', data.access_token)
	if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token)
	localStorage.setItem('token_timestamp', String(Date.now()))

		// notify store
		const { usePlayerStore } = await import('@/store/player')
		usePlayerStore.getState().setTokens(data.access_token, data.refresh_token ?? null)
		usePlayerStore.getState().setAuthed(true)

		// fetch profile and playlists and set them in the store
		try {
			const { Me } = await import('@/lib/spotifyApi')
			const profile = await Me.profile() as any
			const playlists = await Me.topPlaylists(20) as any
			usePlayerStore.getState().setProfile({ displayName: profile.display_name, avatarUrl: profile.images?.[0]?.url })
			usePlayerStore.getState().setPlaylists(playlists.items || [])
		} catch (err) {
			// non-fatal
			console.warn('Failed to fetch profile/playlists after auth', err)
		}
}

export async function getAccessToken(): Promise<string | null> {
	const at = localStorage.getItem('access_token')
	const ts = Number(localStorage.getItem('token_timestamp') || '0')
	const age = (Date.now() - ts) / 1000
	if (at && age < 3400) return at // ~ 56m safety window

	const rt = localStorage.getItem('refresh_token')
	if (!rt) return at

	const form = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: rt,
		client_id: CLIENT_ID,
	})

	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: form,
	})
	if (!res.ok) return at
	const data = (await res.json()) as { access_token: string; expires_in: number }
	localStorage.setItem('access_token', data.access_token)
	localStorage.setItem('token_timestamp', String(Date.now()))
	return data.access_token
}

export async function logout() {
	localStorage.removeItem('access_token')
	localStorage.removeItem('refresh_token')
	localStorage.removeItem('token_timestamp')
}