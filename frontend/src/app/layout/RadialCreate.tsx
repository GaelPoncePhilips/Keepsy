import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Icon } from '../../components/ui/Icon'
import { vibrar } from '../../lib/haptics'
import { cn, useEscape } from '../../lib/hooks'
import { usePresencia } from '../../lib/usePresencia'

/**
 * Botón "Crear" de la barra inferior con menú radial.
 * - Tocar: el menú se abre y queda abierto; tocás la opción que quieras (o afuera para cerrar).
 * - Mantener: el menú se abre bajo el dedo; arrastrás hasta la opción y al soltar se elige.
 */

export const OPCIONES_RADIAL = [
  { id: 'reel', label: 'Reel', icon: 'movie', to: '/crear/reel' },
  { id: 'post', label: 'Post', icon: 'photo_library', to: '/crear/publicacion' },
  { id: 'album', label: 'Álbum', icon: 'photo_album', to: '/albumes/nuevo' },
  { id: 'story', label: 'Story', icon: 'history_toggle_off', to: '/crear/story' },
] as const

const ANGULOS = [-146, -110, -70, -34] // grados; -90 = arriba
const RADIO = 116
const MANTENER_MS = 220
const MOVER_PX = 10
const ZONA_MUERTA = 44 // cerca del centro no se elige nada
const TOLERANCIA = 26 // grados alrededor de cada opción
const CIERRE_MS = 200 // salida del menú; usePresencia usa timer, así no depende de animationend
const POP_MS = 160 // pop del ítem elegido antes de navegar

type Modo = 'cerrado' | 'tocar' | 'arrastrar'

interface Centro {
  x: number
  y: number
}

/** Posición de cada opción relativa al centro del botón. */
export const posRadial = (i: number) => {
  const a = (ANGULOS[i] * Math.PI) / 180
  return { dx: Math.cos(a) * RADIO, dy: Math.sin(a) * RADIO }
}

/** Opción bajo el puntero, o -1. */
function opcionEn(c: Centro, x: number, y: number): number {
  const dx = x - c.x
  const dy = y - c.y
  if (Math.hypot(dx, dy) < ZONA_MUERTA) return -1
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI
  let mejor = -1
  let dist = TOLERANCIA
  ANGULOS.forEach((a, i) => {
    const d = Math.abs(((ang - a + 540) % 360) - 180)
    if (d < dist) {
      dist = d
      mejor = i
    }
  })
  return mejor
}

