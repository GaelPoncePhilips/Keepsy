// TEMPORAL (hueco 14): stickers y GIFs. ezgif.com no tiene API pública de búsqueda: el flujo es
// crear/buscar el GIF en ezgif y pegar el enlace directo acá. Los stickers son emojis grandes.
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { Sheet } from '../../components/ui/Overlay'
import { vibrar } from '../../lib/haptics'
import { cn } from '../../lib/hooks'
import { STICKERS, type MediaComentario } from '../../services/temporal/comentariosExtra'

const KEY_RECIENTES = 'keepsy.temporal.gifsRecientes'

function leerRecientes(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY_RECIENTES) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 12) : []
  } catch {
    return []
  }
}
function guardarReciente(url: string): void {
  try {
    localStorage.setItem(KEY_RECIENTES, JSON.stringify([url, ...leerRecientes().filter((u) => u !== url)].slice(0, 12)))
  } catch {
    /* sin almacenamiento */
  }
}

const esUrlHttp = (v: string) => /^https?:\/\/\S+$/i.test(v)

export function StickerPicker({
  open,
  onClose,
  onElegir,
}: {
  open: boolean
  onClose: () => void
  onElegir: (m: MediaComentario) => void
}) {
  const [tab, setTab] = useState<'stickers' | 'gif'>('stickers')
  const [url, setUrl] = useState('')
  const [recientes, setRecientes] = useState(leerRecientes)
  const valida = esUrlHttp(url.trim())

  const elegirGif = (u: string) => {
    guardarReciente(u)
    setRecientes(leerRecientes())
    vibrar('click')
    onElegir({ tipo: 'gif', valor: u })
    setUrl('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Stickers y GIFs">
      <div className="flex gap-2 px-4 pt-3">
        {(['stickers', 'gif'] as const).map((t) => (
          <button
            key={t}
            type="button"
            data-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              'morph state type-label-l h-9 px-4',
              tab === t ? 'bg-secondary-container text-on-secondary-container' : 'border border-outline-variant text-on-surface-variant',
            )}
          >
            {t === 'stickers' ? 'Stickers' : 'GIF'}
          </button>
        ))}
      </div>

      {tab === 'stickers' ? (
        <div className="grid grid-cols-6 gap-1 p-4">
          {STICKERS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Sticker ${e}`}
              className="state flex aspect-square items-center justify-center rounded-md text-[32px] transition-transform spring-spatial-fast active:scale-90"
              onClick={() => {
                vibrar('click')
                onElegir({ tipo: 'sticker', valor: e })
                onClose()
              }}
            >
              {e}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <a
            href="https://ezgif.com/maker"
            target="_blank"
            rel="noopener noreferrer"
            className="state type-label-l flex items-center gap-2 rounded-md bg-tertiary-container px-4 py-3 text-on-tertiary-container"
          >
            <Icon name="gif_box" size={22} />
            <span className="flex-1">Crear o editar un GIF en ezgif.com</span>
            <Icon name="open_in_new" size={18} />
          </a>
          <p className="type-body-s text-on-surface-variant">
            Armá tu GIF en ezgif, copiá el enlace directo de la imagen (termina en .gif) y pegalo acá.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-outline-variant px-4 focus-within:border-primary">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                placeholder="https://…/imagen.gif"
                aria-label="Enlace del GIF"
                className="type-body-m h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-on-surface-variant"
              />
            </div>
            <Button disabled={!valida} onClick={() => elegirGif(url.trim())}>
              Usar
            </Button>
          </div>
          {valida && <img src={url.trim()} alt="Vista previa del GIF" className="max-h-40 w-fit max-w-full rounded-md" />}
          {recientes.length > 0 && (
            <>
              <h3 className="type-label-l emphasized text-on-surface-variant">Recientes</h3>
              <div className="grid grid-cols-3 gap-1">
                {recientes.map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-label="Usar GIF reciente"
                    className="state aspect-square overflow-hidden rounded-sm"
                    onClick={() => elegirGif(u)}
                  >
                    <img src={u} alt="" loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
