import { useEffect, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Sheet } from '../../components/ui/Overlay'
import { buscarUsuarios } from '../../services/temporal'
import type { UsuarioResumen } from '../../types/api'

/** Buscador de usuarios para etiquetar (agrega `@username` a la descripción). */
export function EtiquetarSheet({ open, onClose, onElegir }: { open: boolean; onClose: () => void; onElegir: (u: UsuarioResumen) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<UsuarioResumen[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    const t = q.trim()
    if (!open || !t) return
    let vigente = true
    const h = window.setTimeout(() => {
      buscarUsuarios(t, { limit: 20 })
        .then((r) => {
          if (vigente) {
            setRes(r)
            setError(false)
          }
        })
        .catch(() => {
          if (vigente) setError(true)
        })
    }, 200)
    return () => {
      vigente = false
      window.clearTimeout(h)
    }
  }, [q, open])

  const lista = q.trim() ? res : []
  return (
    <Sheet open={open} onClose={onClose} title="Etiquetar personas">
      <div className="p-4">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar usuarios"
          aria-label="Buscar usuarios"
          className="type-body-l h-12 w-full rounded-full bg-surface-container-high px-4 outline-none focus:ring-2 focus:ring-primary"
        />
        {error && <p className="type-body-m mt-4 text-error">No se pudo buscar. Probá de nuevo.</p>}
        {!error && q.trim() && lista.length === 0 && <p className="type-body-m mt-4 text-on-surface-variant">Sin resultados.</p>}
        <ul className="mt-2">
          {lista.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="state flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
                onClick={() => {
                  onElegir(u)
                  setQ('')
                  onClose()
                }}
              >
                <Avatar username={u.username} size={40} />
                <span className="min-w-0">
                  <span className="type-label-l emphasized block truncate">{u.username}</span>
                  <span className="type-body-s block truncate text-on-surface-variant">{u.nombre}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
