import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import VisualizerCanvas from '@/components/VisualizerCanvas'
import SpotifyBridge from '@/components/SpotifyBridge'
import Sidebar from '@/components/Sidebar'
import NowPlayingBar from '@/components/NowPlayingBar'
import { useVisualizerState } from '@/state/visualizerStore'
import '@/styles/app.css'
import VisualLayout from '@/components/VisualLayout'
import HeaderBar from '@/components/HeaderBar'
import DevicePicker from '@/components/DevicePicker'
import { useUiStore } from '@/store/ui'
import SdkBootstrap from '@/components/SdkBootstrap'

export default function App() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') as 'library' | 'visualizers' | 'settings') || 'visualizers'

  const setTab = (key: 'library' | 'visualizers' | 'settings') => {
    const sp = new URLSearchParams(searchParams)
    sp.set('tab', key)
    setSearchParams(sp, { replace: true })
  }

  // Disable mic/loopback analyzer in analysis-only path
  // (kept available in store, but not invoked here)

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

  const drawer = useUiStore()
  // Reactive selectors so header updates when store changes
  const track = usePlayerStore(s => s.track || {}) as any
  const devices = usePlayerStore(s => s.devices || []) as any[]
  const activeDeviceId = usePlayerStore(s => s.activeDeviceId || null) as string | null
  const sdkDeviceId = usePlayerStore(s => s.sdkDeviceId || null) as string | null
  const deviceName = devices.find(d => d.id === activeDeviceId)?.name
  const header = (
    <HeaderBar
      trackTitle={track.name}
      trackArtist={track.artists}
      artworkUrl={track.albumArt}
      deviceName={deviceName}
      deviceConnected={!!activeDeviceId}
      onToggleSidebar={() => (drawer.drawerOpen ? drawer.closeDrawer() : drawer.openDrawer())}
      devicePicker={<DevicePicker sdkDeviceId={sdkDeviceId || undefined} />}
    />
  )
  const footer = (<NowPlayingBar />)

  return (
    <div className="bg-neutral-950 text-neutral-100">
      <SdkBootstrap />
      <SpotifyBridge />
      <VisualLayout
        header={header}
        sidebar={<Sidebar />}
        main={<div className="relative h-full w-full"><VisualizerCanvas /></div>}
        footer={footer}
      />
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