export function RadialCreate({ label }: { label: string }) {
  const navigate = useNavigate()
  const boton = useRef<HTMLButtonElement>(null)
  const [modo, setModo] = useState<Modo>('cerrado')
  const [centro, setCentro] = useState<Centro>({ x: 0, y: 0 })
  const [activa, setActiva] = useState(-1)
  const [elegida, setElegida] = useState(-1)
  const gesto = useRef({ abajo: false, x0: 0, y0: 0, timer: 0, abriendo: false })

  const medir = (): Centro => {
    const r = boton.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + 20 } : { x: 0, y: 0 }
  }
  const abiertoEn = useRef(0)
  const abrir = (m: Modo) => {
    abiertoEn.current = performance.now()
    setCentro(medir())
    setActiva(-1)
    setElegida(-1)
    setModo(m)
  }
  const cerrar = () => {
    setModo('cerrado')
    setActiva(-1)
  }
  // El click que sigue al pointerup que abrió el menú cae sobre el overlay: no debe cerrarlo.
  const cerrarDesdeOverlay = () => {
    if (performance.now() - abiertoEn.current > 350) cerrar()
  }
  const elegir = (i: number) => {
    vibrar('click')
    setElegida(i)
    cerrar()
    window.setTimeout(() => navigate(OPCIONES_RADIAL[i].to), POP_MS)
  }
  useEscape(cerrar, modo !== 'cerrado')
  useEffect(() => () => window.clearTimeout(gesto.current.timer), [])

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const g = gesto.current
    g.abajo = true
    g.x0 = e.clientX
    g.y0 = e.clientY
    g.abriendo = modo === 'cerrado'
    vibrar('tick')
    window.clearTimeout(g.timer)
    if (g.abriendo) {
      g.timer = window.setTimeout(() => {
        if (!g.abajo) return
        vibrar('heavy')
        abrir('arrastrar')
      }, MANTENER_MS)
    }
  }
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesto.current
    if (!g.abajo) return
    if (modo === 'cerrado' && g.abriendo && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > MOVER_PX) {
      window.clearTimeout(g.timer)
      vibrar('heavy')
      abrir('arrastrar')
      return
    }
    if (modo !== 'arrastrar') return
    const i = opcionEn(centro, e.clientX, e.clientY)
    if (i !== activa) {
      if (i >= 0) vibrar('tick')
      setActiva(i)
    }
  }
  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesto.current
    if (!g.abajo) return
    g.abajo = false
    window.clearTimeout(g.timer)
    if (modo === 'arrastrar') {
      const i = opcionEn(centro, e.clientX, e.clientY)
      if (i >= 0) elegir(i)
      else cerrar()
    } else if (modo === 'cerrado') abrir('tocar')
    else cerrar()
  }
  const onCancel = () => {
    gesto.current.abajo = false
    window.clearTimeout(gesto.current.timer)
    if (modo === 'arrastrar') cerrar()
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (modo === 'cerrado') abrir('tocar')
    else cerrar()
  }

  const abierto = modo !== 'cerrado'
  const { montado, cerrando } = usePresencia(abierto, CIERRE_MS)
  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        onKeyDown={onKey}
        onContextMenu={(e) => e.preventDefault()}
        className="radial-trigger flex h-full min-w-12 flex-1 flex-col items-center justify-center gap-1 text-on-surface-variant"
      >
        <span className={cn('radial-trigger-icon', abierto && 'is-open')}>
          <Icon name="add" size={26} />
        </span>
        <span className="type-label-s">{label}</span>
      </button>
      {montado &&
        createPortal(
          <div className="radial-menu fixed inset-0 z-50" data-modo={modo} data-cerrando={cerrando}>
            <div className="radial-scrim absolute inset-0 bg-scrim/45" aria-hidden="true" onClick={cerrarDesdeOverlay} />
            <div role="menu" aria-label="Crear" className="absolute" style={{ left: centro.x, top: centro.y }}>
              <span
                aria-hidden="true"
                className="radial-cuerda"
                data-on={modo === 'arrastrar' && activa >= 0}
                style={{ ['--ang' as string]: `${ANGULOS[Math.max(activa, 0)]}deg`, width: RADIO - 8 }}
              />
              <span aria-hidden="true" className="radial-core absolute -left-7 -top-7 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary">
                <span className="radial-core-icon flex">
                  <Icon name="close" size={26} />
                </span>
              </span>
              {OPCIONES_RADIAL.map((o, i) => {
                const { dx, dy } = posRadial(i)
                const on = activa === i
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="menuitem"
                    autoFocus={modo === 'tocar' && i === 0}
                    onClick={() => elegir(i)}
                    onPointerEnter={() => modo === 'tocar' && setActiva(i)}
                    onPointerLeave={() => modo === 'tocar' && setActiva(-1)}
                    className="radial-item absolute -left-8 -top-8 flex w-16 flex-col items-center gap-1"
                    data-activa={on}
                    data-elegida={elegida === i}
                    style={{ transform: `translate(${dx}px, ${dy}px)`, ['--i' as string]: i, ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }}
                  >
                    <span
                      className={cn(
                        'radial-bubble flex size-16 items-center justify-center rounded-full',
                        on ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface',
                      )}
                    >
                      <Icon name={o.icon} fill={on} size={28} />
                    </span>
                    <span className={cn('type-label-m emphasized rounded-full bg-surface-container-highest/90 px-2 py-0.5', on ? 'text-on-surface' : 'text-on-surface-variant')}>{o.label}</span>
                  </button>
                )
              })}
            </div>
            {/* El dedo sigue sobre el botón original; este solo cierra con un toque cuando el menú quedó abierto */}
            {modo === 'tocar' && (
              <button
                type="button"
                aria-label="Cerrar menú Crear"
                onClick={cerrarDesdeOverlay}
                className="absolute size-14 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: centro.x, top: centro.y }}
              />
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
