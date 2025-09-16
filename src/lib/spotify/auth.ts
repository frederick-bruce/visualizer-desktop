import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * PKCE + Refresh token auth helper for Spotify inside Tauri.
 * Secure persistence via Tauri plugin (command side) instead of localStorage.
 * Assumes Rust side implements commands:
 *  - secure_store_get(key: string) -> string | null
 *  - secure_store_set(key: string, value: string)
 *  - secure_store_delete(key: string)
 *  - open_system_browser(url: string) (optional alternative to shell.open)
 *  - optionally a deep link / custom protocol will deliver the callback URL to the front-end via an emitted event 'spotify://callback?code=...'
 */

// ---- Types ----
export interface TokenBundle {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
  scope?: string
  tokenType: 'Bearer'
}

interface RefreshResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  scope?: string
  refresh_token?: string
}

interface CodeResponse extends RefreshResponse {}

export interface AuthConfig {
  clientId: string
  redirectUri: string // must match Spotify app setting; custom protocol recommended: 'yourapp://callback'
  scopes: string[]
  authorizeBase?: string
  tokenEndpoint?: string
}

// ---- Internal state ----
let config: AuthConfig | null = null
let inited = false
let tokenCache: TokenBundle | null = null
let refreshInFlight: Promise<string | null> | null = null

// Simple event based callback resolution (for custom protocol). Consumers can alternatively call handleCallback manually.
let callbackUnsub: (() => void) | null = null

// ---- Secure storage wrappers ----
async function sget(key: string): Promise<string | null> {
  try { return await invoke<string | null>('secure_store_get', { key }) } catch { return null }
}
async function sset(key: string, value: string): Promise<void> {
  try { await invoke('secure_store_set', { key, value }) } catch {}
}
async function sdel(key: string): Promise<void> { try { await invoke('secure_store_delete', { key }) } catch {} }

// ---- Helpers ----
function b64url(bytes: Uint8Array) {
  const bin = String.fromCharCode(...bytes)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function randomBytes(len: number) {
  const arr = new Uint8Array(len); crypto.getRandomValues(arr); return arr
}
async function sha256B64Url(str: string) {
  const data = new TextEncoder().encode(str)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return b64url(new Uint8Array(digest))
}

// ---- Initialization ----
export function configureSpotifyAuth(c: AuthConfig) {
  config = { authorizeBase: 'https://accounts.spotify.com/authorize', tokenEndpoint: 'https://accounts.spotify.com/api/token', ...c }
  if (!inited) {
    inited = true
  }
}

// ---- Public API ----
export async function beginLogin(): Promise<void> {
  if (!config) throw new Error('Auth not configured')
  const state = b64url(randomBytes(12))
  const verifier = b64url(randomBytes(64))
  const challenge = await sha256B64Url(verifier)
  await sset('sp_state', state)
  await sset('sp_verifier', verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: config.scopes.join(' '),
    state
  })
  const url = `${config.authorizeBase}/${config.authorizeBase?.endsWith('authorize') ? '' : ''}?${params.toString()}`.replace(/authorize\/\/\?/, 'authorize?')
  try { await invoke('open_system_browser', { url }) } catch { /* no-op if command not implemented */ }
}

export interface CallbackResult { success: boolean; error?: string }

export async function handleCallback(callbackUrl: string): Promise<CallbackResult> {
  if (!config) throw new Error('Auth not configured')
  const url = new URL(callbackUrl)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  if (!code) return { success: false, error: 'missing_code' }
  const storedState = await sget('sp_state')
  if (!storedState || storedState !== returnedState) return { success: false, error: 'state_mismatch' }
  const verifier = await sget('sp_verifier')
  if (!verifier) return { success: false, error: 'missing_verifier' }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier
  })
  const res = await fetch(config.tokenEndpoint!, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
  if (!res.ok) return { success: false, error: String(res.status) }
  const data: CodeResponse = await res.json()
  const expiresAt = Date.now() + data.expires_in * 1000
  tokenCache = { accessToken: data.access_token, refreshToken: data.refresh_token || '', expiresAt, scope: data.scope, tokenType: 'Bearer' }
  await sset('sp_token', JSON.stringify(tokenCache))
  return { success: true }
}

