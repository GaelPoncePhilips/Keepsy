import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { clicConZoom } from '../../lib/transicion'
import { Button, ButtonGroup } from '../../components/ui/Button'
import { EmptyState, ErrorState } from '../../components/ui/Feedback'
import { Icon } from '../../components/ui/Icon'
import { cn, useAsync } from '../../lib/hooks'
import { emitirInvitacionAlbum, useEventoInvitacionAlbum } from '../../lib/eventos'
import * as albumsApi from '../../services/albums'
import { mensajeDeError } from '../../services/client'
import { useBadges } from '../../stores/badges'
import { useYo } from '../../stores/session'
import { snackbar } from '../../stores/ui'
import type { Album, AlbumItem } from '../../types/api'
import { AvatarStack, contarMedia, miembrosAceptados } from './common'

interface AlbumConItems {
  album: Album
  items: AlbumItem[]
  pendiente: boolean
}

async function cargar(usuarioId: number, esPropio: boolean): Promise<AlbumConItems[]> {
  const [albums, invitaciones] = await Promise.all([
    albumsApi.albumsDeUsuario(usuarioId),
    esPropio ? albumsApi.invitacionesAlbum(usuarioId) : Promise.resolve<Album[]>([]),
  ])
  const todos = [...invitaciones.map((a) => ({ a, pendiente: true })), ...albums.filter((a) => !invitaciones.some((i) => i.id === a.id)).map((a) => ({ a, pendiente: false }))]
  return Promise.all(
    todos.map(async ({ a, pendiente }) => ({
      album: a,
      pendiente,
      items: await albumsApi.itemsDeAlbum(a.id).catch(() => [] as AlbumItem[]),
    })),
  )
}

