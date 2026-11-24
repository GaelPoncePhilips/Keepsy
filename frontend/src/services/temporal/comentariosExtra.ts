// TEMPORAL (hueco 14) — respuestas y multimedia en comentarios / mensajes.
// El contrato solo tiene `texto`. Se codifican como tokens invisibles (U+2063) al final del texto:
//   "hola" + SEP + "r:12" + SEP + "m:gif:https://…"
// Funciona igual con el backend real (es texto) y se decodifica en el cliente. Flag: VITE_TEMPORAL_COMENTARIOS_EXTRA.
import { temporal } from '../../config/env'
import type { Comentario } from '../../types/api'

const SEP = '⁣'

export type TipoMediaComentario = 'imagen' | 'gif' | 'sticker'

export interface MediaComentario {
  tipo: TipoMediaComentario
  /** URL (imagen / gif) o el emoji (sticker). */
  valor: string
}

export interface ComentarioDecodificado {
  texto: string
  respuestaA: number | null
  media: MediaComentario | null
}

export function codificar(texto: string, extra: { respuestaA?: number | null; media?: MediaComentario | null } = {}): string {
  if (!temporal.comentariosExtra) return texto
  let out = texto
  if (extra.respuestaA) out += `${SEP}r:${extra.respuestaA}`
  if (extra.media) out += `${SEP}m:${extra.media.tipo}:${extra.media.valor}`
  return out
}

export function decodificar(raw: string): ComentarioDecodificado {
  if (!temporal.comentariosExtra || !raw.includes(SEP)) return { texto: raw, respuestaA: null, media: null }
  const [texto, ...tokens] = raw.split(SEP)
  let respuestaA: number | null = null
  let media: MediaComentario | null = null
  for (const t of tokens) {
    if (t.startsWith('r:')) {
      const n = Number(t.slice(2))
      if (Number.isFinite(n)) respuestaA = n
    } else if (t.startsWith('m:')) {
      const resto = t.slice(2)
      const i = resto.indexOf(':')
      const tipo = resto.slice(0, i)
      if (i > 0 && (tipo === 'imagen' || tipo === 'gif' || tipo === 'sticker')) media = { tipo, valor: resto.slice(i + 1) }
    }
  }
  return { texto: texto.trimEnd(), respuestaA, media }
}

/** Largo "visible" (sin los tokens) para el contador de 300. */
export const largoVisible = (raw: string) => decodificar(raw).texto.length

export interface HiloComentario {
  comentario: Comentario
  respuestas: Comentario[]
}

/** Agrupa: comentarios raíz en orden + sus respuestas (también las de respuestas) debajo. */
export function agruparHilos(lista: Comentario[]): HiloComentario[] {
  const porId = new Map(lista.map((c) => [c.id, c]))
  const raizDe = (c: Comentario): number => {
    let actual = c
    const visto = new Set<number>()
    for (;;) {
      const padre = decodificar(actual.texto).respuestaA
      const p = padre !== null ? porId.get(padre) : undefined
      if (!p || visto.has(p.id)) return actual.id
      visto.add(actual.id)
      actual = p
    }
  }
  const hilos = new Map<number, HiloComentario>()
  for (const c of lista) {
    if (raizDe(c) === c.id) hilos.set(c.id, { comentario: c, respuestas: [] })
  }
  for (const c of lista) {
    const r = raizDe(c)
    if (r !== c.id) hilos.get(r)?.respuestas.push(c)
  }
  return [...hilos.values()]
}

export const STICKERS = [
  '🔥', '😂', '😍', '🥹', '😭', '😎', '🤯', '🥳', '❤️', '💜', '💀', '🙌',
  '👏', '🫶', '✨', '💯', '🎉', '🤝', '😴', '🤔', '😅', '🥰', '🫡', '🌈',
  '🍕', '☕', '🐶', '🐱', '🌮', '🎶', '⚡', '🚀',
]
