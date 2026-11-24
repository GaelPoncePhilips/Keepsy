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

/**
 * Bordes sólidos: rectángulo redondeado con esquinas de superelipse (n=4, continuidad G2), sin ondas ni gota.
 * Los puntos son densos en las esquinas para que el suavizado Catmull-Rom no las deforme.
 */
/** Rellena tramos largos con puntos cada ~6px: así el suavizado Catmull-Rom no se pasa de largo en las uniones. */
function densificar(pts: [number, number][]) {
  const out: [number, number][] = []
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length]
    const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / 6))
    for (let k = 0; k < n; k++) out.push([x + ((nx - x) * k) / n, y + ((ny - y) * k) / n])
  })
  pts.splice(0, pts.length, ...out)
}

function rectG2(g: Geo, p: number, xc: number): [number, number][] {
  const { y0, fondoGota } = bordes(g)
  const izq = 0
  const der = g.w
  const top = -40 // borde superior fuera de pantalla: arriba sin esquinas
  const base = y0 - 5 // hueco mínimo con la barra
  const r = R * 1.4 // esquinas de la lámina
  const rt = 20 // esquinas de la pestaña
  const f = 12 // curva cóncava donde la pestaña se une a la lámina
  const b = Math.min(38, g.w / 10 - 2) // semiancho de la pestaña
  const pts: [number, number][] = []
  // Superelipse n=4 (G2): |cos|^0.5 en vez de cos
  const sup = (cx: number, cy: number, rad: number, desde: number, hasta: number, filtro = (_x: number) => true) => {
    for (let k = 0; k <= 8; k++) {
      const a = desde + (k / 8) * (hasta - desde)
      const c = Math.cos(a)
      const sn = Math.sin(a)
      const x = cx + Math.sign(c) * Math.abs(c) ** 0.5 * rad
      if (filtro(x)) pts.push([x, cy + Math.sign(sn) * Math.abs(sn) ** 0.5 * rad])
    }
  }
  // Cerca de un borde, la esquina de la lámina y la curva de unión se achican de forma continua (k: 1 → 0)
  // y el lado de afuera de la pestaña se estira hasta el borde: sin saltos al moverse entre pestañas.
  const lado = (libre: number) => Math.min(1, Math.max(0, libre / (r + f)))
  const libreDer = der - (xc + b)
  const libreIzq = xc - b - izq
  const kDer = lado(libreDer)
  const kIzq = lado(libreIzq)
  const tDer = Math.min(der, xc + b + (1 - kDer) * Math.max(0, libreDer))
  const tIzq = Math.max(izq, xc - b - (1 - kIzq) * Math.max(0, libreIzq))
  const rDer = r * kDer
  const fDer = f * kDer
  const rIzq = r * kIzq
  const fIzq = f * kIzq
  sup(der - r, top + r, r, -Math.PI / 2, 0)
  pts.push([der, base - rDer])
  sup(der - rDer, base - rDer, rDer, 0, Math.PI / 2, (x) => x > tDer + fDer)
  sup(tDer + fDer, base + fDer, fDer, -Math.PI / 2, -Math.PI)
  sup(tDer - rt, fondoGota - rt, rt, 0, Math.PI / 2)
  sup(tIzq + rt, fondoGota - rt, rt, Math.PI / 2, Math.PI)
  sup(tIzq - fIzq, base + fIzq, fIzq, 0, -Math.PI / 2)
  sup(izq + rIzq, base - rIzq, rIzq, Math.PI / 2, Math.PI, (x) => x < tIzq - fIzq)
  pts.push([izq, base - rIzq])
  sup(izq + r, top + r, r, Math.PI, Math.PI * 1.5)
  for (const q of pts) q[0] = Math.min(der, Math.max(izq, q[0]))
  densificar(pts)
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
function Borde({ registrar, sufijo = 'a' }: { registrar: (el: SVGElement | null) => void; sufijo?: string }) {
  return (
    <>
      <defs>
        <clipPath id={`blob-clip-borde-${sufijo}`}>
          <path ref={registrar} data-blob="d" />
        </clipPath>
      </defs>
      <g clipPath={`url(#blob-clip-borde-${sufijo})`} fill="none" style={{ stroke: TINTE }}>
        {/* 8 trazos superpuestos: el tinte crece suave hacia el borde (sin escalones visibles) */}
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="22" />
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="16" />
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="11" />
        <path ref={registrar} data-blob="d" strokeOpacity="0.14" strokeWidth="6" />
        <path ref={registrar} data-blob="d" stroke="white" style={{ stroke: 'white' }} strokeOpacity="0.22" strokeWidth="3" />
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
 * Con lámina, una capa fija tapa todo lo que queda fuera del blob: nada se ve más allá del borde.
 */
export function NavBlob({ index, count, lamina = true, solido = false }: { index: number; count: number; lamina?: boolean; solido?: boolean }) {
  const nodos = useRef(new Set<SVGElement>())
  const [geo, setGeo] = useState<Geo | null>(null)
  const estado = useRef({ x: -1, v: 0, p: 0, pv: 0, raf: 0, ultimo: 0, y0: NaN })
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
      // en reposo basta ~20 fps
      if (!moviendo && now - st.ultimo < 48) return
      if (reducido && st.ultimo > 0) return
      st.ultimo = now
      const t = reducido ? 0 : now / 1000
      const estira = Math.min(22, Math.abs(st.v) * 0.02)
      const pts = !lamina ? gotaSuelta(g, st.x, solido ? 0 : t, estira) : solido ? rectG2(g, Math.min(1, st.p), st.x) : contorno(g, st.x, t, Math.min(1, st.p), estira)
      const d = suavizar(pts)
      if (barraMovida) {
        st.y0 = y0
        const svgB = document.getElementById('nav-blob-barra-svg')
        if (svgB) svgB.style.clipPath = `inset(${y0}px 0 0 0 round ${solido ? 0 : 28}px ${solido ? 0 : 28}px 0 0)`
      }
      for (const el of nodos.current) {
        if (!el.isConnected) {
          nodos.current.delete(el)
          continue
        }
        if (el.dataset.blob === 'd') el.setAttribute('d', d)
        else if (el.dataset.blob === 'fuera') el.setAttribute('d', `M-99,-99H${g.w + 99}V${g.h + 99}H-99Z${d}`)
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
      st.y0 = NaN
    }
  }, [geo, index, count, luces, lamina, solido])

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
        // Tapa lo que queda fuera del blob. Es fija (no un clip-path sobre el contenido que scrollea), así no se desfasa al scrollear.
        <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[11] h-full w-full md:hidden">
          <path ref={registrar} data-blob="fuera" fillRule="evenodd" fill="#080810" />
        </svg>
      )}
      {lamina && (
        // Por encima del contenido (z-10) y debajo de la topbar: el borde superior queda fuera de la vista.
        <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-[11] h-full w-full md:hidden" style={{ clipPath: solido ? undefined : 'inset(76px 0 0 0)' }}>
          <Borde registrar={registrar} />
        </svg>
      )}
      {/* Recortada a la barra con CSS: un clipPath SVG anidado con el de la forma se pinta mal */}
      <svg
        aria-hidden="true"
        id="nav-blob-barra-svg"
        className="barra-fija pointer-events-none fixed inset-0 z-[31] h-full w-full md:hidden"
        style={{ clipPath: `inset(${y0}px 0 0 0 round ${solido ? 0 : 28}px ${solido ? 0 : 28}px 0 0)` }}
      >
        <Vidrio sufijo="b" luces={luces} registrar={registrar} />
        {/* El filo también sobre la barra: si no, la pestaña del ítem activo no se lee como borde */}
        <Borde sufijo="b" registrar={registrar} />
      </svg>
    </>
  )
}

/** Self-check: para cada posición de la pestaña, contorno dentro de pantalla y sin saltos entre posiciones vecinas. */
export function __checkRectG2() {
  const g: Geo = { w: 375, h: 812, nav: 68, safe: 0 }
  let prev: [number, number][] | null = null
  for (let xc = 37.5; xc <= 337.5; xc += 1) {
    const pts = rectG2(g, 1, xc)
    for (const [x, y] of pts) if (!Number.isFinite(x) || !Number.isFinite(y) || x < -0.01 || x > g.w + 0.01) throw new Error(`fuera de rango en xc=${xc}`)
    if (prev) {
      // misma cantidad de tramos no se garantiza; comparamos el borde inferior de la pestaña
      const fondo = (ps: [number, number][]) => ps.filter(([, y]) => y > 790).map(([x]) => x)
      const a = fondo(prev)
      const b = fondo(pts)
      if (Math.abs(Math.min(...a) - Math.min(...b)) > 3 || Math.abs(Math.max(...a) - Math.max(...b)) > 3) throw new Error(`salto en xc=${xc}`)
    }
    prev = pts
  }
}
