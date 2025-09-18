import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import PlayerBar from '@/components/PlayerBar'
import VisualizerCanvas from '@/components/VisualizerCanvas'
import PresetPicker from '@/components/PresetPicker'
import SpotifyBridge from '@/components/SpotifyBridge'
import useLocalAudioAnalyzer from '@/hooks/useLocalAudioAnalyzer'

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

  return (
    <div className="h-screen w-screen grid grid-rows-[auto_1fr_auto] bg-neutral-950 text-neutral-100">
      <SpotifyBridge />
      {/* TopNav */}
      <div className="border-b border-neutral-800 px-4 h-12 flex items-center gap-2">
        <div className="font-semibold tracking-wide">Spotify Visualizer</div>
        <nav className="ml-4 flex items-center gap-2 text-sm">
          <Tab active={tab==='library'} onClick={() => setTab('library')}>Library</Tab>
          <Tab active={tab==='visualizers'} onClick={() => setTab('visualizers')}>Visualizers</Tab>
          <Tab active={tab==='settings'} onClick={() => setTab('settings')}>Settings</Tab>
        </nav>
      </div>

      {/* Page */}
      <div className="min-h-0">
        {tab === 'visualizers' && (
          <div className="h-full grid grid-cols-[300px_1fr] gap-0">
            {/* Docked left panel column (no overlays) */}
            <aside className="h-full border-r border-neutral-800 p-3 overflow-auto">
              <div className="mb-3">
                <PresetPicker />
              </div>
              {/* Reserved space for docked controls (settings/presets lists) */}
              <div className="text-xs text-neutral-400">
                Panels are docked here. Use Settings to configure analyzer and rotation.
              </div>
            </aside>
            {/* Canvas column: full-bleed stage */}
            <section className="h-full min-h-0">
              <div className="w-full h-full">
                <VisualizerCanvas />
              </div>
            </section>
          </div>
        )}
        {tab === 'library' && (
          <div className="h-full p-6">
            <div className="text-sm text-neutral-400">Library placeholder</div>
          </div>
        )}
        {tab === 'settings' && (
          <div className="h-full grid grid-cols-[320px_1fr]">
            <aside className="h-full border-r border-neutral-800 p-4 overflow-auto">
              <div className="text-sm text-neutral-300 font-medium mb-2">Settings</div>
              <div className="text-xs text-neutral-500">Add docked settings controls here.</div>
            </aside>
            <section className="p-6 text-sm text-neutral-400">Visualization settings and account controls.</section>
          </div>
        )}
      </div>

      {/* PlaybackBar */}
      <div className="border-t border-neutral-800">
        <PlayerBar />
      </div>
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