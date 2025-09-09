import { useEffect } from 'react'
import { handleAuthRedirect } from '@/lib/spotifyAuth'
import { useNavigate } from 'react-router-dom'


export default function Callback() {
const navigate = useNavigate()
useEffect(() => {
(async () => {
await handleAuthRedirect()
navigate('/')
})()
}, [navigate])


return (
<div className="h-full grid place-items-center">
<p className="text-white/70">Finishing sign‑in…</p>
</div>
)
}