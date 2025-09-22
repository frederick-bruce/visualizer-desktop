import React, { useMemo } from 'react'
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing'

export function PostFX({ beat = false, baseIntensity = 0.25 }: { beat?: boolean; baseIntensity?: number }) {
  const intensity = useMemo(() => {
    return baseIntensity + (beat ? 0.35 : 0)
  }, [beat, baseIntensity])

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <SMAA />
      <Bloom intensity={intensity} luminanceThreshold={0.2} luminanceSmoothing={0.025} mipmapBlur radius={0.7} />
    </EffectComposer>
  )
}
