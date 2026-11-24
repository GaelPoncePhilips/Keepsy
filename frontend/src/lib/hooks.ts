import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ApiError } from '../services/client'

/** Une clases condicionales. */
export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}

/**
 * Caché "stale-while-revalidate" en memoria: al volver a una pantalla se muestran al instante los datos
 * de la última visita (sin pantalla de carga) y se revalidan en segundo plano.
 * La clave sale del código de la función + sus deps; se vacía al cambiar de sesión.
 */
const cacheDatos = new Map<string, unknown>()
const MAX_CACHE = 200

export function limpiarCache(): void {
  cacheDatos.clear()
}

function claveDe(fn: { toString: () => string }, deps: readonly unknown[], extra = ''): string | null {
  try {
    return `${extra}|${fn.toString()}|${JSON.stringify(deps)}`
  } catch {
    return null
  }
}

function guardarCache(clave: string | null, valor: unknown): void {
  if (!clave) return
  if (cacheDatos.size >= MAX_CACHE) {
    const primera = cacheDatos.keys().next().value
    if (primera !== undefined) cacheDatos.delete(primera)
  }
  cacheDatos.set(clave, valor)
}

export interface AsyncState<T> {
  data: T | undefined
  error: ApiError | Error | null
  loading: boolean
  reload: () => void
  setData: (updater: T | ((prev: T | undefined) => T)) => void
}

/** Carga datos con estados de carga/error. `deps` vuelve a ejecutar la carga. */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const clave = claveDe(fn, deps)
  const enCache = clave !== null && cacheDatos.has(clave)
  const [data, setDataState] = useState<T | undefined>(() => (enCache && clave ? (cacheDatos.get(clave) as T) : undefined))
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [loading, setLoading] = useState(!enCache)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  const claveRef = useRef(clave)
  useEffect(() => {
    fnRef.current = fn
    claveRef.current = clave
  })

  useEffect(() => {
    let vivo = true
    const k = claveRef.current
    const hit = k !== null && cacheDatos.has(k)
    // Con datos en caché se muestran ya (sin loader) y se revalida por detrás.
    if (hit && k) setDataState(cacheDatos.get(k) as T)
    setLoading(!hit)
    setError(null)
    fnRef
      .current()
      .then((d) => {
        if (!vivo) return
        guardarCache(k, d)
        setDataState(d)
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (vivo) setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const setData = useCallback((u: T | ((prev: T | undefined) => T)) => {
    setDataState((prev) => {
      const nuevo = typeof u === 'function' ? (u as (p: T | undefined) => T)(prev) : u
      guardarCache(claveRef.current, nuevo)
      return nuevo
    })
  }, [])
  return { data, error, loading, reload, setData }
}

export interface InfiniteState<T> {
  items: T[]
  error: ApiError | Error | null
  loading: boolean
  done: boolean
  loadMore: () => void
  reload: () => void
  setItems: (updater: (prev: T[]) => T[]) => void
  /** Ref para el elemento centinela: al verse, carga la siguiente página. */
  sentinelRef: (el: HTMLElement | null) => void
}

/** Scroll infinito por limit/offset (limit máx. 50). Termina cuando una página trae menos de `limit`. */
export function useInfinite<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  deps: readonly unknown[],
  limit = 12,
): InfiniteState<T> {
  const clave = claveDe(fetchPage, deps, 'inf')
  const inicial = clave !== null ? (cacheDatos.get(clave) as { items: T[]; done: boolean } | undefined) : undefined
  const [items, setItemsState] = useState<T[]>(() => inicial?.items ?? [])
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(() => inicial?.done ?? false)
  const [gen, setGen] = useState(0)
  const fetchRef = useRef(fetchPage)
  const claveRef = useRef(clave)
  useEffect(() => {
    fetchRef.current = fetchPage
    claveRef.current = clave
  })
  const state = useRef({ offset: 0, loading: false, done: false, gen: 0 })
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
    const k = claveRef.current
    if (k && items.length > 0) guardarCache(k, { items, done: state.current.done })
  }, [items, done])
  const observer = useRef<IntersectionObserver | null>(null)

  const loadMore = useCallback(() => {
    const s = state.current
    if (s.loading || s.done) return
    s.loading = true
    setLoading(true)
    const myGen = s.gen
    fetchRef
      .current(s.offset, limit)
      .then((page) => {
        if (myGen !== state.current.gen) return
        s.offset += page.length
        if (page.length < limit) {
          s.done = true
          setDone(true)
        }
        setItemsState((prev) => [...prev, ...page])
        setError(null)
      })
      .catch((e: unknown) => {
        if (myGen === state.current.gen) setError(e instanceof Error ? e : new Error(String(e)))
      })
      .finally(() => {
        if (myGen === state.current.gen) {
          s.loading = false
          setLoading(false)
        }
      })
  }, [limit])

  useEffect(() => {
    state.current = { offset: 0, loading: false, done: false, gen: state.current.gen + 1 }
    const k = claveRef.current
    const hit = k !== null ? (cacheDatos.get(k) as { items: T[]; done: boolean } | undefined) : undefined
    setError(null)
    if (hit && hit.items.length > 0) {
      // Pantalla instantánea con lo de la última visita; se refresca la primera tanda por detrás.
      const myGen = state.current.gen
      const n = Math.min(50, Math.max(limit, hit.items.length))
      setItemsState(hit.items)
      setDone(hit.done)
      state.current.offset = hit.items.length
      state.current.done = hit.done
      fetchRef
        .current(0, n)
        .then((page) => {
          if (myGen !== state.current.gen) return
          const resto = hit.items.slice(page.length)
          const nuevos = page.length >= hit.items.length ? page : [...page, ...resto]
          state.current.offset = nuevos.length
          if (page.length < n) {
            state.current.done = true
            setDone(true)
          }
          setItemsState(nuevos)
        })
        .catch(() => undefined)
      return
    }
    setItemsState([])
    setDone(false)
    loadMore()
  }, [...deps, gen])

  const sentinelRef = useCallback(
    (el: HTMLElement | null) => {
      observer.current?.disconnect()
      if (!el) return
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) loadMore()
        },
        { rootMargin: '600px' },
      )
      observer.current.observe(el)
    },
    [loadMore],
  )

  return {
    items,
    error,
    loading,
    done,
    loadMore,
    reload: () => setGen((g) => g + 1),
    setItems: (u) => setItemsState(u),
    sentinelRef,
  }
}

function subscribeMq(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscribeMq(query), () => window.matchMedia(query).matches)
}

/** Breakpoints: móvil < 768, tablet 768–1023, escritorio ≥ 1024. */
export const useIsMobile = () => !useMediaQuery('(min-width: 768px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

/** Escape cierra (modales, sheets, visores). */
export function useEscape(onEscape: () => void, active = true): void {
  const ref = useRef(onEscape)
  useEffect(() => {
    ref.current = onEscape
  })
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active])
}
