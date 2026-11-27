/** Editar perfil (HU1). */
import { navegarConZoom } from '../../lib/transicion'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ScreenHeader } from '../../components/shared'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Switch, TextField } from '../../components/ui/Controls'
import { mensajeDeError } from '../../services/client'
import { subirArchivo } from '../../services/media'
import { Encuadre, esHeic } from '../../components/ui/Encuadre'
import { avatarCambiado } from '../../services/temporal/local'
import * as usuariosApi from '../../services/usuarios'
import { useSession, useYo } from '../../stores/session'
import { snackbar } from '../../stores/ui'

export function EditProfilePage() {
  const yo = useYo()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState(yo.nombre)
  const [bio, setBio] = useState(yo.bio ?? '')
  const [privada, setPrivada] = useState(yo.es_privada)
  const [busy, setBusy] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputFoto = useRef<HTMLInputElement>(null)

  const [encuadrar, setEncuadrar] = useState<string | null>(null)
  // Elegida la foto: se abre el encuadre. HEIC (fuera de Safari) se sube primero y se encuadra la versión JPEG del servidor.
  const elegirFoto = async (archivo: File | undefined) => {
    if (!archivo) return
    if (!esHeic(archivo)) {
      setEncuadrar(URL.createObjectURL(archivo))
      return
    }
    setSubiendo(true)
    try {
      setEncuadrar(await subirArchivo(archivo))
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setSubiendo(false)
    }
  }
  const cambiarFoto = async (archivo: Blob | null | undefined, quitar = false) => {
    if (!quitar && !archivo) return
    setSubiendo(true)
    try {
      const url = archivo ? await subirArchivo(archivo, 'perfil.jpg') : ''
      const u = await usuariosApi.actualizarUsuario(yo.id, { foto_url: url })
      useSession.getState().setUsuario(u)
      avatarCambiado(yo.username, url || null)
      snackbar(quitar ? 'Foto de perfil eliminada' : 'Foto de perfil actualizada')
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setSubiendo(false)
    }
  }
  const cambios = nombre !== yo.nombre || bio !== (yo.bio ?? '') || privada !== yo.es_privada

  const guardar = async () => {
    if (!nombre.trim()) return
    setBusy(true)
    try {
      const u = await usuariosApi.actualizarUsuario(yo.id, { nombre: nombre.trim(), bio: bio.trim() || null, es_privada: privada })
      useSession.getState().setUsuario(u)
      snackbar('Perfil actualizado')
    } catch (e) {
      snackbar(mensajeDeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[600px] pb-10">
      <ScreenHeader title="Editar perfil" onBack={() => navegarConZoom(navigate, `/${yo.username}`, { atras: true })} />
      <div className="flex flex-col gap-6 px-4 pt-6">
        <div className="flex items-center gap-4 rounded-lg bg-surface-container p-4">
          <Avatar username={yo.username} size={56} />
          <div className="min-w-0 flex-1">
            <p className="type-label-l emphasized truncate">{yo.username}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <button type="button" disabled={subiendo} className="type-label-l text-primary disabled:opacity-50" onClick={() => inputFoto.current?.click()}>
                {subiendo ? 'Subiendo…' : 'Cambiar foto'}
              </button>
              <button type="button" disabled={subiendo} className="type-label-l text-error disabled:opacity-50" onClick={() => void cambiarFoto(null, true)}>
                Quitar foto
              </button>
            </div>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*,.heic,.heif"
              hidden
              onChange={(e) => {
                void elegirFoto(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <Encuadre
          src={encuadrar}
          estrella
          titulo="Encuadrar foto de perfil"
          maxLado={720}
          onCancelar={() => setEncuadrar(null)}
          onListo={(b) => {
            setEncuadrar(null)
            void cambiarFoto(b)
          }}
        />
        <TextField label="Nombre" value={nombre} onChange={setNombre} maxLength={100} error={nombre.trim() ? null : 'El nombre es obligatorio'} />
        <TextField label="Presentación" value={bio} onChange={setBio} multiline maxLength={150} hint={`${bio.length}/150`} />
        <Switch
          checked={privada}
          onChange={setPrivada}
          label="Cuenta privada"
          description="Si tu cuenta es privada, solo las personas que apruebes podrán ver tus fotos, videos y stories. Tus seguidores actuales no se verán afectados."
        />
        <div className="flex justify-end">
          <Button disabled={busy || !cambios || !nombre.trim()} onClick={() => void guardar()}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}
