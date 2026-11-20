import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<string | null>>()

/** Color dominante (saturado) de una imagen; null si el navegador bloquea la lectura (CORS). */
function extraer(url: string): Promise<string | null> {
  let p = cache.get(url)
  if (p) return p
  p = new Promise<string | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(null)
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 24
        const ctx = c.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, 24, 24)
        const d = ctx.getImageData(0, 0, 24, 24).data
        let r = 0
        let g = 0
        let b = 0
        let peso = 0
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2])
          const min = Math.min(d[i], d[i + 1], d[i + 2])
          const w = 0.05 + (max - min) / 255 // pesa más lo saturado
          r += d[i] * w
          g += d[i + 1] * w
          b += d[i + 2] * w
          peso += w
        }
        resolve(`rgb(${Math.round(r / peso)} ${Math.round(g / peso)} ${Math.round(b / peso)})`)
      } catch {
        resolve(null)
      }
    }
    img.src = url
  })
  cache.set(url, p)
  return p
}

/** Tinte derivado de la foto de perfil (para el encabezado del perfil). */
export function useTinte(url: string | null): string | null {
  const [tinte, setTinte] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    if (!url) return
    void extraer(url).then((c) => {
      if (vivo) setTinte(c)
    })
    return () => {
      vivo = false
    }
  }, [url])
  return url ? tinte : null
}