export async function getAccessToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.accessToken
  if (!tokenCache) {
    const raw = await sget('sp_token')
    if (raw) {
      try { tokenCache = JSON.parse(raw) as TokenBundle } catch {}
    }
  }
  return tokenCache?.accessToken || null
}

export async function getValidToken(): Promise<string | null> {
  await loadCacheIfNeeded()
  if (!tokenCache) return null
  const remaining = tokenCache.expiresAt - Date.now()
  if (remaining > 60_000) return tokenCache.accessToken
  return await refreshToken()
}

async function loadCacheIfNeeded() {
  if (tokenCache) return
  const raw = await sget('sp_token')
  if (raw) {
    try { tokenCache = JSON.parse(raw) as TokenBundle } catch {}
  }
}

async function refreshToken(): Promise<string | null> {
  if (!config) throw new Error('Auth not configured')
  await loadCacheIfNeeded()
  if (!tokenCache?.refreshToken) return null
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenCache!.refreshToken,
        client_id: config!.clientId
      })
      const res = await fetch(config!.tokenEndpoint!, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      if (!res.ok) throw new Error('refresh_failed_' + res.status)
      const data: RefreshResponse = await res.json()
      const expiresAt = Date.now() + data.expires_in * 1000
      tokenCache = { accessToken: data.access_token, refreshToken: tokenCache!.refreshToken, expiresAt, scope: data.scope, tokenType: 'Bearer' }
      if (data.refresh_token) tokenCache.refreshToken = data.refresh_token
      await sset('sp_token', JSON.stringify(tokenCache))
      return tokenCache.accessToken
    } catch (e) {
      console.warn('[spotify-auth] refresh error', e)
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

export async function logout() {
  tokenCache = null
  await sdel('sp_token'); await sdel('sp_state'); await sdel('sp_verifier')
}

export type AuthedFetcher = <T=unknown>(path: string, init?: RequestInit) => Promise<T>

export function withSpotifyAuth(baseUrl: string = 'https://api.spotify.com/v1'): AuthedFetcher {
  return async function authed<T=unknown>(path: string, init?: RequestInit): Promise<T> {
    let token = await getValidToken()
    if (!token) throw new Error('no_token')
    const res1 = await fetch(baseUrl + path, attach(init, token))
    if (res1.status === 401) {
      token = await getValidToken()
      if (!token) throw new Error('no_token_refresh')
      const res2 = await fetch(baseUrl + path, attach(init, token))
      if (!res2.ok) throw mkErr(res2)
      return parseBody<T>(res2)
    }
    if (!res1.ok) throw mkErr(res1)
    return parseBody<T>(res1)
  }
}

function attach(init: RequestInit | undefined, token: string): RequestInit {
  const headers: Record<string,string> = { 'Authorization': `Bearer ${token}` }
  if (init?.headers) Object.assign(headers, init.headers as any)
  return { ...init, headers }
}

async function parseBody<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T
  const text = await res.text()
  if (!text) return undefined as unknown as T
  try { return JSON.parse(text) as T } catch {
    return undefined as unknown as T
  }
}

function mkErr(res: Response) {
  const e = new Error(`${res.status} ${res.statusText}`)
  // @ts-ignore add details
  ;(e as any).status = res.status
  return e
}

// Optionally listen for callback events emitted from Rust side
export function enableCallbackListener(eventName: string = 'spotify://callback', handler?: (r: CallbackResult) => void) {
  if (callbackUnsub) return
  callbackUnsub = listen<string>(eventName, async (ev) => {
    const r = await handleCallback(ev.payload)
    handler?.(r)
  }) as unknown as (() => void)
}

export function disableCallbackListener() {
  if (callbackUnsub) { callbackUnsub(); callbackUnsub = null }
}
