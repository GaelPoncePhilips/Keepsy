import { useNavigate } from 'react-router'
import { BlobBackdrop, BlobIcon } from '../../components/ui/Blobs'
import { Icon } from '../../components/ui/Icon'
import { Dialog } from '../../components/ui/Overlay'
import { vibrar } from '../../lib/haptics'
import { cn, useIsMobile } from '../../lib/hooks'
import { useUi } from '../../stores/ui'

const OPCIONES = [
  { id: 'publicacion', label: 'Publicación', icon: 'photo_library', to: '/crear/publicacion', desc: 'Foto con descripción', tono: 'bg-primary-container text-on-primary-container' },
  { id: 'reel', label: 'Reel', icon: 'movie', to: '/crear/reel', desc: 'Video vertical', tono: 'bg-primary text-on-primary' },
  { id: 'story', label: 'Story', icon: 'history_toggle_off', to: '/crear/story', desc: 'Dura 24 horas', tono: 'bg-tertiary-container text-on-tertiary-container' },
  { id: 'album', label: 'Álbum', icon: 'photo_album', to: '/albumes/nuevo', desc: 'Con amigos', tono: 'bg-primary-container text-on-primary-container' },
] as const

/** Cuadrícula de opciones: cada una es una mancha que se deforma al tocarla. */
function Opciones({ onIr }: { onIr: (to: string) => void }) {
  return (
    <ul className="relative isolate grid grid-cols-2 gap-3 p-4">
      <BlobBackdrop className="opacity-70" />
      {OPCIONES.map((o, i) => (
        <li key={o.id} className="anim-fab-item" style={{ animationDelay: `${i * 45}ms` }}>
          <button
            type="button"
            onClick={() => {
              vibrar('click')
              onIr(o.to)
            }}
            className="state flex w-full flex-col items-start gap-4 rounded-lg bg-surface-container-high/80 p-4 text-left backdrop-blur-none transition-transform spring-spatial-fast active:scale-95"
          >
            <BlobIcon className={cn('blob-tile size-14', o.tono)}>
              <Icon name={o.icon} size={28} />
            </BlobIcon>
            <span>
              <span className="type-title-m emphasized block">{o.label}</span>
              <span className="type-body-s text-on-surface-variant">{o.desc}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Selector "Crear" de escritorio: diálogo. En móvil lo reemplaza el menú radial de la barra inferior.
 * Mismo contenido en ambos: cuatro tiles-mancha que se deforman al tocarlos.
 */
export function CreateMenu() {
  const abierto = useUi((s) => s.crearAbierto)
  const setCrear = useUi((s) => s.setCrear)
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const cerrar = () => setCrear(false)
  const ir = (to: string) => {
    cerrar()
    navigate(to)
  }
  // Móvil: el menú radial vive en el botón de la barra inferior (RadialCreate).
  if (isMobile) return null
  return (
    <Dialog open={abierto} onClose={cerrar} title="Crear" width={440}>
      <Opciones onIr={ir} />
    </Dialog>
  )
}
