import { Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PlayerBar from './components/PlayerBar'
import NowPlayingHeader from '@/components/NowPlayingHeader'
import TopTabs from '@/components/TopTabs'
import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import { accentCssVar } from '@/lib/theme'


export default function App() {
	const { visualizer } = usePlayerStore()

	// Ensure body gets base accent variable if missing
	useEffect(() => {
		if (typeof document !== 'undefined') {
			const b = document.body
			if (!b.style.getPropertyValue('--accent')) {
				b.style.setProperty('--accent', '#1DB954')
			}
		}
	}, [])

	return (
		<div className="h-screen w-screen text-white font-sans bg-gradient-to-br from-[#061017] via-[#09141a] to-[#07141c]">
			<div className="h-full max-w-[1600px] mx-auto grid grid-cols-[72px_1fr] md:grid-cols-[220px_1fr] gap-3 md:gap-4 px-2 md:px-4 py-2 md:py-4">
				{/* Sidebar always in first column */}
				<aside className="h-full overflow-hidden rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm">
					<Sidebar />
				</aside>

				{/* Content stack */}
				<div className="flex flex-col min-h-0 gap-3 md:gap-4">
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
		</div>
	)
}