from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.post_dto import PostDetalleDTO
from src.dtos.story_dto import (EstadoLikeStoryDTO, HashtagTendenciaDTO, LikeStoryDTO, StoriesDeUsuarioDTO, StoryDTO,
                                VistaDTO)
from src.middlewares.auth_middleware import get_current_user, verificar_dueno
from src.routers.deps import Pagina
from src.schemas.story_schema import CreateStorySchema
from src.services.post_service import PostService
from src.services.story_service import StoryService

router = APIRouter(tags=["stories"])


@router.post("/stories", response_model=StoryDTO, status_code=status.HTTP_201_CREATED)
def publicar(payload: CreateStorySchema, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return StoryService(db).publicar(actual.id, payload.url_imagen, payload.solo_mejores_amigos, payload.texto)


@router.get("/stories/{story_id}", response_model=StoryDTO)
def obtener(story_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    """EXTRA: una story suelta. El dueño siempre; el resto si está vigente o en una destacada (403/404)."""
    return StoryService(db).obtener(story_id, actual.id)


@router.post("/stories/{story_id}/like", response_model=EstadoLikeStoryDTO)
def dar_like(story_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    """EXTRA: idempotente. Notifica al dueño (like_story)."""
    return StoryService(db).dar_like(story_id, actual.id)


@router.delete("/stories/{story_id}/like", response_model=EstadoLikeStoryDTO)
def quitar_like(story_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return StoryService(db).quitar_like(story_id, actual.id)


@router.get("/stories/{story_id}/likes", response_model=list[LikeStoryDTO])
def likes(story_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
          actual: Usuario = Depends(get_current_user)):
    """EXTRA: quiénes le dieron me gusta. Solo el dueño."""
    return StoryService(db).likes(story_id, actual.id, pag.limit, pag.offset)


@router.get("/usuarios/{usuario_id}/stories", response_model=list[StoriesDeUsuarioDTO])
def de_seguidos(usuario_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    verificar_dueno(usuario_id, actual)
    return StoryService(db).de_seguidos(actual.id)


@router.get("/usuarios/{usuario_id}/stories/publicadas", response_model=list[StoryDTO])
def publicadas(usuario_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return StoryService(db).vigentes_de(usuario_id, actual.id)


@router.get("/usuarios/{usuario_id}/stories/archivo", response_model=list[StoryDTO])
def archivo(usuario_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
            actual: Usuario = Depends(get_current_user)):
    verificar_dueno(usuario_id, actual)
    return StoryService(db).archivo(actual.id, pag.limit, pag.offset)


@router.post("/stories/{story_id}/vista", status_code=status.HTTP_204_NO_CONTENT)
def ver(story_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    StoryService(db).ver(story_id, actual.id)


@router.get("/stories/{story_id}/vistas", response_model=list[VistaDTO])
def vistas(story_id: int, pag: Pagina = Depends(), db: Session = Depends(get_db),
           actual: Usuario = Depends(get_current_user)):
    return StoryService(db).vistas(story_id, actual.id, pag.limit, pag.offset)


@router.delete("/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(story_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    StoryService(db).eliminar(story_id, actual.id)


# ---------- Hashtags (HU11)
@router.get("/hashtags/tendencia", response_model=list[HashtagTendenciaDTO], tags=["hashtags"])
def tendencia(db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return StoryService(db).hashtags_tendencia()


@router.get("/hashtags/{nombre}/posts", response_model=list[PostDetalleDTO], tags=["hashtags"])
def posts_por_hashtag(nombre: str, pag: Pagina = Depends(), db: Session = Depends(get_db),
                      actual: Usuario = Depends(get_current_user)):
    return PostService(db).por_hashtag(nombre, actual.id, pag.limit, pag.offset)
