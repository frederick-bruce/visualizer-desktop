import { create } from 'zustand'

export interface VizPluginMetaLite { id: string; name: string; description?: string }

interface VisualizerStoreState {
  currentPluginId: string | null
  isRunning: boolean
  plugins: VizPluginMetaLite[]
  setPlugin: (id: string | null) => void
  setPlugins: (list: VizPluginMetaLite[]) => void
  start: () => void
  stop: () => void
}

export const useVisualizerStore = create<VisualizerStoreState>((set, get) => ({
  currentPluginId: (() => { try { return localStorage.getItem('vizPluginId') } catch { return null } })(),
  isRunning: false,
  plugins: [],
  setPlugin: (id) => set(() => { try { if (id) localStorage.setItem('vizPluginId', id) } catch {}; return { currentPluginId: id } }),
  setPlugins: (list) => set({ plugins: list }),
  start: () => { if (!get().isRunning) set({ isRunning: true }) },
  stop: () => { if (get().isRunning) set({ isRunning: false }) }
}))
