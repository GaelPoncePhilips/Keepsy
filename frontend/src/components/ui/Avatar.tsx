import { useState, useSyncExternalStore, type CSSProperties } from 'react'
import { fondoAnillo, formaStory } from '../../lib/formasM3'
import { cn } from '../../lib/hooks'
import { avatarUrl, suscribirAvatares } from '../../services/temporal/local'

/** URLs que respondieron 404 (usuario sin foto): no se vuelven a pedir en esta sesión. */
const sinFoto = new Set<string>()

export type Anillo = 'ninguno' | 'sin-ver' | 'visto' | 'amigos'

interface AvatarProps {
  username: string
  size?: number
  /** Anillo de story: sin-ver = rosa → coral, visto = rosas pálidos, amigos = rojo de marca. */
  anillo?: Anillo
  className?: string
  alt?: string
}

/** Avatar con forma de estrella de 8 puntas (igual en toda la app). Sin foto propia: inicial sobre la estrella. */
export function Avatar({ username, size = 32, anillo = 'ninguno', className, alt }: AvatarProps) {
  useSyncExternalStore(suscribirAvatares, () => avatarUrl(username))
  const url = avatarUrl(username)
  const [fallo, setFallo] = useState<string | null>(() => (url && sinFoto.has(url) ? url : null))
  const ring = anillo !== 'ninguno'
  const forma = ''
  const clip: CSSProperties = { clipPath: formaStory(false) }
  const grosor = size >= 56 ? 3 : 2
  const fondo = fondoAnillo(anillo)
  const inner = (
    <span
      className={cn('block overflow-hidden bg-surface-container-highest', forma)}
      style={{ width: size, height: size, ...clip }}
    >
      {url && fallo !== url && !sinFoto.has(url) ? (
        <img
          src={url}
          alt={alt ?? `Foto de perfil de ${username}`}
          width={size}
          height={size}
          loading="lazy"
          className="size-full object-cover"
          onError={() => {
            sinFoto.add(url)
            setFallo(url)
          }}
        />
      ) : (
        <span
          className="flex size-full items-center justify-center bg-primary-container font-bold text-on-primary-container"
          style={{ fontSize: size * 0.42 }}
          role="img"
          aria-label={alt ?? username}
        >
          {username.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  )
  if (!ring) return <span className={cn('inline-block shrink-0', className)}>{inner}</span>
  return (
    <span
      className={cn('relative inline-block shrink-0', forma, className)}
      style={{ padding: grosor, background: fondo, ...clip }}
    >
      <span className={cn('block bg-surface', forma)} style={{ padding: grosor, ...clip }}>
        {inner}
      </span>
      {anillo === 'amigos' && size >= 40 && (
        // Mejores amigos: corona sobre el anillo rojo.
        <span
          className="absolute -top-1 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-amigos text-white ring-2 ring-surface"
          style={{ width: Math.round(size * 0.32), height: Math.round(size * 0.32) }}
          aria-label="Mejores amigos"
          role="img"
        >
          <span className="icon" data-fill="true" style={{ fontSize: Math.round(size * 0.22) }} aria-hidden="true">
            crown
          </span>
        </span>
      )}
    </span>
  )
}
