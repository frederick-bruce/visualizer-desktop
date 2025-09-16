import React from 'react'
import { useUiStore } from '@/store/ui'

type Props = {
  header: React.ReactNode
  sidebar?: React.ReactNode
  main: React.ReactNode
  footer: React.ReactNode
}

export default function VisualLayout({ header, sidebar, main, footer }: Props) {
  const drawerOpen = useUiStore(s => s.drawerOpen)
  const closeDrawer = useUiStore(s => s.closeDrawer)

  return (
    <div
      className="h-screen w-screen grid bg-neutral-950 text-neutral-100 min-h-0"
      style={{
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows: 'auto 1fr auto',
        gridTemplateAreas: `'header header' 'sidebar main' 'footer footer'`,
      }}
      data-testid="visual-layout"
    >
      <header className="col-span-2 border-b border-neutral-800" style={{ gridArea: 'header' }} role="banner">
        {header}
      </header>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:block border-r border-neutral-800 min-w-[240px] max-w-[360px]"
        style={{ gridArea: 'sidebar' }}
        aria-label="Sidebar"
      >
        {sidebar}
      </aside>

      {/* Mobile drawer sidebar (overlay) */}
  <div aria-hidden={!drawerOpen} className="md:hidden relative min-h-0" style={{ gridArea: 'main' }}>
        {/* Canvas/main sits underneath always */}
        <div className="relative h-full w-full overflow-hidden">{main}</div>
        {/* Overlay and panel only when open */}
        {drawerOpen && (
          <>
            <button
              aria-label="Close sidebar"
              className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={closeDrawer}
              data-testid="mobile-backdrop"
            />
            <div
              className="fixed inset-y-0 left-0 w-[80vw] max-w-[320px] bg-neutral-900 border-r border-neutral-800 shadow-xl p-3"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Sidebar"
              data-testid="mobile-sidebar"
            >
              {sidebar}
            </div>
          </>
        )}
      </div>

      {/* Main for desktop */}
      <main className="relative overflow-hidden hidden md:block h-full min-h-0" style={{ gridArea: 'main' }}>
        {main}
      </main>

      <footer className="col-span-2 border-t border-neutral-800" style={{ gridArea: 'footer' }}>
        {footer}
      </footer>
    </div>
  )
}
