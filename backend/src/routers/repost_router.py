"""EXTRA: republicaciones (reposts). Republicar un post lo muestra en el perfil propio y en el feed de mis seguidores."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.post_dto import PostDetalleDTO
from src.dtos.usuario_dto import UsuarioResumenDTO
from src.middlewares.auth_middleware import get_current_user, verificar_dueno
from src.repositories.sql import POST_COLUMNAS, POST_FROM, activo, puede_ver, sin_bloqueo
from src.routers.deps import Pagina
from src.services.post_service import PostService
from src.services.permisos_service import PermisosService

router = APIRouter(tags=["reposts"])


class EstadoRepostDTO(BaseModel):
    cantidad_reposts: int
    me_republique: bool


def _estado(db: Session, post_id: int, yo: int) -> EstadoRepostDTO:
    fila = db.execute(text(
        f"""SELECT (SELECT count(*) FROM repost r WHERE r.post_id = :id AND {activo('r.usuario_id')}) AS cantidad_reposts,
                   EXISTS (SELECT 1 FROM repost r WHERE r.post_id = :id AND r.usuario_id = :yo) AS me_republique"""),
        {"id": post_id, "yo": yo}).mappings().one()
    return EstadoRepostDTO(**fila)


# Posts republicados, visibles para :yo, con quién y cuándo los republicó (alias r = repost, ur = quien republica).
_REPOSTS = f"""SELECT {POST_COLUMNAS}, ur.id AS rep_id, ur.username AS rep_username, ur.nombre AS rep_nombre,
                      r.fecha AS fecha_repost
               {POST_FROM}
               JOIN repost r ON r.post_id = p.id
               JOIN usuario ur ON ur.id = r.usuario_id
               WHERE {puede_ver('u')} AND {sin_bloqueo('ur')} AND {{filtro}}
               ORDER BY r.fecha DESC, p.id DESC LIMIT :limit OFFSET :offset"""


def _listar(db: Session, filtro: str, **params) -> list[PostDetalleDTO]:
    filas = db.execute(text(_REPOSTS.format(filtro=filtro)), params).mappings().all()
    out = []
    for f in filas:
        d = dict(f)
        rep = UsuarioResumenDTO(id=d.pop("rep_id"), username=d.pop("rep_username"), nombre=d.pop("rep_nombre"))
        out.append(PostDetalleDTO(**d, repostado_por=rep))
    return out


@router.post("/posts/{post_id}/repost", response_model=EstadoRepostDTO)
def republicar(post_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    """Idempotente. 403/404 si no podés ver el post."""
    PostService(db).obtener(post_id, actual.id)
    db.execute(text("INSERT INTO repost (usuario_id, post_id) VALUES (:yo, :id) ON CONFLICT DO NOTHING"),
               {"yo": actual.id, "id": post_id})
    db.commit()
    return _estado(db, post_id, actual.id)


@router.delete("/posts/{post_id}/repost", response_model=EstadoRepostDTO)
def quitar(post_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    db.execute(text("DELETE FROM repost WHERE usuario_id = :yo AND post_id = :id"), {"yo": actual.id, "id": post_id})
    db.commit()
    return _estado(db, post_id, actual.id)


@router.get("/usuarios/{usuario_id}/reposts", response_model=list[PostDetalleDTO])
def de_usuario(usuario_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
               actual: Usuario = Depends(get_current_user)):
    """Republicaciones de {usuario_id}, fecha desc. Según su privacidad (403/404)."""
    PermisosService(db).exigir_ver_contenido(usuario_id, actual.id)
    return _listar(db, "r.usuario_id = :uid", uid=usuario_id, yo=actual.id, limit=pag.limit, offset=pag.offset)


@router.get("/usuarios/{usuario_id}/feed/reposts", response_model=list[PostDetalleDTO])
def del_feed(usuario_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
             actual: Usuario = Depends(get_current_user)):
    """Republicaciones de las cuentas que sigo (para mezclar con el feed). Solo dueño."""
    verificar_dueno(usuario_id, actual)
    return _listar(db, """r.usuario_id IN (SELECT seguido_id FROM seguidores
                                           WHERE seguidor_id = :yo AND estado = 'aceptado')""",
                   yo=actual.id, limit=pag.limit, offset=pag.offset)
