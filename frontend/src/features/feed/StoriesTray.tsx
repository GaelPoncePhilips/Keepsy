import { useState } from 'react'
import { Link } from 'react-router'
import type { Anillo } from '../../components/ui/Avatar'
import { Icon } from '../../components/ui/Icon'
import { useAsync } from '../../lib/hooks'
import { formaPara, formaPorNombre } from '../../lib/formasM3'
import * as storiesApi from '../../services/stories'
import { avatarUrl } from '../../services/temporal/local'
import { useYo } from '../../stores/session'
import type { StoriesDeUsuario } from '../../types/api'

const HUECO = 68
const ANILLO = 76 // hueco + 8px: 2.5px de anillo + 1.5px de separación por lado

function anilloDe(s: StoriesDeUsuario): Anillo {
  if (s.todas_vistas) return 'visto'
  if (s.stories.some((x) => !x.vista && x.solo_mejores_amigos)) return 'amigos'
  return 'sin-ver'
}

const FONDO_ANILLO: Partial<Record<Anillo, string>> = {
  'sin-ver': 'color-mix(in srgb, var(--md-sys-color-on-surface) 85%, transparent)',
  amigos: 'var(--keepsy-amigos)',
}

/** Hueco con forma en el vidrio: foto recortada + borde interior; con anillo opcional. */
function Hueco({ username, forma, anillo }: { username: string; forma: string; anillo: Anillo }) {
  const [fallo, setFallo] = useState(false)
  const url = avatarUrl(username)
  const fondo = FONDO_ANILLO[anillo]
  return (
    <span className="relative isolate flex items-center justify-center">
    {/* La foto sigue "detrás" del vidrio: se ve difusa alrededor del hueco */}
    {url && !fallo && (
      <img
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="pointer-events-none absolute -inset-1 -z-10 size-[calc(100%+8px)] max-w-none rounded-full object-cover opacity-50 blur-[8px]"
      />
    )}
    <span
      className="flex items-center justify-center"
      style={{ width: ANILLO, height: ANILLO, clipPath: fondo ? forma : undefined, background: fondo }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: fondo ? ANILLO - 5 : HUECO,
          height: fondo ? ANILLO - 5 : HUECO,
          clipPath: forma,
          background: fondo ? 'var(--md-sys-color-surface-container)' : undefined,
        }}
      >
        <span className="relative block bg-surface-container-highest" style={{ width: HUECO, height: HUECO, clipPath: forma }}>
          {url && !fallo ? (
            <img
              src={url}
              alt={`Foto de perfil de ${username}`}
              width={HUECO}
              height={HUECO}
              loading="lazy"
              className="size-full object-cover"
              onError={() => setFallo(true)}
            />
          ) : (
            <span className="flex size-full items-center justify-center text-2xl font-bold text-on-surface" role="img" aria-label={username}>
              {username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ clipPath: forma, boxShadow: 'inset 0 2px 6px rgb(0 0 0 / .45), inset 0 0 0 1px rgb(255 255 255 / .10)' }}
          />
        </span>
      </span>
    </span>
    </span>
  )
}

const ITEM = 'flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Fila de stories del inicio: la propia primero, luego las de seguidos. */
export function StoriesTray() {
  const yo = useYo()
  const seguidos = useAsync(() => storiesApi.storiesDeSeguidos(yo.id), [yo.id])
  const mias = useAsync(() => storiesApi.storiesPublicadas(yo.id), [yo.id])
  const tengo = (mias.data?.length ?? 0) > 0

  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-4" role="list" aria-label="Stories">
      <div role="listitem" className="relative flex w-20 shrink-0 flex-col items-center gap-1.5">
        <Link
          to={tengo ? `/stories/${yo.id}` : '/crear/story'}
          aria-label={tengo ? 'Ver tu story' : 'Crear story'}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Hueco username={yo.username} forma={formaPorNombre('circle')} anillo={tengo ? 'visto' : 'ninguno'} />
        </Link>
        <Link
          to="/crear/story"
          aria-label="Crear story"
          className="absolute top-[52px] right-[2px] flex size-6 items-center justify-center rounded-full bg-primary text-on-primary ring-[3px] ring-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Icon name="add" size={16} />
        </Link>
        <span className="type-label-s w-full truncate text-center text-on-surface-variant">Tu story</span>
      </div>
      {seguidos.loading && !seguidos.data
        ? Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex w-20 shrink-0 flex-col items-center gap-1.5" aria-hidden="true">
              <span className="rounded-full bg-surface-container-highest" style={{ width: HUECO, height: HUECO, margin: 4 }} />
              <span className="h-3 w-12 rounded-xs bg-surface-container-highest" />
            </div>
          ))
        : (seguidos.data ?? []).map((s) => {
            const anillo = anilloDe(s)
            return (
              <Link
                key={s.usuario.id}
                role="listitem"
                to={`/stories/${s.usuario.id}`}
                className={`${ITEM} transition-transform spring-spatial-fast active:scale-95`}
                aria-label={`Story de ${s.usuario.username}`}
              >
                <Hueco username={s.usuario.username} forma={formaPara(s.usuario.username)} anillo={anillo} />
                <span
                  className={`type-label-s w-full truncate text-center ${anillo === 'visto' ? 'text-on-surface-variant' : 'font-semibold text-on-surface'}`}
                >
                  {s.usuario.username}
                </span>
              </Link>
            )
          })}
    </div>
  )
}
