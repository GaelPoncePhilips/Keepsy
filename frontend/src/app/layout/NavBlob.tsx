import { useEffect, useRef, useState } from 'react'
import { useLuces, type Luz } from '../../stores/luces'

/**
 * Lámina-blob de la pantalla (móvil), con vidrio propio. Una sola mancha orgánica cubre la pantalla
 * por encima de la barra inferior y gotea hasta la pestaña activa. Los bordes ondulan despacio y la
 * gota viaja con un resorte al cambiar de pestaña, estirándose con la velocidad.
 *
 * Vidrio propio (sin backdrop-filter ni filtros SVG, para que sea barato):
 * - Tinte: el color de la app.
 * - Highlights: un borde interior fino y una banda suave hacia adentro (trazos recortados a la forma).
 * - Focos: degradés radiales recortados a la forma. El principal nace del ícono activo y se derrama
 *   por todo el blob; los extra vienen de `useLuces` (cualquier color, cualquier pantalla).
 *
 * Un único `d` (~90 puntos) recalculado por rAF; en reposo ~20 fps y a 60 solo mientras la gota se
 * mueve. Se dibuja dos veces: debajo del contenido (lámina) y encima del fondo de la barra (recortada a
 * la barra, para que la gota quede entre el fondo y los íconos).
 */

interface Geo {
  w: number
  h: number
  nav: number
  safe: number
}

function leerGeo(): Geo {
  const css = getComputedStyle(document.documentElement)
  const nav = parseFloat(css.getPropertyValue('--nav-h')) || 68
  const probe = document.getElementById('nav-safe-probe')
  return { w: window.innerWidth, h: window.innerHeight, nav, safe: probe?.offsetHeight ?? 0 }
}

const R = 34 // radio de las esquinas inferiores

function bordes(g: Geo) {
  const y0 = g.h - g.nav - g.safe // borde superior de la barra
  const iconoY = y0 + g.nav / 2 - 8 // el ícono va arriba de su etiqueta
  return { y0, iconoY, fondoGota: y0 + g.nav - 4 }
}

/** Ruido suave barato: suma de senos desfasados. */
const onda = (a: number, t: number, k: number) => Math.sin(a * 0.021 * k + t * 0.7) * 3.2 + Math.sin(a * 0.053 * k - t * 1.1 + 1.7) * 2.1

/** Puntos del contorno. p (0→1) = expansión desde la gota; s = estiramiento por velocidad. */
function contorno(g: Geo, xc: number, t: number, p: number, s: number): [number, number][] {
  const { y0, iconoY, fondoGota } = bordes(g)
  const base = y0 - 14 // deja el hueco #080810 entre blob y barra
  const pts: [number, number][] = []
  const izq = (y: number) => 3 + onda(y, t, 0.6) * 0.8
  const der = (y: number) => g.w - 3 - onda(y + 300, t, 0.6) * 0.8
  const fondo = (x: number) => base + onda(x, t, 1)
  // Gota: cuello que se angosta y bulbo que rodea ícono + etiqueta (forma de metaball, no una función de x).
  const b = 30 + s // semiancho del bulbo
  const gota = (lado: -1 | 1): [number, number][] => {
    const q = (dx: number, y: number): [number, number] => [xc + lado * dx, y]
    const pts: [number, number][] = [
      q(b + 30, fondo(xc + lado * (b + 30)) + 1),
      q(b + 9, base + 7),
      q(b - 3, y0 + 4),
      q(b + 1, iconoY + 4),
      q(b - 6, fondoGota - 12),
    ]
    return lado === -1 ? pts : pts.reverse()
  }
  const desde = xc - b - 44
  const hasta = xc + b + 44
  const top = -12
  for (let y = top; y < base - R; y += 60) pts.push([izq(y), y])
  for (let k = 0; k <= 3; k++) {
    const a = (k / 3) * (Math.PI / 2)
    const x = izq(base) + R - Math.cos(a) * R
    if (k === 0 || x < desde) pts.push([x, base - R + Math.sin(a) * R])
  }
  let puesta = false
  const ponerGota = () => {
    if (!puesta) pts.push(...gota(-1), [xc, fondoGota], ...gota(1))
    puesta = true
  }
  for (let x = R + 8; x < g.w - R - 8; x += 9) {
    if (x >= desde) ponerGota()
    if (x > desde && x < hasta) continue
    pts.push([x, fondo(x)])
  }
  ponerGota()
  for (let k = 0; k <= 3; k++) {
    const a = (k / 3) * (Math.PI / 2)
    const x = der(base) - R + Math.sin(a) * R
    if (k === 3 || x > hasta) pts.push([x, base - R + Math.cos(a) * R])
  }
  for (let y = base - R - 30; y > top; y -= 60) pts.push([der(y), y])
  pts.push([der(top), top])
  if (p >= 1) return pts
  const e = Math.max(0, p)
  return pts.map(([x, y]) => [xc + (x - xc) * e, fondoGota + (y - fondoGota) * e])
}

