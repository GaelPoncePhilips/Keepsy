import { Link } from 'react-router'
import { Icon } from '../../components/ui/Icon'
import { useBadges } from '../../stores/badges'
import { useUi } from '../../stores/ui'

/** Barra superior móvil: wordmark + notificaciones (círculo) + mensajes (cuadrado redondeado). */
export function MobileTopBar() {
  return useUi((s) => s.estilo.ui) === 'clasica' ? <MobileTopBarClasica /> : <MobileTopBarBlob />
}

/** Clásica: wordmark + corazón (punto) + avión (contador), plana sobre surface. */
function MobileTopBarClasica() {
  const notifs = useBadges((s) => s.notificaciones)
  const msgs = useBadges((s) => s.mensajes)
  return (
    <header className="sticky top-0 z-20 flex h-[calc(60px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] items-center justify-between border-b border-outline-variant/40 bg-surface px-4 md:hidden">
      <Link to="/" aria-label="Keepsy, inicio" className="flex items-center gap-2">
        <span className="wordmark text-[28px] leading-none text-on-surface">keepsy</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link to="/notificaciones" aria-label={`Notificaciones${notifs ? `, ${notifs} sin leer` : ''}`} className="relative flex size-11 items-center justify-center">
          <Icon name="favorite" size={26} />
          {notifs > 0 && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-error ring-2 ring-surface" />}
        </Link>
        <Link to="/direct" aria-label={`Mensajes${msgs ? `, ${msgs} sin leer` : ''}`} className="relative flex size-11 items-center justify-center">
          <Icon name="send" size={26} />
          {msgs > 0 && (
            <span className="absolute top-1 right-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-on-error type-label-s ring-2 ring-surface">
              {msgs > 9 ? '9+' : msgs}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}

function MobileTopBarBlob() {
  const notifs = useBadges((s) => s.notificaciones)
  const msgs = useBadges((s) => s.mensajes)
  const boton =
    'state relative flex size-11 items-center justify-center bg-surface-container-highest text-on-surface transition-transform spring-spatial-fast active:scale-95'
  return (
    <header
      className="sticky top-0 z-20 rounded-b-[32px] bg-surface-container md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', boxShadow: '0 8px 24px rgb(0 0 0 / .35)' }}
    >
      <div className="flex h-[60px] items-center justify-between pr-4 pl-5">
        <Link to="/" aria-label="Keepsy, inicio" className="flex items-center">
          <span className="wordmark text-[28px] leading-none">keepsy</span>
        </Link>
        <div className="flex items-center gap-2">
          {/* El contador va fuera del botón: la máscara/state layer del botón lo recortaba. */}
          <span className="relative">
            <Link
              to="/notificaciones"
              aria-label={`Notificaciones${notifs ? `, ${notifs} sin leer` : ''}`}
              className={`${boton} rounded-full`}
            >
              <Icon name="notifications" size={22} />
            </Link>
            <Contador n={notifs} />
          </span>
          <span className="relative">
            <Link
              to="/direct"
              aria-label={`Mensajes${msgs ? `, ${msgs} sin leer` : ''}`}
              className={`${boton} rounded-[14px]`}
            >
              <Icon name="send" size={22} />
            </Link>
            <Contador n={msgs} />
          </span>
        </div>
      </div>
    </header>
  )
}

function Contador({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-1 -right-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-on-error ring-2 ring-surface-container type-label-s"
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}
