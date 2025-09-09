import { Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { SidebarShell } from './components/ui'
import PlayerBar from './components/PlayerBar'
import NowPlayingHeader from '@/components/NowPlayingHeader'
import TopTabs from '@/components/TopTabs'


export default function App() {
	return (
				<div className="h-screen w-screen bg-gradient-to-br from-[#071014] via-[#0b1115] to-[#08121a] text-white font-sans">
							<div className="max-w-[1600px] mx-auto h-full grid grid-cols-[72px_1fr] md:grid-cols-[220px_1fr] gap-6 px-4 py-4">
								{/* Sidebar/rail region */}
								<aside className="w-full hidden sm:block">
									  {/* Full sidebar (desktop only) */}
									  <div className="hidden lg:block">
										<Sidebar />
									</div>
									  {/* Icon rail at md (tablet) */}
									  <div className="hidden md:block lg:hidden">
										<SidebarShell className="items-center w-12 p-2 gap-4">
											{/* Simple rail icons (placeholders tied to actions) */}
											<button className="h-11 w-11 rounded-md bg-white/10" title="Library" aria-label="Library" />
											<button className="h-11 w-11 rounded-md bg-white/10" title="Search" aria-label="Search" />
											<button className="h-11 w-11 rounded-md bg-white/10" title="Settings" aria-label="Settings" />
										</SidebarShell>
									</div>
								</aside>

			{/* Main column (fluid) */}
			<main className="overflow-y-auto min-h-0 w-full flex flex-col gap-6">
							{/* WMP top tabs */}
							<TopTabs />
							{/* Header: now playing metadata */}
							<NowPlayingHeader />

														{/* Visualizer Panel with fullscreen affordance */}
																				<div className="relative w-full panel-glass p-2 md:p-4 min-h-0 flex-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.5)] rounded-2xl">
																						<div className="absolute top-2 right-2 z-10">
																							<button
																								className="px-2 py-1 text-xs rounded-md bg-white/10 hover:bg-white/15"
																								onClick={() => {
																									const el = document.querySelector('.viz-root') as HTMLElement | null
																									if (el && el.requestFullscreen) el.requestFullscreen().catch(()=>{})
																								}}
																								aria-label="Enter fullscreen"
																							>
																								Fullscreen
																							</button>
																						</div>
																						<div className="viz-root w-full h-full">
																							<Outlet />
																						</div>
																					</div>

							{/* Transport: player controls */}
							<PlayerBar />
						</main>

								{/* no right gutter */}
				</div>
			</div>
	)
}