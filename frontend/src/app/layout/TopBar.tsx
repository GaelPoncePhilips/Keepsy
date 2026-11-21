import { Link } from 'react-router'
import { Icon } from '../../components/ui/Icon'
import { useBadges } from '../../stores/badges'

/** Barra superior móvil: wordmark + notificaciones (círculo) + mensajes (cuadrado redondeado). */
export function MobileTopBar() {
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
          <span className="wordmark text-[28px] leading-none text-on-surface">keepsy</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/notificaciones"
            aria-label={`Notificaciones${notifs ? `, ${notifs} sin leer` : ''}`}
            className={`${boton} rounded-full`}
          >
            <Icon name="notifications" size={22} />
            {notifs > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-tertiary" />}
          </Link>
          <Link
            to="/direct"
            aria-label={`Mensajes${msgs ? `, ${msgs} sin leer` : ''}`}
            className={`${boton} rounded-[14px]`}
          >
            <Icon name="send" size={22} />
            {msgs > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-on-error type-label-s">
                {msgs > 9 ? '9+' : msgs}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
