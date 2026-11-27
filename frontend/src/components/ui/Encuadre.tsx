// Encuadrar una imagen antes de subirla (foto de perfil y publicaciones): arrastrar para mover,
// rueda / pellizco / control deslizante para hacer zoom. Devuelve un JPEG recortado.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { formaStory } from '../../lib/formasM3'
import { Button } from './Button'
import { Dialog } from './Overlay'

export interface EncuadreProps {
  /** URL de la imagen (blob: local o la ya subida si el navegador no la decodifica, p. ej. HEIC). */
  src: string | null
  /** Proporción ancho/alto del recorte. */
  aspecto?: number
  /** Vista previa con la estrella de 8 puntas (foto de perfil). */
  estrella?: boolean
  titulo?: string
  /** Lado mayor del JPEG resultante. */
  maxLado?: number
  onListo: (recorte: Blob) => void
  onCancelar: () => void
}

const VISTA = 300

export function Encuadre({ src, aspecto = 1, estrella, titulo = 'Encuadrar', maxLado = 1440, onListo, onCancelar }: EncuadreProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const punteros = useRef(new Map<number, { x: number; y: number }>())
  const distInicial = useRef<{ d: number; z: number } | null>(null)

  const w = aspecto >= 1 ? VISTA : Math.round(VISTA * aspecto)
  const h = aspecto >= 1 ? Math.round(VISTA / aspecto) : VISTA

  useEffect(() => {
    setImg(null)
    setError(false)
    setZoom(1)
    setPos({ x: 0, y: 0 })
    if (!src) return
    const i = new Image()
    if (!src.startsWith('blob:') && !src.startsWith('data:')) i.crossOrigin = 'anonymous'
    i.onload = () => setImg(i)
    i.onerror = () => setError(true)
    i.src = src
  }, [src])

  // Escala base: la imagen cubre el marco (como object-fit: cover).
  const base = img ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : 1
  const escala = base * zoom
  const iw = img ? img.naturalWidth * escala : 0
  const ih = img ? img.naturalHeight * escala : 0
  const limitar = (p: { x: number; y: number }, z = zoom) => {
    if (!img) return p
    const ew = img.naturalWidth * base * z
    const eh = img.naturalHeight * base * z
    const mx = Math.max(0, (ew - w) / 2)
    const my = Math.max(0, (eh - h) / 2)
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
  }
  const cambiarZoom = (z: number) => {
    const nz = Math.min(4, Math.max(1, z))
    setZoom(nz)
    setPos((p) => limitar(p, nz))
  }

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()]
      distInicial.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }
    }
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const prev = punteros.current.get(e.pointerId)
    if (!prev) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punteros.current.size === 2 && distInicial.current) {
      const [a, b] = [...punteros.current.values()]
      cambiarZoom(distInicial.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / distInicial.current.d))
      return
    }
    setPos((p) => limitar({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }))
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    punteros.current.delete(e.pointerId)
    if (punteros.current.size < 2) distInicial.current = null
  }

  const confirmar = () => {
    if (!img) return
    // Región visible del marco en coordenadas de la imagen original.
    const sx = (iw / 2 - w / 2 - pos.x) / escala
    const sy = (ih / 2 - h / 2 - pos.y) / escala
    const sw = w / escala
    const sh = h / escala
    const factor = Math.min(1, maxLado / Math.max(sw, sh))
    const c = document.createElement('canvas')
    c.width = Math.round(sw * factor)
    c.height = Math.round(sh * factor)
    const g = c.getContext('2d')
    if (!g) return
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
    try {
      c.toBlob((b) => (b ? onListo(b) : setError(true)), 'image/jpeg', 0.9)
    } catch {
      // Lienzo "contaminado" (imagen de otro origen sin CORS): no se puede recortar.
      setError(true)
    }
  }

  return (
    <Dialog
      open={src !== null}
      onClose={onCancelar}
      title={titulo}
      width={420}
      actions={
        <>
          <Button variant="text" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button disabled={!img || error} onClick={confirmar}>
            Listo
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 px-6 pt-4">
        {error ? (
          <p className="type-body-m py-10 text-center text-on-surface-variant">
            No se pudo abrir esta imagen para encuadrarla en este navegador.
          </p>
        ) : (
          <div
            className="relative touch-none cursor-grab overflow-hidden bg-black select-none active:cursor-grabbing"
            style={{ width: w, height: h }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={(e) => cambiarZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          >
            {img && (
              <img
                src={img.src}
                alt="Imagen a encuadrar"
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ width: iw, height: ih, left: (w - iw) / 2 + pos.x, top: (h - ih) / 2 + pos.y }}
              />
            )}
            {/* Guía: tercios + forma final (estrella para la foto de perfil). */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="border border-white/15" />
              ))}
            </div>
            {estrella && (
              <svg className="pointer-events-none absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <mask id="encuadre-estrella">
                    <rect width="100" height="100" fill="white" />
                    <polygon points={formaStory(false).replace(/^polygon\(|\)$/g, '').replace(/%/g, '')} fill="black" />
                  </mask>
                </defs>
                <rect width="100" height="100" fill="rgb(0 0 0 / .55)" mask="url(#encuadre-estrella)" />
              </svg>
            )}
          </div>
        )}
        {!error && (
          <label className="flex w-full items-center gap-3">
            <span className="type-label-m text-on-surface-variant">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => cambiarZoom(Number(e.target.value))}
              className="flex-1 accent-[var(--md-sys-color-primary,#e53935)]"
              aria-label="Zoom"
            />
          </label>
        )}
        <p className="type-body-s pb-1 text-on-surface-variant">Arrastrá para mover · pellizcá o usá la rueda para acercar</p>
      </div>
    </Dialog>
  )
}

/** true si el navegador probablemente no puede mostrar el archivo (HEIC/HEIF fuera de Safari). */
export function esHeic(f: File): boolean {
  return /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)
}