/** Reels: sin lámina, la gota es una burbuja suelta dentro de la barra (no tiene de dónde colgar). */
function gotaSuelta(g: Geo, xc: number, t: number, s: number): [number, number][] {
  const { y0, fondoGota } = bordes(g)
  const cy = (y0 + 6 + fondoGota) / 2
  const rx = 30 + s
  const ry = (fondoGota - y0 - 6) / 2
  const pts: [number, number][] = []
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2
    const w = 1 + Math.sin(a * 3 + t * 0.9) * 0.035
    pts.push([xc + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w])
  }
  return pts
}

/** Catmull-Rom cerrado → beziers cúbicas: contorno suave sin esquinas. */
function suavizar(pts: [number, number][]): string {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

const centro = (g: Geo, i: number, n: number) => ((i + 0.5) * g.w) / n

const TINTE = 'color-mix(in srgb, var(--md-sys-color-surface) 62%, black)'

/**
 * Borde del vidrio, por ENCIMA del contenido: el contenido se funde con el tinte hacia el borde (no hay
 * corte brusco) y encima va el filo de luz. Trazos anchos recortados a la mitad interior = degradé barato.
 */
function Borde({ registrar }: { registrar: (el: SVGElement | null) => void }) {
  return (
    <>
      <defs>
        <clipPath id="blob-clip-borde">
          <path ref={registrar} data-blob="d" />
        </clipPath>
      </defs>
      <g clipPath="url(#blob-clip-borde)" fill="none" style={{ stroke: TINTE }}>
        {/* 8 trazos superpuestos: el tinte crece suave hacia el borde (sin escalones visibles) */}
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="22" />
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="16" />
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="11" />
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="6" />
        <path ref={registrar} data-blob="d" stroke="white" style={{ stroke: 'white' }} strokeOpacity="0.12" strokeWidth="2.5" />
      </g>
    </>
  )
}

const PRIMARY = 'var(--md-sys-color-primary)'
const PRIMARY_CONT = 'var(--md-sys-color-primary-container)'

/** Una capa completa del vidrio. `sufijo` separa los ids de las dos copias. */
function Vidrio({ sufijo, luces, registrar }: { sufijo: string; luces: Luz[]; registrar: (el: SVGElement | null) => void }) {
  const clip = `blob-clip-${sufijo}`
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path ref={registrar} data-blob="d" />
        </clipPath>
        <radialGradient id={`luz-main-${sufijo}`}>
          <stop offset="0" style={{ stopColor: PRIMARY, stopOpacity: 0.55 }} />
          <stop offset="0.4" style={{ stopColor: PRIMARY, stopOpacity: 0.3 }} />
          <stop offset="0.75" style={{ stopColor: PRIMARY_CONT, stopOpacity: 0.1 }} />
          <stop offset="1" style={{ stopColor: PRIMARY_CONT, stopOpacity: 0 }} />
        </radialGradient>
        {luces.map((l) => (
          <radialGradient key={l.id} id={`luz-${l.id}-${sufijo}`}>
            <stop offset="0" style={{ stopColor: l.color, stopOpacity: l.intensidad }} />
            <stop offset="0.45" style={{ stopColor: l.color, stopOpacity: l.intensidad * 0.35 }} />
            <stop offset="1" style={{ stopColor: l.color, stopOpacity: 0 }} />
          </radialGradient>
        ))}
      </defs>
      {/* Tinte */}
      <path ref={registrar} data-blob="d" fill="color-mix(in srgb, var(--md-sys-color-surface) 62%, black)" />
      <g clipPath={`url(#${clip})`}>
        {/* Focos */}
        <circle ref={registrar} data-blob="luz" r="70" fill={`url(#luz-main-${sufijo})`} />
        {luces.map((l) => (
          <circle key={l.id} cx={l.x} cy={l.y} r={l.radio} fill={`url(#luz-${l.id}-${sufijo})`} />
        ))}
      </g>
    </>
  )
}

/**
 * `lamina=false` (Reels): solo la gota dentro de la barra; el contenido queda entero y sin máscara.
 * Con lámina, el blob también recorta (máscara) al elemento `#contenido-blob`: nada se sale del borde.
 */
