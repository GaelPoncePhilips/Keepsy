"""EXTRA: likes y comentarios de los items de un álbum compartido (los ve y usa quien puede ver el álbum)."""
from datetime import datetime

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.usuario_dto import UsuarioResumenDTO
from src.middlewares.auth_middleware import get_current_user
from src.repositories.sql import sin_bloqueo
from src.routers.deps import Pagina
from src.schemas.post_schema import CreateComentarioSchema
from src.services.album_service import AlbumService
from src.utils.errors import ForbiddenError, NotFoundError

router = APIRouter(prefix="/albums/{album_id}/items/{item_id}", tags=["álbumes"])


class EstadoLikeItemDTO(BaseModel):
    cantidad_likes: int
    me_gusta: bool


class ComentarioItemDTO(BaseModel):
    id: int
    item_id: int
    post_id: int  # = item_id, para reutilizar la forma de Comentario en el cliente
    usuario_id: int
    autor_username: str
    texto: str
    fecha: datetime


def _estado(db: Session, item_id: int, yo: int) -> EstadoLikeItemDTO:
    f = db.execute(text(
        """SELECT (SELECT count(*) FROM album_item_like l JOIN usuario u ON u.id = l.usuario_id
                    WHERE l.item_id = :id AND u.eliminado_en IS NULL) AS cantidad_likes,
                  EXISTS (SELECT 1 FROM album_item_like WHERE item_id = :id AND usuario_id = :yo) AS me_gusta"""),
        {"id": item_id, "yo": yo}).mappings().one()
    return EstadoLikeItemDTO(**f)


@router.post("/like", response_model=EstadoLikeItemDTO)
def dar_like(album_id: int, item_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    AlbumService(db).item_visible(album_id, item_id, actual.id)
    db.execute(text("INSERT INTO album_item_like (usuario_id, item_id) VALUES (:yo, :id) ON CONFLICT DO NOTHING"),
               {"yo": actual.id, "id": item_id})
    db.commit()
    return _estado(db, item_id, actual.id)


@router.delete("/like", response_model=EstadoLikeItemDTO)
def quitar_like(album_id: int, item_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    AlbumService(db).item_visible(album_id, item_id, actual.id)
    db.execute(text("DELETE FROM album_item_like WHERE usuario_id = :yo AND item_id = :id"), {"yo": actual.id, "id": item_id})
    db.commit()
    return _estado(db, item_id, actual.id)


@router.get("/likes", response_model=list[UsuarioResumenDTO])
def likes(album_id: int, item_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
          actual: Usuario = Depends(get_current_user)):
    AlbumService(db).item_visible(album_id, item_id, actual.id)
    filas = db.execute(text(
        f"""SELECT u.id, u.username, u.nombre FROM album_item_like l JOIN usuario u ON u.id = l.usuario_id
            WHERE l.item_id = :id AND {sin_bloqueo('u')}
            ORDER BY l.fecha DESC LIMIT :limit OFFSET :offset"""),
        {"id": item_id, "yo": actual.id, "limit": pag.limit, "offset": pag.offset}).mappings().all()
    return [UsuarioResumenDTO(**f) for f in filas]


_COMENTARIO = """SELECT c.id, c.item_id, c.item_id AS post_id, c.usuario_id, u.username AS autor_username, c.texto, c.fecha
                 FROM album_item_comentario c JOIN usuario u ON u.id = c.usuario_id"""


@router.get("/comentarios", response_model=list[ComentarioItemDTO])
def comentarios(album_id: int, item_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
                actual: Usuario = Depends(get_current_user)):
    """Más viejos primero, como los comentarios de un post."""
    AlbumService(db).item_visible(album_id, item_id, actual.id)
    filas = db.execute(text(
        f"""{_COMENTARIO} WHERE c.item_id = :id AND {sin_bloqueo('u')}
            ORDER BY c.fecha, c.id LIMIT :limit OFFSET :offset"""),
        {"id": item_id, "yo": actual.id, "limit": pag.limit, "offset": pag.offset}).mappings().all()
    return [ComentarioItemDTO(**f) for f in filas]


@router.post("/comentarios", response_model=ComentarioItemDTO, status_code=status.HTTP_201_CREATED)
def comentar(album_id: int, item_id: int, payload: CreateComentarioSchema, db: Session = Depends(get_db),
             actual: Usuario = Depends(get_current_user)):
    AlbumService(db).item_visible(album_id, item_id, actual.id)
    cid = db.execute(text("INSERT INTO album_item_comentario (item_id, usuario_id, texto) VALUES (:id, :yo, :t) RETURNING id"),
                     {"id": item_id, "yo": actual.id, "t": payload.texto}).scalar()
    db.commit()
    return ComentarioItemDTO(**db.execute(text(f"{_COMENTARIO} WHERE c.id = :cid"), {"cid": cid}).mappings().one())


@router.delete("/comentarios/{comentario_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_comentario(album_id: int, item_id: int, comentario_id: int, db: Session = Depends(get_db),
                      actual: Usuario = Depends(get_current_user)):
    """El autor del comentario, el autor del item o un admin del álbum."""
    servicio = AlbumService(db)
    item = servicio.item_visible(album_id, item_id, actual.id)
    autor = db.execute(text("SELECT usuario_id FROM album_item_comentario WHERE id = :cid AND item_id = :id"),
                       {"cid": comentario_id, "id": item_id}).scalar()
    if autor is None:
        raise NotFoundError("Comentario no encontrado")
    if actual.id not in (autor, item.usuario_id) and not servicio.es_admin(album_id, actual.id):
        raise ForbiddenError("No podés borrar este comentario")
    db.execute(text("DELETE FROM album_item_comentario WHERE id = :cid"), {"cid": comentario_id})
    db.commit()
