export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function formatTime(ms: number | undefined | null): string {
	if (ms == null || isNaN(ms as any)) return '--:--'
	ms = Math.max(0, Math.floor(ms))
	const totalSeconds = Math.floor(ms / 1000)
	const m = Math.floor(totalSeconds / 60)
	const s = totalSeconds % 60
	return `${m}:${s.toString().padStart(2,'0')}`
}