import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, createContext, useContext, useMemo } from 'react'
import { useBeatEngine } from '@/lib/useBeatEngine'
import { usePlayerStore } from '@/store/player'

// Basic BeatFrame exposure via context for early 3D prototypes
export const BeatContext = createContext<ReturnType<typeof useBeatEngine> | null>(null)
export function useBeatFrame() { const v = useContext(BeatContext); if (!v) throw new Error('BeatContext missing'); return v }

function PlaceholderScene() {
  // Simple reactive cube placeholder using beat intensity later
  return null
}

export default function Stage() {
  const trackId = usePlayerStore(s => s.track?.id)
  const lowPowerMode = usePlayerStore(s => s.lowPowerMode)
  const beat = useBeatEngine(trackId)
  const dpr = useMemo(() => (lowPowerMode ? 1 : Math.min(2, window.devicePixelRatio || 1)), [lowPowerMode])

  return (
    <BeatContext.Provider value={beat}>
      <Canvas dpr={dpr} camera={{ position: [0, 0, 5], fov: 60 }}>
        <color attach="background" args={[ '#05090c' ]} />
        <Suspense fallback={null}>
          <PlaceholderScene />
          <OrbitControls enableDamping dampingFactor={0.1} enableZoom={false} />
        </Suspense>
      </Canvas>
    </BeatContext.Provider>
  )
}
