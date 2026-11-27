"""@menciones en descripciones, comentarios, items de álbum y stories → notificaciones."""
import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.usuario_model import Usuario
from src.repositories.notificacion_repository import NotificacionRepository
from src.services.permisos_service import PermisosService

# '@' no precedido por letra/número/punto/@ (evita emails "a@b.com"); usernames: letras, números, '_' y '.'.
MENCION_RE = re.compile(r"(?<![\w.@])@([\w.]{1,30})")


def extraer_menciones(texto: str | None) -> list[str]:
    """Usernames mencionados, en minúscula, sin repetir y en orden de aparición (sin el punto final de una oración)."""
    nombres = (m.rstrip(".").lower() for m in MENCION_RE.findall(texto or ""))
    return list(dict.fromkeys(n for n in nombres if n))


def notificar_menciones(db: Session, actor_id: int, texto: str | None, tipo: str,
                        excluir: set[int] | None = None, **refs) -> None:
    """Crea una notificación `tipo` para cada @usuario activo mencionado en `texto`.

    No se notifica al actor, a los ids de `excluir`, a quien tenga bloqueo (en cualquier sentido) con el actor
    ni a quien no pueda ver el contenido del actor. `refs` van a la notificación (post_id, comentario_id,
    album_id, story_id). No hace commit: va en la transacción del caso de uso.
    """
    nombres = extraer_menciones(texto)
    if not nombres:
        return
    permisos = PermisosService(db)
    actor = permisos.usuarios.buscar_activo(actor_id)
    if actor is None:
        return
    excluir = excluir or set()
    notifs = NotificacionRepository(db)
    candidatos = db.query(Usuario).filter(func.lower(Usuario.username).in_(nombres), Usuario.eliminado_en.is_(None)).all()
    for u in candidatos:
        if u.id == actor_id or u.id in excluir:
            continue
        if permisos.usuarios.hay_bloqueo(actor_id, u.id) or not permisos.puede_ver_contenido(actor, u.id):
            continue
        notifs.crear(u.id, actor_id, tipo, **refs)
