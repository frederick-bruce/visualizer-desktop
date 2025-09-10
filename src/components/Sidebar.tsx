import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '@/store/ui'
import { SidebarShell } from './sidebar/SidebarShell'
import { SidebarHeader } from './sidebar/SidebarHeader'
import { SidebarSearch } from './sidebar/SidebarSearch'
import { PlaylistListVirtual } from './sidebar/PlaylistListVirtual'
import { SidebarFooter } from './sidebar/SidebarFooter'

export default function Sidebar() {
	const { sidebarCollapsed } = useUiStore()
	const [query, setQuery] = useState('')
	const searchRef = useRef<HTMLInputElement | null>(null)

	// Keyboard: / focuses search (only when expanded)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === '/' && !sidebarCollapsed) { e.preventDefault(); searchRef.current?.focus() }
			if (e.key === 'Escape' && document.activeElement === searchRef.current) { searchRef.current?.blur(); setQuery('') }
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [sidebarCollapsed])

	return (
		<SidebarShell>
			<SidebarHeader />
			<SidebarSearch ref={searchRef} value={query} onChange={setQuery} hidden={sidebarCollapsed} />
			<div className="flex-1 min-h-0 flex flex-col">
				<PlaylistListVirtual query={query} />
			</div>
			<SidebarFooter />
		</SidebarShell>
	)
}