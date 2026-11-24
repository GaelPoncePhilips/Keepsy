import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/ui/Avatar'
import { Icon } from '../../components/ui/Icon'
import { IconButton } from '../../components/ui/IconButton'
import { vibrar } from '../../lib/haptics'
import { cn } from '../../lib/hooks'
import { tiempoCorto } from '../../lib/time'
import { mensajeDeError } from '../../services/client'
import * as postsApi from '../../services/posts'
import { agruparHilos, codificar, decodificar, largoVisible, type MediaComentario } from '../../services/temporal/comentariosExtra'
import { urlDeArchivo } from '../../services/temporal/local'
import { snackbar } from '../../stores/ui'
import type { Comentario } from '../../types/api'
import { RichText } from './RichText'
import { StickerPicker } from './StickerPicker'

export const MAX_COMENTARIO = 300

/** De dónde salen los comentarios: un post (API) o un ítem de álbum (local). */
export interface FuenteComentarios {
  listar: () => Promise<Comentario[]>
  comentar: (texto: string) => Promise<Comentario>
  borrar: (id: number) => Promise<void>
}

export const fuenteDePost = (postId: number): FuenteComentarios => ({
  listar: () => postsApi.comentarios(postId, { limit: 50 }),
  comentar: (t) => postsApi.comentar(postId, t),
  borrar: (id) => postsApi.borrarComentario(id),
})

/** Imagen, GIF o sticker adjunto a un comentario o mensaje. */
export function MediaAdjunta({ media, className }: { media: MediaComentario; className?: string }) {
  if (media.tipo === 'sticker') {
    return (
      <span className={cn('block text-[56px] leading-none select-none', className)} role="img" aria-label="Sticker">
        {media.valor}
      </span>
    )
  }
  return (
    <img
      src={media.valor}
      alt={media.tipo === 'gif' ? 'GIF' : 'Imagen adjunta'}
      loading="lazy"
      className={cn('max-h-52 max-w-[220px] rounded-md object-cover', className)}
    />
  )
}

