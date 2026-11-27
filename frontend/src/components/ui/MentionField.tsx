import type { KeyboardEvent, RefObject } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/hooks'
import { buscarUsuarios } from '../../services/temporal'
import { seguidos } from '../../services/usuarios'
import { useYo } from '../../stores/session'
import type { UsuarioResumen } from '../../types/api'
import { Avatar } from './Avatar'

/** Token `@algo` justo antes del cursor (el `@` debe ir al inicio o tras un separador). */
const TOKEN = /(^|[^\p{L}\p{N}_.@])@([\p{L}\p{N}_.]*)$/u
const LIMITE = 6
const DEBOUNCE_MS = 200

interface Token {
  /** Índice del `@` en el texto. */
  inicio: number
  /** Índice del cursor (fin del token). */
  fin: number
  /** Texto después del `@` (puede ser vacío). */
  q: string
}

function tokenEn(value: string, cursor: number): Token | null {
  const m = TOKEN.exec(value.slice(0, cursor))
  if (!m) return null
  const q = m[2]
  return { inicio: cursor - q.length - 1, fin: cursor, q }
}

export interface MencionesApi {
  /** Usuarios sugeridos para el token actual (máx. 6). */
  sugerencias: UsuarioResumen[]
  /** true si hay un token `@…` bajo el cursor y al menos una sugerencia. */
  abierto: boolean
  /** Índice de la sugerencia resaltada (navegable con ↑↓). */
  activo: number
  /** Reemplaza el token por `@username ` y deja el cursor después. */
  elegir: (u: UsuarioResumen) => void
  /** Conectalo al `onKeyDown` del campo: ↑↓ navegan, Enter/Tab eligen, Escape cierra. */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  /** Cierra la lista hasta que se vuelva a escribir. */
  cerrar: () => void
}

/**
 * Autocompletado de @menciones para un input/textarea controlado.
 * Detecta el token `@algo` bajo el cursor, busca con `buscarUsuarios` (debounce 200 ms)
 * y con `@` solo sugiere a los seguidos del usuario logueado.
 *
 * Si `onKeyDown` consume la tecla llama a `preventDefault()`; chequeá `e.defaultPrevented`
 * antes de manejar Enter por tu cuenta.
 */
export function useMenciones(
  value: string,
  setValue: (v: string) => void,
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
): MencionesApi {
  const yo = useYo()
  const [cursor, setCursor] = useState<number | null>(null)
  const [sugerencias, setSugerencias] = useState<UsuarioResumen[]>([])
  const [activo, setActivo] = useState(0)
  const [cerradoEn, setCerradoEn] = useState<string | null>(null)

  // Sigue la posición del cursor del campo.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Diferido: este listener nativo corre antes que el onChange de React; actualizar el estado acá
    // re-renderizaba con el valor viejo y React borraba lo que se acababa de escribir.
    const leer = () => window.setTimeout(() => setCursor(document.activeElement === el ? el.selectionStart : null), 0)
    const salir = () => window.setTimeout(() => setCursor(null), 150)
    const evs = ['input', 'click', 'keyup', 'focus', 'select'] as const
    evs.forEach((ev) => el.addEventListener(ev, leer))
    el.addEventListener('blur', salir)
    return () => {
      evs.forEach((ev) => el.removeEventListener(ev, leer))
      el.removeEventListener('blur', salir)
    }
  }, [ref])

  const token = cursor === null ? null : tokenEn(value, Math.min(cursor, value.length))
  const clave = token ? `${token.inicio}:${token.q}` : null
  const q = token?.q ?? null

  useEffect(() => {
    if (q === null) return
    let vigente = true
    const t = window.setTimeout(() => {
      const pedido = q === '' ? seguidos(yo.id, { limit: LIMITE }) : buscarUsuarios(q, { limit: LIMITE })
      pedido
        .then((r) => {
          if (!vigente) return
          setSugerencias(r.filter((u) => u.id !== yo.id).slice(0, LIMITE))
          setActivo(0)
        })
        .catch(() => {
          if (vigente) setSugerencias([])
        })
    }, DEBOUNCE_MS)
    return () => {
      vigente = false
      window.clearTimeout(t)
    }
  }, [q, yo.id])

  const abierto = clave !== null && clave !== cerradoEn && sugerencias.length > 0

  const elegir = useCallback(
    (u: UsuarioResumen) => {
      if (!token) return
      const insertado = `@${u.username} `
      const despues = value.slice(token.fin).replace(/^[\p{L}\p{N}_.]*\s?/u, '')
      const nuevo = value.slice(0, token.inicio) + insertado + despues
      const pos = token.inicio + insertado.length
      setValue(nuevo)
      setSugerencias([])
      setCursor(pos)
      window.requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        el.focus()
        el.setSelectionRange(pos, pos)
      })
    },
    [token, value, setValue, ref],
  )

  const cerrar = useCallback(() => setCerradoEn(clave), [clave])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!abierto) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => (i + 1) % sugerencias.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const u = sugerencias[Math.min(activo, sugerencias.length - 1)]
      if (u) {
        e.preventDefault()
        elegir(u)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      cerrar()
    }
  }

  return { sugerencias, abierto, activo, elegir, onKeyDown, cerrar }
}

