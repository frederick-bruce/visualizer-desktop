import { create } from 'zustand'

export type PlayerTokenState = {
  player: any | null
  token: string | null
  setPlayer: (p: any | null) => void
  setToken: (t: string | null) => void
}

export const usePlayerTokenStore = create<PlayerTokenState>((set) => ({
  player: null,
  token: null,
  setPlayer: (player) => set({ player }),
  setToken: (token) => set({ token })
}))