export function NavBlob({ index, count, lamina = true }: { index: number; count: number; lamina?: boolean }) {
  const nodos = useRef(new Set<SVGElement>())
  const [geo, setGeo] = useState<Geo | null>(null)
  const estado = useRef({ x: -1, v: 0, p: 0, pv: 0, raf: 0, ultimo: 0, top: NaN, left: NaN, y0: NaN })
  const objetivo = useRef(0)
  const luces = useLuces((s) => s.luces)
  const registrar = (el: SVGElement | null) => {
    if (el) nodos.current.add(el)
  }

  useEffect(() => {
    const medir = () => setGeo(leerGeo())
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  useEffect(() => {
    if (!geo) return
    const st = estado.current
    objetivo.current = centro(geo, Math.max(0, index), count)
    if (st.x < 0) st.x = objetivo.current
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches
    let prev = performance.now()

    const paso = (now: number) => {
      st.raf = requestAnimationFrame(paso)
      const dt = Math.min(0.032, (now - prev) / 1000)
      prev = now
      if (reducido) {
        st.x = objetivo.current
        st.p = 1
        st.v = st.pv = 0
      } else {
        st.v += ((objetivo.current - st.x) * 380 - st.v * 30) * dt
        st.x += st.v * dt
        st.pv += ((1 - st.p) * 150 - st.pv * 17) * dt
        st.p = Math.min(1.03, st.p + st.pv * dt)
      }
      // La geometría sale de la barra REAL: si el navegador la corre (barra de URL que aparece/desaparece
      // al scrollear), el blob la sigue en el mismo cuadro.
      const fb = document.getElementById('nav-barra-fondo')?.getBoundingClientRect()
      const g: Geo = fb && fb.height ? { ...geo, h: fb.bottom, safe: Math.max(0, fb.height - geo.nav) } : geo
      const { y0, iconoY } = bordes(g)
      const barraMovida = y0 !== st.y0
      const moviendo = Math.abs(st.v) > 2 || Math.abs(1 - st.p) > 0.002 || barraMovida
      const cont = lamina && window.innerWidth < 768 ? document.getElementById('contenido-blob') : null
      const caja = cont?.getBoundingClientRect()
      const desplazo = caja ? caja.top !== st.top || caja.left !== st.left : false
      // en reposo basta ~20 fps, salvo que el contenido se haya movido (scroll): la máscara no puede quedar atrás
      if (!moviendo && !desplazo && now - st.ultimo < 48) return
      if (reducido && st.ultimo > 0) return
      st.ultimo = now
      const t = reducido ? 0 : now / 1000
      const estira = Math.min(22, Math.abs(st.v) * 0.02)
      const pts = lamina ? contorno(g, st.x, t, Math.min(1, st.p), estira) : gotaSuelta(g, st.x, t, estira)
      const d = suavizar(pts)
      if (barraMovida) {
        st.y0 = y0
        const svgB = document.getElementById('nav-blob-barra-svg')
        if (svgB) svgB.style.clipPath = `inset(${y0}px 0 0 0 round 28px 28px 0 0)`
      }
      if (cont && caja) {
        st.top = caja.top
        st.left = caja.left
        // clip-path usa coordenadas del elemento: se corre el contorno por su posición en pantalla
        cont.style.clipPath = `path('${suavizar(pts.map(([x, y]) => [x - caja.left, y - caja.top]))}')`
      }
      for (const el of nodos.current) {
        if (!el.isConnected) {
          nodos.current.delete(el)
          continue
        }
        if (el.dataset.blob === 'd') el.setAttribute('d', d)
        else {
          el.setAttribute('cx', st.x.toFixed(1))
          el.setAttribute('cy', iconoY.toFixed(1))
        }
      }
    }
    cancelAnimationFrame(st.raf)
    st.ultimo = 0
    st.raf = requestAnimationFrame(paso)
    return () => {
      cancelAnimationFrame(st.raf)
      const cont = document.getElementById('contenido-blob')
      if (cont) cont.style.clipPath = ''
      st.top = st.left = st.y0 = NaN
    }
  }, [geo, index, count, luces, lamina])

  const y0 = geo ? bordes(geo).y0 : 0
  return (
    <>
      <span id="nav-safe-probe" aria-hidden="true" className="pointer-events-none fixed bottom-0 h-[env(safe-area-inset-bottom)] w-0" />
      {lamina && (
        <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full md:hidden">
          <Vidrio sufijo="a" luces={luces} registrar={registrar} />
        </svg>
      )}
      {lamina && (
        // Por encima del contenido (z-10) y debajo de la topbar: el borde superior queda fuera de la vista.
        <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[11] h-full w-full md:hidden" style={{ clipPath: 'inset(76px 0 0 0)' }}>
          <Borde registrar={registrar} />
        </svg>
      )}
      {/* Recortada a la barra con CSS: un clipPath SVG anidado con el de la forma se pinta mal */}
      <svg
        aria-hidden="true"
        id="nav-blob-barra-svg"
        className="barra-fija pointer-events-none fixed inset-0 z-[31] h-full w-full md:hidden"
        style={{ clipPath: `inset(${y0}px 0 0 0 round 28px 28px 0 0)` }}
      >
        <Vidrio sufijo="b" luces={luces} registrar={registrar} />
      </svg>
    </>
  )
}
