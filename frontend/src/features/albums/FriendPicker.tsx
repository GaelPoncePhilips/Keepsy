import { useEffect, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { InputChip, SearchBar } from '../../components/ui/Controls'
import { LoadingShape } from '../../components/ui/Feedback'
import { Icon } from '../../components/ui/Icon'
import { cn, useAsync } from '../../lib/hooks'
import { seguidores } from '../../services/usuarios'
import { useYo } from '../../stores/session'
import type { UsuarioResumen } from '../../types/api'

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Seguidores aceptados (hasta 500, de a 50). */
async function todosLosSeguidores(id: number): Promise<UsuarioResumen[]> {
  const out: UsuarioResumen[] = []
  for (let offset = 0; offset < 500; offset += 50) {
    const pag = await seguidores(id, { limit: 50, offset })
    out.push(...pag)
    if (pag.length < 50) break
  }
  return out
}

/**
 * Elegir a quién invitar, con buscador y chips de entrada (M3). Solo se puede invitar a quienes te siguen.
 * `excluir`: ids que ya están en el álbum.
 */
export function FriendPicker({
  value,
  onChange,
  excluir = [],
}: {
  value: UsuarioResumen[]
  onChange: (v: UsuarioResumen[]) => void
  excluir?: number[]
}) {
  const yo = useYo()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])
  const sugeridos = useAsync(() => todosLosSeguidores(yo.id), [yo.id])
  const qn = normalizar(debounced)
  const lista = (sugeridos.data ?? []).filter(
    (u) => !qn || normalizar(u.username).includes(qn) || normalizar(u.nombre).includes(qn),
  )
  const elegidos = new Set(value.map((u) => u.id))
  const toggle = (u: UsuarioResumen) => onChange(elegidos.has(u.id) ? value.filter((x) => x.id !== u.id) : [...value, u])
  const cargando = sugeridos.loading

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Elegidos">
          {value.map((u) => (
            <InputChip key={u.id} label={u.username} avatar={<Avatar username={u.username} size={24} alt="" />} onRemove={() => toggle(u)} />
          ))}
        </div>
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Buscar entre tus seguidores" />
      <p className="type-label-l px-1 text-on-surface-variant">{debounced ? 'Resultados entre tus seguidores' : 'Tus seguidores'}</p>
      {cargando && !lista.length ? (
        <div className="flex justify-center py-6">
          <LoadingShape />
        </div>
      ) : (
        <ul className="flex flex-col">
          {lista
            .filter((u) => u.id !== yo.id && !excluir.includes(u.id))
            .map((u) => {
              const on = elegidos.has(u.id)
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(u)}
                    className="state flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                  >
                    <Avatar username={u.username} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="type-label-l emphasized block truncate">{u.username}</span>
                      <span className="type-body-m block truncate text-on-surface-variant">{u.nombre}</span>
                    </span>
                    <span
                      className={cn(
                        'flex size-6 items-center justify-center rounded-full border-2 transition-all spring-spatial-fast',
                        on ? 'border-primary bg-primary text-on-primary' : 'border-outline',
                      )}
                    >
                      {on && <Icon name="check" size={16} />}
                    </span>
                  </button>
                </li>
              )
            })}
          {!cargando && lista.length === 0 && (
            <li className="type-body-m px-2 py-4 text-center text-on-surface-variant">
              {debounced ? 'Ninguno de tus seguidores coincide con esa búsqueda.' : 'Todavía nadie te sigue. Solo podés invitar a tus seguidores.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
