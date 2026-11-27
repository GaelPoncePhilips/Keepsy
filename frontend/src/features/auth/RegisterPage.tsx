import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Controls'
import { Icon } from '../../components/ui/Icon'
import { ApiError, mensajeDeError } from '../../services/client'
import { actualizarUsuario, registrar } from '../../services/usuarios'
import { subirArchivo } from '../../services/media'
import { avatarCambiado } from '../../services/temporal/local'
import { Encuadre, esHeic } from '../../components/ui/Encuadre'
import { useSession } from '../../stores/session'
import { AuthShell } from './AuthShell'
import { formaStory } from '../../lib/formasM3'

const USERNAME_OK = /^[a-z0-9._]+$/

export function RegisterPage() {
  const login = useSession((s) => s.login)
  const estado = useSession((s) => s.estado)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [bio, setBio] = useState('')
  const [foto, setFoto] = useState<Blob | null>(null)
  const [encuadrar, setEncuadrar] = useState<string | null>(null)
  const fotoPreview = useMemo(() => (foto ? URL.createObjectURL(foto) : null), [foto])
  const [errores, setErrores] = useState<{ email?: string; username?: string; general?: string }>({})
  const [enviando, setEnviando] = useState(false)

  if (estado === 'autenticado') return <Navigate to="/" replace />

  const userValido = username.length > 0 && USERNAME_OK.test(username)
  const userError = username.length > 0 && !userValido ? 'Solo minúsculas, números, punto y guion bajo' : (errores.username ?? null)
  const passError = password.length > 0 && password.length < 6 ? 'Mínimo 6 caracteres' : null
  const completo = email.trim() && nombre.trim() && userValido && password.length >= 6

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!completo || enviando) return
    setEnviando(true)
    setErrores({})
    try {
      const u = await registrar({ email: email.trim(), nombre: nombre.trim(), username, password, bio: bio.trim() || null })
      await login(email.trim(), password)
      if (foto) {
        try {
          const url = await subirArchivo(foto, 'perfil.jpg')
          useSession.getState().setUsuario(await actualizarUsuario(u.id, { foto_url: url }))
          avatarCambiado(username, url)
        } catch {
          /* la cuenta ya existe: la foto se puede cambiar después desde Editar perfil */
        }
      }
      navigate('/', { replace: true })
    } catch (err) {
      const msg = mensajeDeError(err)
      if (err instanceof ApiError && err.status === 409) {
        const m = msg.toLowerCase()
        if (m.includes('email')) setErrores({ email: msg })
        else if (m.includes('username') || m.includes('usuario')) setErrores({ username: msg })
        else setErrores({ general: msg })
      } else {
        setErrores({ general: msg })
      }
      setEnviando(false)
    }
  }

  return (
    <AuthShell
      below={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="type-label-l emphasized text-primary">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <p className="type-title-m mb-4 text-center text-on-surface-variant">Registrate para ver fotos y videos de tus amigos.</p>
      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-1" noValidate>
        <label className="mb-3 flex cursor-pointer flex-col items-center gap-2">
          <span
            className="flex size-24 items-center justify-center overflow-hidden bg-surface-container-highest"
            style={{ clipPath: formaStory(false) }}
          >
            {fotoPreview ? (
              <img src={fotoPreview} alt="Vista previa de tu foto de perfil" className="size-full object-cover" />
            ) : (
              <Icon name="add_a_photo" size={32} />
            )}
          </span>
          <span className="type-label-l text-primary">{foto ? 'Cambiar foto de perfil' : 'Elegir foto de perfil (opcional)'}</span>
          <input
            type="file"
            accept="image/*,.heic,.heif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              // HEIC no se puede encuadrar antes de tener cuenta (lo convierte el servidor al subirlo).
              if (esHeic(f)) setFoto(f)
              else setEncuadrar(URL.createObjectURL(f))
            }}
          />
        </label>
        <Encuadre
          src={encuadrar}
          estrella
          titulo="Encuadrar foto de perfil"
          maxLado={720}
          onCancelar={() => setEncuadrar(null)}
          onListo={(b) => {
            setEncuadrar(null)
            setFoto(b)
          }}
        />
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(v) => { setEmail(v); setErrores((s) => ({ ...s, email: undefined })) }} error={errores.email} />
        <TextField label="Nombre" autoComplete="name" value={nombre} onChange={setNombre} />
        <div className="relative">
          <TextField
            label="Nombre de usuario"
            autoComplete="username"
            value={username}
            onChange={(v) => { setUsername(v); setErrores((s) => ({ ...s, username: undefined })) }}
            error={userError}
          />
          {userValido && !userError && (
            <span className="absolute top-4 right-3 text-green-600" role="img" aria-label="Nombre de usuario válido">
              <Icon name="check_circle" fill size={22} />
            </span>
          )}
        </div>
        <TextField label="Contraseña" type="password" autoComplete="new-password" value={password} onChange={setPassword} error={passError} />
        <TextField label="Bio (opcional)" value={bio} onChange={setBio} maxLength={150} multiline />
        {errores.general && (
          <p role="alert" className="mb-2 text-center type-body-s text-error">
            {errores.general}
          </p>
        )}
        <Button type="submit" variant="filled" size="md" full disabled={!completo || enviando}>
          {enviando ? 'Creando cuenta…' : 'Registrarte'}
        </Button>
      </form>
    </AuthShell>
  )
}
