import { useEffect, useState } from 'react'
import { deriveAccentFromArt } from '@/lib/theme'
import Truncate from '@/components/Truncate'
import { usePlayerStore } from '@/store/player'

export default function NowPlayingHeader() {
  const { isAuthed } = usePlayerStore()
  const [title, setTitle] = useState<string | null>(null)
  const [artists, setArtists] = useState<string | null>(null)
  const [album, setAlbum] = useState<string | null>(null)
  const [art, setArt] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthed) return
    let canceled = false
    const id = setInterval(async () => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me/player', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
        if (!res.ok) return
        const data = await res.json()
        const it = data?.item
        if (canceled) return
        if (it) {
          setTitle(it.name || null)
          setArtists((it.artists || []).map((a: any) => a.name).join(', ') || null)
          setAlbum(it.album?.name || null)
          const url = it.album?.images?.[0]?.url || null
          setArt(url)
          deriveAccentFromArt(url)
        } else {
          setTitle(null); setArtists(null); setAlbum(null); setArt(null)
        }
      } catch {}
    }, 1000)
    return () => { canceled = true; clearInterval(id) }
  }, [isAuthed])

  return (
  <div className="flex items-center gap-4 min-h-[72px]">
      <div className="w-14 h-14 rounded-md overflow-hidden bg-white/5 flex items-center justify-center">
        {art ? <img src={art} alt={title ?? 'album art'} className="w-full h-full object-cover" /> : <div className="text-xs text-white/40">—</div>}
      </div>
      <div className="min-w-0">
    <div className="typo-h1"><Truncate title={title ?? undefined}>{title ?? 'Nothing playing'}</Truncate></div>
    <div className="typo-body"><Truncate title={artists ? `${artists} · ${album ?? ''}` : undefined}>{artists ? `${artists} · ${album ?? ''}` : '—'}</Truncate></div>
      </div>
    </div>
  )
}
