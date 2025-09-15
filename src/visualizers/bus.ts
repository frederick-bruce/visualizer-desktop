import { BeatFrame, VizSettings, RenderMode } from './types'

export type BusEventMap = {
  frame: BeatFrame
  settings: VizSettings
  mode: RenderMode
}

export type BusEventKey = keyof BusEventMap
export type BusHandler<K extends BusEventKey> = (payload: BusEventMap[K]) => void

export interface VisualizerBus {
  on<K extends BusEventKey>(type: K, handler: BusHandler<K>): void
  off<K extends BusEventKey>(type: K, handler: BusHandler<K>): void
  emit<K extends BusEventKey>(type: K, payload: BusEventMap[K]): void
}

export function createVisualizerBus(): VisualizerBus {
  const listeners: Partial<Record<BusEventKey, Set<BusHandler<any>>>> = {}
  return {
    on(type, handler) {
      let set = listeners[type]
      if (!set) { set = new Set(); listeners[type] = set }
      set.add(handler as any)
    },
    off(type, handler) { listeners[type]?.delete(handler as any) },
    emit(type, payload) {
      const set = listeners[type]
      if (!set) return
      set.forEach(h => { try { (h as any)(payload) } catch (e) { console.warn('[viz-bus] handler error', e) } })
    }
  }
}
