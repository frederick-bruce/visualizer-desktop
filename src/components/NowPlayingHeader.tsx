import { useEffect, useState, useRef } from 'react'
import { deriveAccentFromArt, accentGlowBackground } from '@/lib/theme'
import Truncate from '@/components/Truncate'
import { usePlayerStore } from '@/store/player'

export default function NowPlayingHeader() {
  const { isAuthed } = usePlayerStore()
  const [title, setTitle] = useState<string | null>(null)
  const [artists, setArtists] = useState<string | null>(null)
  const [album, setAlbum] = useState<string | null>(null)
  const [art, setArt] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

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
    <div
      className="relative flex items-center gap-4 min-h-[80px] px-2 py-2 rounded-xl border border-white/10 bg-black/30 backdrop-blur-md overflow-hidden"
      style={{
        backgroundImage: accentGlowBackground(),
        backgroundBlendMode: 'plus-lighter'
      }}
    >
      {/* Album art placeholder size prevents layout shift */}
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center bg-white/5 ring-1 ring-white/10">
        {art ? (
          <img
            ref={imgRef}
            src={art}
            alt={title ?? 'album art'}
            className="w-full h-full object-cover fade-in"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="text-[10px] text-white/40 select-none">No Art</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="group relative">
          <div className="typo-h1 whitespace-nowrap overflow-hidden">
            <span className="inline-block will-change-transform group-hover:animate-marquee" title={title ?? undefined}>{title ?? 'Nothing playing'}</span>
          </div>
        </div>
        <div className="group relative mt-0.5">
          <div className="typo-body text-white/70 whitespace-nowrap overflow-hidden">
            <span className="inline-block will-change-transform group-hover:animate-marquee" title={artists ? `${artists} · ${album ?? ''}` : undefined}>
              {artists ? `${artists} · ${album ?? ''}` : '—'}
            </span>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40%); }
        }
        .animate-marquee { animation: marquee 8s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animate-marquee { animation: none !important; }
        }
        .fade-in { opacity: 0; animation: fade 320ms ease forwards; }
        @keyframes fade { to { opacity: 1; } }
      `}</style>
    </div>
  )
}