export interface SugerenciasMencionProps {
  /** Estado devuelto por `useMenciones`. */
  menciones: MencionesApi
  /** Hacia dónde se abre la lista respecto del campo (el contenedor debe ser `relative`). */
  lado?: 'arriba' | 'abajo'
  /** id del listbox (para `aria-controls` en el campo). */
  id?: string
  className?: string
}

/** Lista flotante de sugerencias de @mención. Se posiciona absoluta sobre/bajo el contenedor `relative`. */
export function SugerenciasMencion({ menciones, lado = 'abajo', id, className }: SugerenciasMencionProps) {
  const { abierto, sugerencias, activo, elegir } = menciones
  if (!abierto) return null
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Sugerencias de mención"
      className={cn(
        'anim-scale-in absolute right-0 left-0 z-40 max-h-72 overflow-y-auto rounded-lg bg-surface-container-high py-1 shadow-lg',
        lado === 'arriba' ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top',
        className,
      )}
    >
      {sugerencias.map((u, i) => (
        <li
          key={u.id}
          role="option"
          aria-selected={i === activo}
          // mousedown para que el campo no pierda el foco antes de elegir
          onMouseDown={(e) => {
            e.preventDefault()
            elegir(u)
          }}
          className={cn('state flex cursor-pointer items-center gap-3 px-3 py-2', i === activo && 'bg-on-surface/8')}
        >
          <Avatar username={u.username} size={32} />
          <span className="min-w-0">
            <span className="type-label-l emphasized block truncate">{u.username}</span>
            <span className="type-body-s block truncate text-on-surface-variant">{u.nombre}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export interface MentionFieldProps {
  value: string
  onChange: (v: string) => void
  /** Con label se ve como `TextField` (outlined con label flotante); sin label es un campo "desnudo". */
  label?: string
  placeholder?: string
  /** textarea en vez de input. */
  multiline?: boolean
  maxLength?: number
  autoFocus?: boolean
  /** Clases del contenedor (relative). */
  className?: string
  /** Clases extra del input/textarea. */
  inputClassName?: string
  /** Enter sin Shift (y sin sugerencia abierta) llama a esto en vez de insertar salto de línea. */
  onEnter?: () => void
  ariaLabel?: string
  /** Hacia dónde se abren las sugerencias (default: 'abajo'). */
  lado?: 'arriba' | 'abajo'
  /** Texto de ayuda bajo el campo (solo con label). */
  hint?: string
}

/** Campo de texto con autocompletado de @menciones. */
export function MentionField({
  value,
  onChange,
  label,
  placeholder,
  multiline,
  maxLength,
  autoFocus,
  className,
  inputClassName,
  onEnter,
  ariaLabel,
  lado = 'abajo',
  hint,
}: MentionFieldProps) {
  const id = useId()
  const listId = `${id}-menciones`
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const menciones = useMenciones(value, onChange, ref)
  // Con autoFocus el cursor va al final (al editar un texto existente).
  useEffect(() => {
    const el = ref.current
    if (autoFocus && el) el.setSelectionRange(el.value.length, el.value.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    menciones.onKeyDown(e)
    if (!e.defaultPrevented && e.key === 'Enter' && !e.shiftKey && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }
  const comun = {
    id,
    value,
    maxLength,
    autoFocus,
    onKeyDown,
    'aria-label': ariaLabel ?? label,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': menciones.abierto,
    'aria-controls': menciones.abierto ? listId : undefined,
    placeholder: label ? ' ' : placeholder,
  }
  const clases = label
    ? cn('peer w-full rounded-xs border border-outline bg-transparent px-4 pt-5 pb-2 type-body-l outline-none transition-colors focus:border-2 focus:border-primary', inputClassName)
    : cn('w-full bg-transparent outline-none placeholder:text-on-surface-variant', inputClassName)
  const campo = multiline ? (
    <textarea
      {...comun}
      ref={(el) => {
        ref.current = el
      }}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      className={cn(clases, 'resize-none')}
    />
  ) : (
    <input
      {...comun}
      ref={(el) => {
        ref.current = el
      }}
      onChange={(e) => onChange(e.target.value)}
      className={clases}
    />
  )
  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        {campo}
        {label && (
          <label htmlFor={id} className="pointer-events-none absolute top-1.5 left-4 type-body-s text-on-surface-variant transition-all peer-focus:text-primary">
            {label}
          </label>
        )}
        <SugerenciasMencion menciones={menciones} lado={lado} id={listId} />
      </div>
      {label && (hint || maxLength !== undefined) && (
        <div className="mt-1 flex justify-between gap-2 px-4 type-body-s text-on-surface-variant">
          <span>{hint ?? ''}</span>
          {maxLength !== undefined && (
            <span>
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
