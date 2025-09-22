import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PostFX } from '@/visuals/effects/PostFX'

type HostAPI = { getTexture: () => THREE.Texture | null }

export default function ThreeHost({
  className,
  style,
  onReady,
  beat = false,
  baseBloom = 0.25
}: {
  className?: string
  style?: React.CSSProperties
  onReady?: (api: HostAPI) => void
  beat?: boolean
  baseBloom?: number
}) {
  // This is the element the VisualizationManager will append its WebGLRenderer canvas into.
  const attachRef = useRef<HTMLDivElement | null>(null)
  // We watch for a child canvas and create a CanvasTexture from it for R3F to display & process.
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null)
  const texRef = useRef<THREE.CanvasTexture | null>(null)

  useEffect(() => {
    if (!attachRef.current) return
    const el = attachRef.current
    const find = () => {
      const c = el.querySelector('canvas') as HTMLCanvasElement | null
      if (c && c !== sourceCanvas) setSourceCanvas(c)
    }
    const obs = new MutationObserver(find)
    obs.observe(el, { childList: true, subtree: true })
    find()
    return () => { obs.disconnect() }
  }, [])

  useEffect(() => {
    if (onReady) onReady({ getTexture: () => texRef.current })
  }, [onReady])

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {/* Offscreen container for VisualizationManager renderer canvas */}
      <div ref={attachRef} style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} aria-hidden />
      {/* R3F Canvas that remains mounted across plugin switches */}
      <Canvas
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        dpr={Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        frameloop="always"
      >
        <SourcePlane canvas={sourceCanvas} texRef={texRef} />
        <PostFX beat={beat} baseIntensity={baseBloom} />
      </Canvas>
    </div>
  )
}

function SourcePlane({ canvas, texRef }: { canvas: HTMLCanvasElement | null; texRef: React.MutableRefObject<THREE.CanvasTexture | null> }) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null)
  const { viewport, size } = useThree()
  const meshRef = useRef<THREE.Mesh | null>(null)

  // Create/update CanvasTexture when the manager's canvas changes
  useEffect(() => {
    if (!canvas) { setTex(null); texRef.current = null; return }
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    setTex(t)
    texRef.current = t
    return () => { t.dispose(); if (texRef.current === t) texRef.current = null }
  }, [canvas])

  // Update texture every frame
  useFrame(() => { if (tex) tex.needsUpdate = true })

  // Fit plane to viewport
  const scale = useMemo(() => {
    const w = viewport.width
    const h = viewport.height
    return [w, h, 1] as [number, number, number]
  }, [viewport.width, viewport.height])

  if (!tex) return null
  return (
    <mesh ref={meshRef} scale={scale}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}