/** Pestaña Álbumes del perfil: portadas cuadradas, 2 columnas en móvil y 3 en escritorio. */
export function AlbumsTab({ usuarioId, esPropio }: { usuarioId: number; esPropio: boolean }) {
  const { data, error, loading, reload, setData } = useAsync(() => cargar(usuarioId, esPropio), [usuarioId, esPropio])
  const navigate = useNavigate()
  const respondida = (albumId: number, aceptada: boolean) =>
    setData((prev) =>
      (prev ?? [])
        .map((y) => (y.album.id === albumId ? { ...y, pendiente: false } : y))
        .filter((y) => y.album.id !== albumId || aceptada),
    )
  // Respondida desde otra pantalla (notificaciones, álbum): se refleja sin recargar.
  useEventoInvitacionAlbum((d) => respondida(d.albumId, d.aceptada))

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading && !data)
    return (
      <div className="grid grid-cols-2 gap-3 pt-3 md:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xs bg-surface-container-high" />
        ))}
      </div>
    )
  const lista = data ?? []

  return (
    <div className="pt-3">
      {lista.length === 0 ? (
        <EmptyState
          icon="photo_album"
          title={esPropio ? 'Álbumes compartidos' : 'Sin álbumes'}
          text={
            esPropio
              ? 'Creá un álbum e invitá a tus amigos: todos suben fotos y videos al mismo lugar.'
              : 'Cuando participe en álbumes compartidos, vas a verlos acá.'
          }
          action={
            esPropio ? (
              <Button icon="add" onClick={() => navigate('/albumes/nuevo')}>
                Nuevo álbum
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {lista.some((x) => x.pendiente) && (
            <ul className="mb-5 flex flex-col gap-3" aria-label="Invitaciones a álbumes">
              {lista
                .filter((x) => x.pendiente)
                .map((x) => (
                  <li key={x.album.id}>
                    <InvitacionCard {...x} />
                  </li>
                ))}
            </ul>
          )}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3">
            {lista
              .filter((x) => !x.pendiente)
              .map((x) => (
                <li key={x.album.id}>
                  <AlbumCard {...x} />
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  )
}

function useResponder(album: Album) {
  const yo = useYo()
  const [busy, setBusy] = useState(false)
  const responder = async (aceptar: boolean) => {
    setBusy(true)
    try {
      if (aceptar) await albumsApi.aceptarInvitacion(album.id)
      else await albumsApi.quitarMiembro(album.id, yo.id)
      snackbar(aceptar ? `Te uniste a «${album.titulo}»` : 'Invitación rechazada')
      emitirInvitacionAlbum({ albumId: album.id, aceptada: aceptar })
      void useBadges.getState().refrescar()
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, responder }
}

/** Invitación pendiente: tarjeta a todo el ancho, arriba de los álbumes. */
function InvitacionCard({ album, items }: AlbumConItems) {
  const navigate = useNavigate()
  const { busy, responder } = useResponder(album)
  const miembros = miembrosAceptados(album)
  const portada = album.portada_url ?? items[0]?.url_imagen ?? null
  return (
    <div className="anim-fade-in flex w-full flex-wrap items-center gap-3 rounded-lg bg-primary-container/40 p-3 ring-1 ring-primary/40">
      <Link
        to={`/albumes/${album.id}`}
        onClick={clicConZoom(navigate, `/albumes/${album.id}`)}
        className="size-16 shrink-0 overflow-hidden rounded-sm bg-surface-container-high"
        aria-label={`Ver álbum ${album.titulo}`}
      >
        {portada ? (
          <img src={portada} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-tertiary-container text-on-tertiary-container">
            <Icon name="photo_album" size={28} />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="type-label-m flex items-center gap-1 text-primary">
          <Icon name="mail" size={16} fill />
          Te invitaron a un álbum
        </p>
        <Link to={`/albumes/${album.id}`} className="type-title-s emphasized block truncate">
          {album.titulo}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <AvatarStack usuarios={miembros} max={3} size={20} />
          <span className="type-body-s truncate text-on-surface-variant">
            {miembros.length} {miembros.length === 1 ? 'miembro' : 'miembros'} · {contarMedia(items)}
          </span>
        </div>
      </div>
      <ButtonGroup className="w-full sm:w-auto">
        <Button size="xs" disabled={busy} onClick={() => void responder(true)} className="flex-1">
          Aceptar
        </Button>
        <Button size="xs" variant="tonal" disabled={busy} onClick={() => void responder(false)} className="flex-1">
          Rechazar
        </Button>
      </ButtonGroup>
    </div>
  )
}

function AlbumCard({ album, items }: AlbumConItems) {
  const navigate = useNavigate()
  const miembros = miembrosAceptados(album)
  const portada = album.portada_url ?? items[0]?.url_imagen ?? null
  return (
    <div>
      <Link
        to={`/albumes/${album.id}`}
        onClick={clicConZoom(navigate, `/albumes/${album.id}`)}
        className={cn('group relative block aspect-square overflow-hidden rounded-xs bg-surface-container-high')}
        aria-label={`Álbum ${album.titulo}`}
      >
        {portada ? (
          <img src={portada} alt="" loading="lazy" className="size-full object-cover transition-transform spring-spatial group-hover:scale-[1.03]" />
        ) : (
          <span className="flex size-full items-center justify-center bg-tertiary-container text-on-tertiary-container">
            <Icon name="photo_album" size={48} />
          </span>
        )}
        {items.some((i) => i.tipo === 'video') && (
          <span className="absolute top-2 right-2 text-white drop-shadow">
            <Icon name="movie" fill size={20} />
          </span>
        )}
      </Link>
      <div className="mt-2 px-0.5">
        <Link to={`/albumes/${album.id}`} className="type-title-s emphasized block truncate">
          {album.titulo}
        </Link>
        <p className="type-body-s text-on-surface-variant">
          {miembros.length} {miembros.length === 1 ? 'miembro' : 'miembros'} · {contarMedia(items)}
        </p>
        <div className="mt-1.5">
          <AvatarStack usuarios={miembros} max={3} size={22} />
        </div>
      </div>
    </div>
  )
}
