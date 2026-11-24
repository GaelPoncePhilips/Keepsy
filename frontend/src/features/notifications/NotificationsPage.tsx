import { useNavigate } from 'react-router'
import { navegarConZoom } from '../../lib/transicion'
import { ScreenHeader } from '../../components/shared'
import { NotificationsList } from './NotificationsList'

export function NotificationsPage() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto w-full max-w-[640px]">
      <ScreenHeader title="Notificaciones" onBack={() => navegarConZoom(navigate, -1)} />
      <NotificationsList />
    </div>
  )
}
