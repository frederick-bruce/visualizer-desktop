import { Outlet, useSearchParams } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import NowPlayingHeader from '@/components/NowPlayingHeader'
import TopTabs from '@/components/TopTabs'
import { useEffect, useState, useCallback } from 'react'
import { usePlayerStore } from '@/store/player'
import { accentCssVar } from '@/lib/theme'


export default function App() {
	const { visualizer, setReduceMotion, reduceMotion } = usePlayerStore() as any
	const [showHelp, setShowHelp] = useState(false)
	const [searchParams, setSearchParams] = useSearchParams()

	// Ensure body gets base accent variable if missing
	useEffect(() => {
		if (typeof document !== 'undefined') {
			const b = document.body
			if (!b.style.getPropertyValue('--accent')) {
				b.style.setProperty('--accent', '#1DB954')
			}
		}
	}, [])

	// Global keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === '/') return // allow browser/IDE shortcuts
			if (e.key === '?' || (e.shiftKey && e.key === '/')) { e.preventDefault(); setShowHelp(s => !s); return }
			if (['1','2','3'].includes(e.key)) {
				const tabMap: Record<string,string> = { '1':'library','2':'visualizers','3':'settings' }
				const sp = new URLSearchParams(searchParams); sp.set('tab', tabMap[e.key]); setSearchParams(sp, { replace: true }); return
			}
			// Arrow left/right seek 5s: delegate to player API endpoints if available
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
				// PlayerBar already handles J/L; implement small seek here if focus outside range input
				if ((document.activeElement && document.activeElement.tagName === 'INPUT')) return
				const delta = e.key === 'ArrowLeft' ? -5000 : 5000
				fetch('https://api.spotify.com/v1/me/player', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
					.then(r => r.ok ? r.json() : null)
					.then(d => { if (d?.progress_ms != null) { const pos = Math.max(0, d.progress_ms + delta); fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${pos}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } }).catch(()=>{}) } })
				.catch(()=>{})
			}
			// Slash focus search handled in Sidebar component
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [searchParams, setSearchParams])

	// Apply reduce motion class to root
	useEffect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false'
		}
	}, [reduceMotion])

	return (
		<div className="h-screen w-screen text-white font-sans bg-gradient-to-br from-[#061017] via-[#09141a] to-[#07141c]">
			<div className="h-full max-w-[1600px] mx-auto flex flex-col px-2 md:px-4 py-2 md:py-4 gap-3 md:gap-4">
				<div className="flex min-h-0 flex-1 gap-3 md:gap-4">
					<Sidebar />
					<div className="flex flex-col flex-1 min-h-0 gap-3 md:gap-4">
						<NowPlayingHeader />
						<TopTabs />
						<div className="relative flex-1 min-h-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6)]">
							<button
								className="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] rounded-md bg-white/10 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"
								onClick={() => {
									const el = document.querySelector('.viz-root') as HTMLElement | null
									if (el && el.requestFullscreen) el.requestFullscreen().catch(()=>{})
								}}
							>Fullscreen</button>
							<div className="viz-root w-full h-full">
								<Outlet />
							</div>
						</div>
						<PlayerBar />
					</div>
				</div>
				{showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
			</div>
		</div>
	)
}

function HelpModal({ onClose }: { onClose: () => void }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onClose])
	return (
		<div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
			<div className="relative w-full max-w-lg rounded-xl border border-white/15 bg-[#11181d]/95 shadow-2xl p-6 text-sm space-y-6">
				<div className="flex items-start justify-between">
					<h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
					<button onClick={onClose} aria-label="Close" className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15">Esc</button>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<Shortcut k="?" desc="Toggle this help" />
					<Shortcut k="Space" desc="Play / Pause" />
					<Shortcut k="J / L" desc="Seek -10s / +10s" />
					<Shortcut k="← / →" desc="Seek -5s / +5s" />
					<Shortcut k="↑ / ↓" desc="Volume up / down" />
					<Shortcut k="M" desc="Mute" />
					<Shortcut k="/" desc="Focus playlist search" />
					<Shortcut k="1 2 3" desc="Switch tabs" />
					<Shortcut k="Ctrl/Cmd + V" desc="Toggle render mode" />
				</div>
				<div className="pt-2 border-t border-white/10 text-xs text-white/50">Motion sensitive? Enable Reduce Motion in Settings → Performance.</div>
			</div>
		</div>
	)
}

function Shortcut({ k, desc }: { k: string; desc: string }) {
	return (
		<div className="flex items-start gap-3">
			<div className="flex flex-wrap gap-1 max-w-[140px]">
				{k.split(' ').map(p => <kbd key={p} className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[11px] font-mono tracking-wide">{p}</kbd>)}
			</div>
			<div className="text-white/70 flex-1 leading-relaxed">{desc}</div>
		</div>
	)
}