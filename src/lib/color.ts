export async function getDominantColorFromUrl(url: string | null): Promise<string> {
  if (!url) return '#1DB954'
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const w = Math.min(64, img.width)
          const h = Math.min(64, img.height)
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, w, h)
          const data = ctx.getImageData(0, 0, w, h).data
          let r = 0, g = 0, b = 0, count = 0
          for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i+3]
            if (alpha < 125) continue
            r += data[i]; g += data[i+1]; b += data[i+2]; count++
          }
          if (!count) return resolve('#1DB954')
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          resolve(`rgb(${r}, ${g}, ${b})`)
        } catch (err) { resolve('#1DB954') }
      }
      img.onerror = () => resolve('#1DB954')
      img.src = url
      // fallback if cached and already complete
      if (img.complete) img.onload = img.onload!
    })
  } catch {
    return '#1DB954'
  }
}
