import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Avatar } from '../../components/ui/Avatar'
import { Button, ButtonGroup } from '../../components/ui/Button'
import { InputChip, TextField } from '../../components/ui/Controls'
import { CenteredLoader } from '../../components/ui/Feedback'
import { Icon } from '../../components/ui/Icon'
import { Dialog } from '../../components/ui/Overlay'
import { cn, useAsync } from '../../lib/hooks'
import { mensajeDeError } from '../../services/client'
import { crearConversacion, enviarAUsuario } from '../../services/dms'
import { buscarUsuarios } from '../../services/temporal'
import { seguidos } from '../../services/usuarios'
import { useYo } from '../../stores/session'
import { snackbar } from '../../stores/ui'
import type { UsuarioResumen } from '../../types/api'

export function NuevoMensaje() {
  const yo = useYo()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [elegidos, setElegidos] = useState<UsuarioResumen[]>([])
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [modo, setModo] = useState<'grupo' | 'separado'>('grupo')
  const [texto, setTexto] = useState('')
  const sugeridos = useAsync(() => seguidos(yo.id, { limit: 50 }), [yo.id])
  const [resultados, setResultados] = useState<UsuarioResumen[] | null>(null)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    const t = q.trim()
    if (!t) return
    let vivo = true
    const h = setTimeout(() => {
      buscarUsuarios(t)
        .then((r) => {
          if (vivo) setResultados(r)
        })
        .catch(() => {
          if (vivo) setResultados([])
        })
        .finally(() => {
          if (vivo) setBuscando(false)
        })
    }, 250)
    return () => {
      vivo = false
      clearTimeout(h)
    }
  }, [q])

  const activa = q.trim() !== ''
  const res = activa ? resultados : null
  const buscandoAhora = activa && buscando
  const lista = (res ?? sugeridos.data ?? []).filter((u) => u.id !== yo.id)
  const toggle = (u: UsuarioResumen) =>
    setElegidos((prev) => (prev.some((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]))

  const crear = async () => {
    if (!elegidos.length || enviando) return
    setEnviando(true)
    try {
      const c = await crearConversacion({
        participantes: elegidos.map((u) => u.id),
        nombre: elegidos.length > 1 && nombre.trim() ? nombre.trim() : undefined,
      })
      navigate(`/direct/${c.id}`, { replace: true })
    } catch (e) {
      snackbar(mensajeDeError(e))
      setEnviando(false)
    }
  }

  const separado = elegidos.length > 1 && modo === 'separado'

  const enviarSeparado = async () => {
    const t = texto.trim()
    if (!t || elegidos.length < 2 || enviando) return
    setEnviando(true)
    const res = await Promise.allSettled(elegidos.map((u) => enviarAUsuario(u.id, { texto: t })))
    const ok = res.filter((r) => r.status === 'fulfilled').length
    const fallos = res.length - ok
    if (ok === 0) {
      const r0 = res[0]
      snackbar(r0 && r0.status === 'rejected' ? mensajeDeError(r0.reason) : 'No se pudo enviar')
      setEnviando(false)
      return
    }
    snackbar(fallos ? `Enviado a ${ok} ${ok === 1 ? 'persona' : 'personas'} · ${fallos} ${fallos === 1 ? 'falló' : 'fallaron'}` : `Enviado a ${ok} personas`)
    navigate('/direct', { replace: true })
  }

  return (
    <Dialog
      open
      onClose={() => navigate('/direct')}
      title="Nuevo mensaje"
      fullscreenMobile
      width={480}
      actions={
        separado ? (
          <Button full size="md" disabled={!texto.trim() || enviando} onClick={() => void enviarSeparado()}>
            Enviar a {elegidos.length}
          </Button>
        ) : (
          <Button full size="md" disabled={!elegidos.length || enviando} onClick={() => void crear()}>
            Chat
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant/60 px-4 py-3">
        <span className="type-label-l emphasized">Para:</span>
        {elegidos.map((u) => (
          <InputChip key={u.id} label={u.username} avatar={<Avatar username={u.username} size={24} />} onRemove={() => toggle(u)} />
        ))}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setBuscando(e.target.value.trim() !== '')
          }}
          placeholder="Buscar…"
          aria-label="Buscar usuarios"
          className="type-body-l h-8 min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-on-surface-variant"
        />
      </div>
      {elegidos.length > 1 && (
        <div className="flex flex-col gap-3 px-4 pt-3">
          <ButtonGroup>
            <Button size="sm" variant="tonal" className="flex-1" selected={modo === 'grupo'} icon="group" onClick={() => setModo('grupo')}>
              Crear grupo
            </Button>
            <Button size="sm" variant="tonal" className="flex-1" selected={modo === 'separado'} icon="send" onClick={() => setModo('separado')}>
              Enviar por separado
            </Button>
          </ButtonGroup>
          {separado ? (
            <TextField label="Mensaje" value={texto} onChange={setTexto} multiline maxLength={1000} />
          ) : (
            <TextField label="Nombre del grupo (opcional)" value={nombre} onChange={setNombre} maxLength={60} />
          )}
        </div>
      )}
      <p className="type-label-l emphasized px-4 pt-3 pb-1">{res ? 'Resultados' : 'Sugeridos'}</p>
      {(buscandoAhora || (!res && sugeridos.loading)) && <CenteredLoader />}
      {!buscandoAhora && !sugeridos.loading && lista.length === 0 && (
        <p className="type-body-m px-4 py-6 text-center text-on-surface-variant">No se encontraron cuentas.</p>
      )}
      {!buscandoAhora &&
        lista.map((u) => {
          const sel = elegidos.some((x) => x.id === u.id)
          return (
            <button key={u.id} type="button" onClick={() => toggle(u)} aria-pressed={sel} className="state flex w-full items-center gap-3 px-4 py-2 text-left">
              <Avatar username={u.username} size={44} />
              <span className="min-w-0 flex-1">
                <span className="type-label-l emphasized block truncate">{u.username}</span>
                <span className="type-body-m block truncate text-on-surface-variant">{u.nombre}</span>
              </span>
              <span
                className={cn('flex size-6 items-center justify-center rounded-full border-2', sel ? 'border-primary bg-primary text-on-primary' : 'border-outline')}
                aria-hidden="true"
              >
                {sel && <Icon name="check" size={16} />}
              </span>
            </button>
          )
        })}
    </Dialog>
  )
}
