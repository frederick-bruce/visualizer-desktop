import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import VisualizerCanvas from '@/components/VisualizerCanvas'
import SpotifyBridge from '@/components/SpotifyBridge'
import useLocalAudioAnalyzer from '@/hooks/useLocalAudioAnalyzer'
import Sidebar from '@/components/Sidebar'
import NowPlayingBar from '@/components/NowPlayingBar'
import { useVisualizerState } from '@/state/visualizerStore'
import '@/styles/app.css'

export default function App() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as 'library' | 'visualizers' | 'settings') || 'visualizers'

  const setTab = (key: 'library' | 'visualizers' | 'settings') => {
    const sp = new URLSearchParams(searchParams)
    sp.set('tab', key)
    setSearchParams(sp, { replace: true })
  }

  // Start local analyzer (loopback/mic) when configured
  const inputSource = usePlayerStore(s => s.inputSource)
  useLocalAudioAnalyzer(inputSource === 'Loopback')

  // Delegate to child routes (e.g., /callback) when not on root
  if (location.pathname !== '/') {
    return <Outlet />
  }

  // Bootstrap Spotify auth/session on load (rehydrate tokens/profile after refresh)
  useEffect(() => {
    try {
      const access = localStorage.getItem('access_token')
      if (!access) return
      const refresh = localStorage.getItem('refresh_token')
      const store = usePlayerStore.getState()
      store.setTokens(access, refresh)
      store.setAuthed(true)
      if (!store.profile) {
        import('@/lib/spotifyApi').then(async ({ Me }) => {
          try {
            const [profile, playlists] = await Promise.all([Me.profile(), Me.topPlaylists(20)])
            usePlayerStore.getState().setProfile({ displayName: (profile as any).display_name, avatarUrl: (profile as any).images?.[0]?.url })
            usePlayerStore.getState().setPlaylists((playlists as any).items || [])
          } catch {}
        })
      }
    } catch {}
  }, [])

  // Keyboard shortcuts: 1/2/3 switch plugins, B toggle beat gating, F fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.closest('input,textarea,[contenteditable="true"]'))) return
      const key = e.key.toLowerCase()
      if (key === '1') { (usePlayerStore.getState() as any).setVisualizer('bars') }
      else if (key === '2') { (usePlayerStore.getState() as any).setVisualizer('wave') }
      else if (key === '3') { (usePlayerStore.getState() as any).setVisualizer('particles') }
      else if (key === 'b') { useVisualizerState.getState().toggleBeatGate() }
      else if (key === 'f') { 
        const root = document.documentElement
        const isFs = !!document.fullscreenElement
        if (!isFs) root.requestFullscreen?.().catch(()=>{})
        else document.exitFullscreen?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app-grid bg-neutral-950 text-neutral-100">
      <SpotifyBridge />
      {/* Top bar */}
      <div className="border-b border-neutral-800 px-4 h-12 flex items-center gap-2">
        <div className="font-semibold tracking-wide">Spotify Visualizer</div>
        <nav className="ml-4 flex items-center gap-2 text-sm">
          <Tab active={tab==='library'} onClick={() => setTab('library')}>Library</Tab>
          <Tab active={tab==='visualizers'} onClick={() => setTab('visualizers')}>Visualizers</Tab>
          <Tab active={tab==='settings'} onClick={() => setTab('settings')}>Settings</Tab>
        </nav>
      </div>

      {/* Page */}
      <div className="app-main min-h-0">
        {/* Sidebar (collapsible) */}
        <Sidebar />
        {/* Main canvas area */}
        <main className="min-h-0">
          <div className="canvas-host">
            <VisualizerCanvas />
          </div>
        </main>
      </div>

      {/* Now Playing bar (only place with song/artist/time) */}
      <NowPlayingBar />
    </div>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`px-3 py-1 rounded-md border text-sm ${active ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-900 border-neutral-800 hover:bg-neutral-800'}`}
      onClick={onClick}
    >{children}</button>
  )
}