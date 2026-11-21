import { useState } from 'react'
import { radioBlob } from '../../lib/blob'
import { cn } from '../../lib/hooks'
import { avatarUrl } from '../../services/temporal/local'

/** Silueta "cookie" (8 lóbulos suaves) para avatares con historia. */
const COOKIE = 'polygon(100.00% 50.00%, 99.05% 54.29%, 96.60% 58.22%, 93.59% 61.68%, 91.06% 64.94%, 89.60% 68.47%, 89.08% 72.56%, 88.76% 77.14%, 87.72% 81.65%, 85.36% 85.36%, 81.65% 87.72%, 77.14% 88.76%, 72.56% 89.08%, 68.47% 89.60%, 64.94% 91.06%, 61.68% 93.59%, 58.22% 96.60%, 54.29% 99.05%, 50.00% 100.00%, 45.71% 99.05%, 41.78% 96.60%, 38.32% 93.59%, 35.06% 91.06%, 31.53% 89.60%, 27.44% 89.08%, 22.86% 88.76%, 18.35% 87.72%, 14.64% 85.36%, 12.28% 81.65%, 11.24% 77.14%, 10.92% 72.56%, 10.40% 68.47%, 8.94% 64.94%, 6.41% 61.68%, 3.40% 58.22%, 0.95% 54.29%, 0.00% 50.00%, 0.95% 45.71%, 3.40% 41.78%, 6.41% 38.32%, 8.94% 35.06%, 10.40% 31.53%, 10.92% 27.44%, 11.24% 22.86%, 12.28% 18.35%, 14.64% 14.64%, 18.35% 12.28%, 22.86% 11.24%, 27.44% 10.92%, 31.53% 10.40%, 35.06% 8.94%, 38.32% 6.41%, 41.78% 3.40%, 45.71% 0.95%, 50.00% 0.00%, 54.29% 0.95%, 58.22% 3.40%, 61.68% 6.41%, 64.94% 8.94%, 68.47% 10.40%, 72.56% 10.92%, 77.14% 11.24%, 81.65% 12.28%, 85.36% 14.64%, 87.72% 18.35%, 88.76% 22.86%, 89.08% 27.44%, 89.60% 31.53%, 91.06% 35.06%, 93.59% 38.32%, 96.60% 41.78%, 99.05% 45.71%)'

export type Anillo = 'ninguno' | 'sin-ver' | 'visto' | 'amigos'

interface AvatarProps {
  username: string
  size?: number
  /** Anillo de story: sin-ver = marca (índigo → lima), visto = gris, amigos = verde. */
  anillo?: Anillo
  className?: string
  alt?: string
}

/** Avatar circular. TEMPORAL (hueco 6): la foto se deriva del username; si falla, iniciales. */
export function Avatar({ username, size = 32, anillo = 'ninguno', className, alt }: AvatarProps) {
  const [fallo, setFallo] = useState(false)
  const url = avatarUrl(username)
  const ring = anillo !== 'ninguno'
  // Con historia el avatar pasa a squircle: más editorial/tech que el círculo clásico.
  // Sin historia: mancha propia de cada usuario (siempre la misma).
  const forma = ''
  const clip = ring ? { clipPath: COOKIE } : { borderRadius: radioBlob(username, 0.5) }
  const grosor = size >= 56 ? 3 : 2
  const fondo =
    anillo === 'sin-ver'
      ? 'conic-gradient(from 210deg, var(--md-sys-color-primary), var(--md-sys-color-tertiary-container), var(--md-sys-color-primary))'
      : anillo === 'amigos'
        ? 'var(--keepsy-amigos)'
        : anillo === 'visto'
          ? 'var(--md-sys-color-outline-variant)'
          : undefined
  const inner = (
    <span
      className={cn('block overflow-hidden bg-surface-container-highest', forma)}
      style={{ width: size, height: size, ...clip }}
    >
      {url && !fallo ? (
        <img
          src={url}
          alt={alt ?? `Foto de perfil de ${username}`}
          width={size}
          height={size}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFallo(true)}
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
        // Mejores amigos: corona sobre el anillo verde.
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