/** Un comentario: avatar, username + texto, multimedia, tiempo, "Responder" y borrar si corresponde. */
export function ComentarioItem({
  comentario,
  puedeBorrar,
  onBorrado,
  onResponder,
  esRespuesta,
  borrar: borrarFn,
}: {
  comentario: Comentario
  puedeBorrar: boolean
  onBorrado?: (id: number) => void
  onResponder?: (c: Comentario) => void
  esRespuesta?: boolean
  borrar?: (id: number) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const { texto, media } = decodificar(comentario.texto)
  const borrar = async () => {
    setBusy(true)
    try {
      await (borrarFn ?? postsApi.borrarComentario)(comentario.id)
      onBorrado?.(comentario.id)
    } catch (e) {
      snackbar(mensajeDeError(e))
      setBusy(false)
    }
  }
  return (
    <div className={cn('group flex items-start gap-3 py-2 pr-4', esRespuesta ? 'pl-14' : 'pl-4')}>
      <Link to={`/${comentario.autor_username}`} className="shrink-0">
        <Avatar username={comentario.autor_username} size={esRespuesta ? 24 : 32} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="type-body-m break-words">
          <Link to={`/${comentario.autor_username}`} className="emphasized mr-1.5 font-semibold">
            {comentario.autor_username}
          </Link>
          <RichText text={texto.replace(/​/g, '')} />
        </p>
        {media && <MediaAdjunta media={media} className="mt-1.5" />}
        <p className="type-label-s mt-0.5 flex items-center gap-3 text-on-surface-variant">
          <span>{tiempoCorto(comentario.fecha)}</span>
          {onResponder && (
            <button type="button" className="type-label-m emphasized -my-1.5 py-1.5 transition-transform active:scale-95" onClick={() => onResponder(comentario)}>
              Responder
            </button>
          )}
        </p>
      </div>
      {puedeBorrar && (
        <IconButton
          icon="delete"
          label="Eliminar comentario"
          size={18}
          disabled={busy}
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          onClick={() => void borrar()}
        />
      )}
    </div>
  )
}

/** Lista de comentarios agrupados en hilos (las respuestas quedan sangradas bajo su comentario). */
export function HilosComentarios({
  comentarios,
  puedeBorrar,
  onBorrado,
  onResponder,
  borrar,
}: {
  comentarios: Comentario[]
  puedeBorrar: (c: Comentario) => boolean
  onBorrado: (id: number) => void
  onResponder?: (c: Comentario) => void
  borrar?: (id: number) => Promise<void>
}) {
  return (
    <>
      {agruparHilos(comentarios).map((h) => (
        <div key={h.comentario.id} className="anim-fade-in">
          <ComentarioItem comentario={h.comentario} puedeBorrar={puedeBorrar(h.comentario)} onBorrado={onBorrado} onResponder={onResponder} borrar={borrar} />
          {h.respuestas.map((r) => (
            <ComentarioItem key={r.id} esRespuesta comentario={r} puedeBorrar={puedeBorrar(r)} onBorrado={onBorrado} onResponder={onResponder} borrar={borrar} />
          ))}
        </div>
      ))}
    </>
  )
}

/** Caja "Añade un comentario…": cápsula con foto / sticker-GIF, respuesta a un comentario y contador 1–300. */
export function CajaComentario({
  postId,
  fuente,
  onComentado,
  autoFocus,
  className,
  respondiendoA,
  onCancelarRespuesta,
}: {
  postId?: number
  fuente?: FuenteComentarios
  onComentado: (c: Comentario) => void
  autoFocus?: boolean
  className?: string
  respondiendoA?: Comentario | null
  onCancelarRespuesta?: () => void
}) {
  const origen = fuente ?? fuenteDePost(postId ?? 0)
  const [texto, setTexto] = useState('')
  const [media, setMedia] = useState<MediaComentario | null>(null)
  const [stickers, setStickers] = useState(false)
  const [busy, setBusy] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const limpio = texto.trim()
  const hayContenido = limpio.length > 0 || media !== null
  const valido = hayContenido && limpio.length <= MAX_COMENTARIO

  // Al empezar a responder se enfoca la caja con la mención del autor, como Instagram.
  const respId = respondiendoA?.id ?? null
  const respUser = respondiendoA?.autor_username
  useEffect(() => {
    if (respId === null) return
    const t = window.setTimeout(() => {
      setTexto((t) => (t.trim() ? t : `@${respUser} `))
      input.current?.focus()
    })
    return () => window.clearTimeout(t)
  }, [respId, respUser])

  const enviar = async () => {
    if (!valido || busy) return
    setBusy(true)
    try {
      // El backend exige texto: con solo multimedia se manda un carácter de ancho cero.
      const base = limpio || '​'
      const c = await origen.comentar(codificar(base, { respuestaA: respondiendoA?.id, media }))
      vibrar('exito')
      onComentado(c)
      setTexto('')
      setMedia(null)
      onCancelarRespuesta?.()
    } catch (e) {
      vibrar('error')
      snackbar(mensajeDeError(e))
    } finally {
      setBusy(false)
    }
  }
  const excede = limpio.length > MAX_COMENTARIO
  return (
    <div className={className}>
      {respondiendoA && (
        <div className="anim-fade-in mb-1.5 flex items-center gap-2 px-1 type-label-m text-on-surface-variant">
          <span className="min-w-0 flex-1 truncate">Respondiendo a @{respondiendoA.autor_username}</span>
          <button type="button" aria-label="Cancelar respuesta" className="state flex size-6 items-center justify-center rounded-full" onClick={onCancelarRespuesta}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {media && (
        <div className="anim-scale-in relative mb-2 w-fit">
          <MediaAdjunta media={media} className="max-h-24" />
          <button
            type="button"
            aria-label="Quitar adjunto"
            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-inverse-surface text-inverse-on-surface"
            onClick={() => setMedia(null)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      <form
        className="flex min-h-11 items-center gap-0.5 rounded-full border border-outline-variant bg-surface-container-low pr-1.5 pl-4 transition-colors focus-within:border-primary"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <input
          ref={input}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={respondiendoA ? 'Escribí tu respuesta…' : 'Añade un comentario…'}
          aria-label="Añade un comentario"
          maxLength={MAX_COMENTARIO + 50}
          autoFocus={autoFocus}
          className="type-body-m h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-on-surface-variant"
        />
        {texto.length > 0 && (
          <span className={cn('type-label-s mr-1', excede ? 'text-error' : 'text-on-surface-variant')}>
            {largoVisible(limpio)}/{MAX_COMENTARIO}
          </span>
        )}
        <input
          ref={archivo}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setMedia({ tipo: 'imagen', valor: urlDeArchivo(f) })
            e.target.value = ''
          }}
        />
        <IconButton icon="image" label="Adjuntar foto" size={20} className="size-9! min-h-0" onClick={() => archivo.current?.click()} />
        <IconButton icon="sticker" label="Stickers y GIFs" size={20} className="size-9! min-h-0" onClick={() => setStickers(true)} />
        {hayContenido && (
          <button
            type="submit"
            disabled={!valido || busy}
            aria-label="Publicar comentario"
            className="anim-scale-in state ml-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"
          >
            <Icon name="arrow_upward" size={20} />
          </button>
        )}
      </form>
      <StickerPicker open={stickers} onClose={() => setStickers(false)} onElegir={setMedia} />
    </div>
  )
}
