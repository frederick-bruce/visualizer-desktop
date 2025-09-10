import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  sidebarCollapsed: boolean
  drawerOpen: boolean
  setSidebarCollapsed(v?: boolean): void
  toggleSidebar(): void
  openDrawer(): void
  closeDrawer(): void
}

export const useUiStore = create<UiState>()(persist((set, get) => ({
  sidebarCollapsed: false,
  drawerOpen: false,
  setSidebarCollapsed(v) { set({ sidebarCollapsed: typeof v === 'boolean' ? v : !get().sidebarCollapsed }) },
  toggleSidebar() { set({ sidebarCollapsed: !get().sidebarCollapsed }) },
  openDrawer() { set({ drawerOpen: true }) },
  closeDrawer() { set({ drawerOpen: false }) },
}), { name: 'ui:v1' }))
