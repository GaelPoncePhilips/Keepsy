import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Hueco del post en el blob (móvil, diseño de Figma): el avatar y la foto son un solo agujero.
 * El círculo del avatar se une a la esquina superior izquierda de la foto con un cuello suave,
 * y el borde del agujero lleva sombra interior + filo de luz, como el resto del vidrio.
 */

const AV_R = 26 // radio del hueco del avatar
const AV_C = 30 // centro del avatar (x e y)
const TOPE = 60 // dónde empieza la foto (debajo de la fila del encabezado)
const ESQ = 28 // radio de las esquinas de la foto
const K = 0.5523 // constante de cuarto de círculo con béziers

/** Contorno del hueco en px para un ancho W y alto H. */
export function caminoHueco(W: number, H: number): string {
  const e = ESQ * K
  const r = AV_R * K
  const izq = AV_C - AV_R
  const der = AV_C + AV_R
  const cuello = der + 28
  return [
    `M${cuello} ${TOPE}`,
    `L${W - ESQ} ${TOPE}`,
    `C${W - ESQ + e} ${TOPE} ${W} ${TOPE + ESQ - e} ${W} ${TOPE + ESQ}`,
    `L${W} ${H - ESQ}`,
    `C${W} ${H - ESQ + e} ${W - ESQ + e} ${H} ${W - ESQ} ${H}`,
    `L${ESQ} ${H}`,
    `C${ESQ - e} ${H} 0 ${H - ESQ + e} 0 ${H - ESQ}`,
    `L0 ${AV_C + 14}`,
    `C0 ${AV_C + 6} ${izq} ${AV_C + 4} ${izq} ${AV_C}`,
    `C${izq} ${AV_C - r} ${AV_C - r} ${izq} ${AV_C} ${izq}`,
    `C${AV_C + r} ${izq} ${der} ${AV_C - r} ${der} ${AV_C}`,
    `C${der} ${AV_C + 22} ${der + 10} ${TOPE} ${cuello} ${TOPE}`,
    'Z',
  ].join(' ')
}

interface Props {
  /** Avatar (52px) que va dentro del círculo. */
  avatar: ReactNode
  /** Encabezado sobre el blob, a la derecha del avatar (nombre, hora, menú). */
  encabezado: ReactNode
  /** La foto / carrusel / video. */
  children: ReactNode
  /** Imagen que se ve difusa detrás del vidrio, alrededor del hueco. */
  fondo?: string
}

export function HuecoPost({ avatar, encabezado, children, fondo }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setTam((t) => (t && t.w === width && t.h === height ? t : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const d = tam ? caminoHueco(tam.w, tam.h) : null
  return (
    <div className="relative isolate mx-2">
      {fondo && (
        // La foto sigue por detrás del vidrio: se derrama difusa más allá del hueco (el blob la recorta).
        <img
          src={fondo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[calc(100%-60px)] w-full scale-[1.03] object-cover opacity-60 blur-[10px]"
          // El difuminado no pasa de ~12px más allá del recuadro de la foto.
          style={{ clipPath: 'inset(-12px round 40px)' }}
        />
      )}
      <div
        ref={ref}
        className="relative"
        style={{ paddingTop: TOPE, clipPath: d ? `path('${d}')` : undefined, visibility: d ? undefined : 'hidden' }}
      >
        <div className="absolute" style={{ left: AV_C - AV_R - 1, top: AV_C - AV_R - 1, width: AV_R * 2 + 2, height: AV_R * 2 + 2 }}>
          {avatar}
        </div>
        {children}
      </div>
      {tam && d && (
        <svg aria-hidden="true" className="pointer-events-none absolute top-0 left-0" width={tam.w} height={tam.h} viewBox={`0 0 ${tam.w} ${tam.h}`}>
          <defs>
            <clipPath id={`hueco-${tam.w}-${tam.h}`}>
              <path d={d} />
            </clipPath>
          </defs>
          <g clipPath={`url(#hueco-${tam.w}-${tam.h})`} fill="none">
            {/* Sombra interior suave (el agujero tiene profundidad) + filo de luz del vidrio */}
            <path d={d} stroke="black" strokeOpacity="0.14" strokeWidth="22" />
            <path d={d} stroke="black" strokeOpacity="0.16" strokeWidth="10" />
            <path d={d} stroke="black" strokeOpacity="0.2" strokeWidth="4" />
            <path d={d} stroke="white" strokeOpacity="0.16" strokeWidth="2" />
          </g>
        </svg>
      )}
      <div className="absolute top-0 right-0 flex h-[60px] items-center gap-2 pr-1" style={{ left: AV_C + AV_R + 10 }}>
        {encabezado}
      </div>
    </div>
  )
}

/** Self-check: el contorno cierra y no se sale del rectángulo. */
export function __checkHueco() {
  const d = caminoHueco(360, 480)
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  if (!d.endsWith('Z') || nums.some((n) => n < 0 || n > 480)) throw new Error('caminoHueco fuera de rango')
}
