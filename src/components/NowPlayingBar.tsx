import React from 'react'
import PlayerBar from '@/components/PlayerBar'

export default function NowPlayingBar() {
  return (
    <div className="border-t border-neutral-800 bg-neutral-900/60 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/40 h-[76px] md:h-[88px] px-2 md:px-4 flex items-center">
      <div className="w-full max-w-7xl mx-auto">
        <PlayerBar />
      </div>
    </div>
  )
}
